// Types partagés entre main et renderer

import type { ThemeId, ThemeEffects } from './themes';
export type { ThemeId, ThemeEffects } from './themes';
export { THEMES, THEME_ORDER, DEFAULT_EFFECTS, getTheme } from './themes';

/**
 * Tone modes for dictation post-processing.
 *
 * We intentionally keep this list SHORT — one entry per distinct
 * "manière de parler" the user actually needs. Older modes (`email`,
 * `meeting`, `summary`, `simple`) were either templates that add
 * content the user never dictated (greetings, bullets), length
 * operations rather than tone choices, or redundant with `natural`.
 *
 * Persisted old values are migrated in services/config.ts.
 */
export type Mode =
  | 'raw'
  | 'natural'
  | 'formal'
  | 'message';

/**
 * Prompt templates for each post-processing mode.
 *
 * They use `{{LANG}}` as a placeholder for the human-readable language
 * name ("French", "English", "Japanese"…) injected at runtime by
 * `postProcess()` based on whatever Whisper detected (or the user
 * explicitly selected).
 *
 * The prompts are deliberately written in English because every major
 * LLM (Groq llama-3.3, GPT-4o, Claude, Ollama models) follows English
 * instructions more reliably than localised ones. Experimentally, a
 * French system prompt biases the output language even when told "keep
 * the original language" — so we state the language twice, once as a
 * hard instruction ("RESPOND IN {{LANG}}") and once as context.
 *
 * Every prompt ends with an anti-preamble clause because Llama-style
 * models love to prepend things like "Here is the rewritten text:".
 *
 * Every non-raw prompt MUST:
 *  1. Preserve every fact, number, name and date the user dictated.
 *  2. Never translate. {{LANG}} in = {{LANG}} out.
 *  3. Never add greetings, sign-offs, bullets, or structure the user
 *     didn't dictate. The user's intent matters more than the template.
 *  4. Return ONLY the rewritten text — no quotes, no markdown fences,
 *     no "Here is…" preamble.
 */
export const MODE_PROMPTS: Record<Mode, string> = {
  raw: '',
  natural:
    `You are cleaning up a dictated voice note in {{LANG}}. RESPOND IN {{LANG}} ONLY — never translate.` +
    ` Your ONLY job: fix punctuation, capitalisation, obvious typos, and remove hesitation fillers.` +
    ` In French remove: "euh, heu, ben, bah, mmh, ouais, voilà, du coup, enfin, alors, quoi" (especially at sentence boundaries).` +
    ` In English remove: "um, uh, er, like, you know, I mean, so" (when used as fillers).` +
    ` Equivalents in other languages.` +
    ` PRESERVE the user's voice, vocabulary, sentence structure, tone, register and level of detail EXACTLY.` +
    ` DO NOT rephrase, summarise, shorten, elaborate, add politeness, change the register, or split/merge sentences beyond basic punctuation.` +
    ` Keep every fact, number, name and date intact. If the user stutters a word ("je je pense"), keep only one copy.` +
    ` OUTPUT: return ONLY the cleaned text. No preamble, no quotes, no markdown fences, no commentary.`,
  formal:
    `You are rewriting a dictated voice note in a formal, courteous register in {{LANG}}. RESPOND IN {{LANG}} ONLY — never translate.` +
    ` Remove every filler ("euh, ben, voilà, du coup" in French; "um, uh, like, you know" in English; equivalents in other languages)` +
    ` and every colloquialism. Use complete, well-formed sentences with proper punctuation and capitalisation.` +
    ` In French: avoid contractions ("j'sais" → "je sais"); prefer formal vocabulary (e.g. "production" over "prod", "nécessaire" over "faut").` +
    ` In English: no contractions ("do not" not "don't"), no slang ("cannot" not "can't"). Similar formalisation in other languages.` +
    ` Keep ALL facts, numbers, names and dates EXACTLY as stated.` +
    ` CRITICAL — DO NOT ADD CONTENT. Never add greetings ("Bonjour", "Madame", "Dear…"), sign-offs ("Cordialement", "Je vous prie", "Best regards"), closing phrases ("bien vouloir noter", "please take note", "merci d'avance"),` +
    ` administrative wrappers ("Je vous informe que…", "Je vous confirme que…"), or ANY sentence that wasn't in the original dictation.` +
    ` The output must contain EXACTLY the same information as the input — only the register changes.` +
    ` Output length: stay within 90–120% of the input word count.` +
    ` OUTPUT: return ONLY the rewritten text. No preamble, no quotes, no markdown, no commentary.`,
  message:
    `You are rewriting a dictated voice note into a concise, natural chat message in {{LANG}}. RESPOND IN {{LANG}} ONLY — never translate.` +
    ` Keep it SHORT: 1–3 sentences. Compress repetition, filler words and hesitations aggressively.` +
    ` Keep a conversational tone — the register of the original, not a formalised version. Contractions are fine.` +
    ` DO NOT add greetings, emoji, or closing phrases the user didn't dictate.` +
    ` Keep every fact, number, name and date the user mentioned.` +
    ` OUTPUT: return ONLY the message text. No preamble, no quotes, no markdown, no commentary.`,
};

/**
 * Custom dictionary entry — a word/phrase the user dictates and wants
 * replaced by a different (usually formatted) target. Applied after Whisper,
 * before translation + LLM. See `src/main/services/replacements.ts`.
 */
export interface Replacement {
  id: string;
  from: string;            // trigger (what the user says / what Whisper returns)
  to: string;              // output text
  caseSensitive: boolean;  // default false
  wholeWord: boolean;      // default true — match word boundaries only
  enabled: boolean;
}

