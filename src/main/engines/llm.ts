// Optional LLM post-processing. Uses Groq chat completions by default
// (very low latency) or OpenAI / Anthropic / Ollama if configured.
//
// Designed to be self-contained and *loud*: every branch logs enough
// context that the user can diagnose "why didn't my mode apply?" from
// runtime.log alone — missing API key, HTTP error, empty choice, etc.

import { Mode, MODE_PROMPTS, Settings } from '../../shared/types';

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'French', en: 'English', es: 'Spanish', de: 'German',
  it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish',
  ru: 'Russian', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
  ar: 'Arabic',
};

/**
 * Resolve the human-readable language name the model should respond in.
 *
 * Priority:
 *  1. Whisper's detected language (passed by the caller).
 *  2. The user's explicit language setting, if not 'auto'.
 *  3. Literal fallback "the same language as the input" — the model
 *     infers from the user message.
 */
function resolveLangName(settings: Settings, hint?: string): string {
  const code = (hint || '').toLowerCase();
  if (code && LANGUAGE_NAMES[code]) return LANGUAGE_NAMES[code];
  const pref = (settings.language || '').toLowerCase();
  if (pref && pref !== 'auto' && LANGUAGE_NAMES[pref]) return LANGUAGE_NAMES[pref];
  return 'the same language as the input';
}

/**
 * Is the LLM post-processing layer effectively reachable?
 *
 * The ONLY signal we honour is "can we actually call a provider right
 * now?" — a Groq/OpenAI/Anthropic key is present, or Ollama is assumed
 * to be running locally. We deliberately do NOT gate on the old
 * `llmEnabled` setting here: selecting a non-raw mode in the mode picker
 * IS the user's intent to polish, and that is the only place users
 * actually think about modes. The legacy "Activer LLM" toggle in
 * SettingsView used to hard-block this path, which turned every mode
 * other than 'raw' into a silent no-op for the many users who never
 * opened SettingsView. `llmEnabled` is still kept on Settings so the
 * advanced-config panel can collapse its provider UI behind it, but it
 * no longer affects behaviour.
 */
function isLlmAvailable(settings: Settings): boolean {
  const p = settings.llmProvider || 'groq';
  if (p === 'ollama') return true; // local, no key needed
  if (p === 'groq') return !!(settings.groqApiKey || settings.llmApiKey);
  return !!settings.llmApiKey;
}

export async function postProcess(
  text: string,
  mode: Mode,
  settings: Settings,
  languageHint?: string,
): Promise<string> {
  if (mode === 'raw' || !text.trim()) return text;
  if (!isLlmAvailable(settings)) {
    const provider = settings.llmProvider || 'groq';
    console.warn(`[llm] mode=${mode} requested but no key configured for provider=${provider}.` +
      ` Returning raw Whisper text. Fix: set settings.groqApiKey (Groq / default) or` +
      ` settings.llmApiKey (OpenAI / Anthropic), or switch provider to 'ollama' for local.`);
    return text;
  }

  const template = MODE_PROMPTS[mode];
  if (!template) {
    console.warn(`[llm] unknown mode ${mode}, returning raw text`);
    return text;
  }

  const langName = resolveLangName(settings, languageHint);
  const prompt = template.replace(/\{\{LANG\}\}/g, langName);

  const provider = settings.llmProvider || 'groq';
  console.log(`[llm] postProcess mode=${mode} provider=${provider} lang=${langName} ` +
    `input=${text.length}ch`);

  try {
    let out = text;
    if (provider === 'groq') {
      out = await callOpenAICompat(text, prompt, 'https://api.groq.com/openai/v1/chat/completions',
        settings.groqApiKey || settings.llmApiKey,
        settings.llmModel || 'llama-3.3-70b-versatile',
        'groq');
    } else if (provider === 'openai') {
      out = await callOpenAICompat(text, prompt, 'https://api.openai.com/v1/chat/completions',
        settings.llmApiKey, settings.llmModel || 'gpt-4o-mini', 'openai');
    } else if (provider === 'ollama') {
      out = await callOllama(text, prompt, settings);
    } else if (provider === 'anthropic') {
      out = await callAnthropic(text, prompt, settings);
    }
    console.log(`[llm] postProcess done → ${out.length}ch`);
    return out;
  } catch (err: any) {
    console.error('[llm] postProcess failed, returning raw text:', err?.message || err);
    return text;
  }
}

