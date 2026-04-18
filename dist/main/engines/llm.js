"use strict";
// Optional LLM post-processing. Uses Groq chat completions by default
// (very low latency) or OpenAI if configured.
Object.defineProperty(exports, "__esModule", { value: true });
exports.postProcess = postProcess;
exports.translateText = translateText;
const types_1 = require("../../shared/types");
const LANGUAGE_NAMES = {
    fr: 'French', en: 'English', es: 'Spanish', de: 'German',
    it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish',
    ru: 'Russian', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
    ar: 'Arabic',
};
async function postProcess(text, mode, settings) {
    if (!settings.llmEnabled || mode === 'raw' || !text.trim())
        return text;
    const prompt = types_1.MODE_PROMPTS[mode];
    if (!prompt)
        return text;
    const provider = settings.llmProvider;
    try {
        if (provider === 'groq')
            return await callOpenAICompat(text, prompt, settings, 'https://api.groq.com/openai/v1/chat/completions', settings.groqApiKey || settings.llmApiKey, settings.llmModel);
        if (provider === 'openai')
            return await callOpenAICompat(text, prompt, settings, 'https://api.openai.com/v1/chat/completions', settings.llmApiKey, settings.llmModel || 'gpt-4o-mini');
        if (provider === 'ollama')
            return await callOllama(text, prompt, settings);
        if (provider === 'anthropic')
            return await callAnthropic(text, prompt, settings);
    }
    catch (err) {
        console.error('[llm] postProcess failed, returning raw text:', err?.message || err);
        return text;
    }
    return text;
}
async function callOpenAICompat(text, system, _settings, url, apiKey, model) {
    if (!apiKey)
        return text;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: text },
            ],
        }),
    });
    if (!res.ok)
        return text;
    const data = (await res.json());
    const out = data?.choices?.[0]?.message?.content;
    return typeof out === 'string' && out.trim() ? out.trim() : text;
}
async function callOllama(text, system, settings) {
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
    if (!res.ok)
        return text;
    const data = (await res.json());
    return data?.message?.content?.trim() || text;
}
async function callAnthropic(text, system, settings) {
    if (!settings.llmApiKey)
        return text;
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
    if (!res.ok)
        return text;
    const data = (await res.json());
    const out = data?.content?.[0]?.text;
    return typeof out === 'string' && out.trim() ? out.trim() : text;
}
/**
 * Translate text to `targetCode` (ISO 639-1). Uses Groq llama-3.3-70b by
 * default — typically 300-600 ms. If `sourceCode` is provided AND equals
 * target, this is a no-op. Falls back to source text on any error.
 */
async function translateText(text, targetCode, settings, sourceCode) {
    if (!text.trim() || !targetCode)
        return text;
    if (sourceCode && sourceCode.toLowerCase() === targetCode.toLowerCase())
        return text;
    const targetName = LANGUAGE_NAMES[targetCode.toLowerCase()] || targetCode;
    const sourceName = sourceCode ? (LANGUAGE_NAMES[sourceCode.toLowerCase()] || sourceCode) : 'the detected language';
    const system = `You are a professional translator. Translate the user's text from ${sourceName} into ${targetName}. ` +
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
        const data = (await res.json());
        const out = data?.choices?.[0]?.message?.content;
        return typeof out === 'string' && out.trim() ? out.trim() : text;
    }
    catch (err) {
        console.warn('[translate] error:', err?.message || err);
        return text;
    }
}