export type Density = 'comfortable' | 'compact';

export interface WidgetBounds {
  x: number;
  y: number;
}

export interface Settings {
  groqApiKey: string;
  sttModel: string;       // groq whisper model id
  language: string;       // 'auto' | 'fr' | 'en' | ...
  translateTo: string;    // '' = no translation, else ISO code
  mode: Mode;
  llmEnabled: boolean;
  llmProvider: 'groq' | 'openai' | 'anthropic' | 'ollama';
  llmModel: string;
  llmApiKey: string;
  translateModel: string; // Groq model used for translation
  autoInject: boolean;
  autoCopy: boolean;
  shortcutToggle: string; // Electron accelerator
  shortcutPTT: string;    // Push-to-talk accelerator (press-and-hold)
  pttEnabled: boolean;    // Enable push-to-talk shortcut
  /** Visual theme — palette ID (see `src/shared/themes.ts`). */
  themeId: ThemeId;
  /** Visual effects (glow intensity, blur, animations…). */
  themeEffects: ThemeEffects;
  /** Custom dictionary — applied after Whisper, before translation + LLM. */
  replacements: Replacement[];
  replacementsEnabled: boolean;
  density: Density;             // 'comfortable' (main window) or 'compact' (floating pill)
  alwaysOnTop: boolean;         // Always-on-top in comfortable mode (pill is always on top)
  widgetBounds: WidgetBounds | null; // Last pill position (persisted across launches)
  /** Launch VoiceInk at Windows startup. */
  autoStart: boolean;
  /** Start minimized to tray (no window visible on launch). */
  startMinimized: boolean;
  /** Play subtle audio cues on start/stop/done. */
  soundsEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  groqApiKey: '',
  sttModel: 'whisper-large-v3-turbo',
  language: 'auto',
  translateTo: '',
  mode: 'raw',
  llmEnabled: false,
  llmProvider: 'groq',
  llmModel: 'llama-3.3-70b-versatile',
  llmApiKey: '',
  translateModel: 'llama-3.3-70b-versatile',
  autoInject: true,
  autoCopy: true,
  shortcutToggle: 'CommandOrControl+Shift+Space',
  shortcutPTT: 'CommandOrControl+Shift+V',
  pttEnabled: false,
  themeId: 'midnight',
  themeEffects: {
    glowIntensity: 65,
    blurStrength: 18,
    animateAura: true,
    auraEnabled: true,
    shimmer: true,
    grain: false,
  },
  replacements: [],
  replacementsEnabled: true,
  density: 'comfortable',
  alwaysOnTop: false,
  widgetBounds: null,
  autoStart: false,
  startMinimized: false,
  soundsEnabled: false,
};

export interface HistoryEntry {
  id: string;
  createdAt: number;
  rawText: string;
  finalText: string;
  mode: Mode;
  language: string;
  translatedTo?: string;   // if translation happened
  durationMs: number;
  audioMs: number;
  tags: string[];
  pinned?: boolean;        // user-pinned favourites float to top
  wordCount?: number;      // computed on insert for stats
}

export interface UsageStats {
  totalEntries: number;
  totalWords: number;
  totalChars: number;
  totalDurationMs: number;
  byLanguage: Record<string, number>;
  byMode: Record<string, number>;
  first?: number;          // first createdAt
  last?: number;           // last createdAt
  streakDays: number;      // consecutive days with at least one dictation
}

export interface TranscribeRequest {
  audioBase64: string;     // base64 (no data URL prefix)
  mimeType: string;        // 'audio/webm' etc
  language?: string;       // ISO code or undefined
  translateTo?: string;    // target language, overrides settings
  mode: Mode;
}

export interface TranscribeResponse {
  ok: boolean;
  rawText: string;
  finalText: string;
  detectedLanguage?: string;
  translatedTo?: string;
  durationMs: number;
  error?: string;
}

export const IPC = {
  TRANSCRIBE: 'voiceink:transcribe',
  GET_SETTINGS: 'voiceink:getSettings',
  SET_SETTINGS: 'voiceink:setSettings',
  GET_HISTORY: 'voiceink:getHistory',
  ADD_HISTORY: 'voiceink:addHistory',
  DELETE_HISTORY: 'voiceink:deleteHistory',
  CLEAR_HISTORY: 'voiceink:clearHistory',
  INJECT_TEXT: 'voiceink:injectText',
  COPY_TEXT: 'voiceink:copyText',
  EXPORT: 'voiceink:export',
  ON_TOGGLE_RECORDING: 'voiceink:onToggleRecording',
  ON_SETTINGS_OPEN: 'voiceink:onSettingsOpen',
  WINDOW_MINIMIZE: 'voiceink:windowMinimize',
  WINDOW_CLOSE: 'voiceink:windowClose',
  WINDOW_MAXIMIZE: 'voiceink:windowMaximize',
  WINDOW_SET_ALWAYS_ON_TOP: 'voiceink:windowSetAlwaysOnTop',
  WINDOW_RESIZE_FOR_DENSITY: 'voiceink:windowResizeForDensity',
  WIDGET_CONTEXT_MENU: 'voiceink:widgetContextMenu',
  TOGGLE_PIN_HISTORY: 'voiceink:togglePinHistory',
  EXPORT_HISTORY: 'voiceink:exportHistory',
  GET_USAGE_STATS: 'voiceink:getUsageStats',
  SET_AUTO_START: 'voiceink:setAutoStart',
  ON_PTT_DOWN: 'voiceink:onPttDown',
  ON_PTT_UP: 'voiceink:onPttUp',
  LOG: 'voiceink:log',
} as const;