async function callOpenAICompat(
  text: string,
  system: string,
  url: string,
  apiKey: string,
  model: string,
  label: string,
): Promise<string> {
  if (!apiKey) {
    console.warn(`[llm:${label}] no API key — cannot post-process`);
    return text;
  }
  const body = JSON.stringify({
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ],
  });

  // Retry on 429 (rate limit) and 5xx with exponential backoff. When
  // Groq embeds a "try again in Xs" hint we honour it instead of our
  // own schedule — usually faster.
  const backoff = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= backoff.length; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const out = data?.choices?.[0]?.message?.content;
      if (typeof out !== 'string' || !out.trim()) {
        console.warn(`[llm:${label}] empty / non-string response:`, JSON.stringify(data).slice(0, 200));
        return text;
      }
      return stripCodeFences(out.trim());
    }

    const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
    const errBody = await res.text().catch(() => '');
    if (!retryable || attempt === backoff.length) {
      console.warn(`[llm:${label}] HTTP ${res.status}: ${errBody.slice(0, 300)}`);
      return text;
    }

    // Parse optional "try again in <N>s" hint.
    let wait = backoff[attempt];
    const hint = errBody.match(/try again in ([0-9.]+)s/i);
    if (hint) wait = Math.max(wait, Math.ceil(parseFloat(hint[1]) * 1000));
    console.warn(`[llm:${label}] HTTP ${res.status} — retry ${attempt + 1}/${backoff.length} in ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }
  return text;
}

async function callOllama(text: string, system: string, settings: Settings): Promise<string> {
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.llmModel || 'llama3.2',
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[llm:ollama] HTTP ${res.status}: ${body.slice(0, 300)}`);
    return text;
  }
  const data = (await res.json()) as any;
  const out = data?.message?.content?.trim();
  return out ? stripCodeFences(out) : text;
}

async function callAnthropic(text: string, system: string, settings: Settings): Promise<string> {
  if (!settings.llmApiKey) {
    console.warn('[llm:anthropic] no API key');
    return text;
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': settings.llmApiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.llmModel || 'claude-3-5-haiku-latest',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[llm:anthropic] HTTP ${res.status}: ${body.slice(0, 300)}`);
    return text;
  }
  const data = (await res.json()) as any;
  const out = data?.content?.[0]?.text;
  return typeof out === 'string' && out.trim() ? stripCodeFences(out.trim()) : text;
}

/**
 * Some models wrap their output in ``` markdown fences even when told
 * not to. Strip a single outer fence if present (keeps inner fences —
 * e.g. a code snippet inside the message — intact).
 */
function stripCodeFences(s: string): string {
  const m = s.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return m ? m[1].trim() : s;
}

/**
 * Translate text to `targetCode` (ISO 639-1). Uses Groq llama-3.3-70b by
 * default — typically 300-600 ms. If `sourceCode` is provided AND equals
 * target, this is a no-op. Falls back to source text on any error.
 */
export async function translateText(
  text: string,
  targetCode: string,
  settings: Settings,
  sourceCode?: string,
): Promise<string> {
  if (!text.trim() || !targetCode) return text;
  if (sourceCode && sourceCode.toLowerCase() === targetCode.toLowerCase()) return text;

  const targetName = LANGUAGE_NAMES[targetCode.toLowerCase()] || targetCode;
  const sourceName = sourceCode ? (LANGUAGE_NAMES[sourceCode.toLowerCase()] || sourceCode) : 'the detected language';

  const system =
    `You are a professional translator. Translate the user's text from ${sourceName} into ${targetName}. ` +
    `Preserve meaning, tone, punctuation and formatting. Do NOT add commentary, ` +
    `quotes, or explanations. Return ONLY the translated text.`;

  const apiKey = settings.groqApiKey || settings.llmApiKey;
  if (!apiKey) {
    console.warn('[translate] no Groq API key — skipping translation');
    return text;
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.translateModel || 'llama-3.3-70b-versatile',
        temperature: 0.1,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[translate] Groq ${res.status}: ${body.slice(0, 200)}`);
      return text;
    }
    const data = (await res.json()) as any;
    const out = data?.choices?.[0]?.message?.content;
    return typeof out === 'string' && out.trim() ? out.trim() : text;
  } catch (err: any) {
    console.warn('[translate] error:', err?.message || err);
    return text;
  }
}
