// Types partagés entre main et renderer

import type { ThemeId, ThemeEffects } from './themes';
export type { ThemeId, ThemeEffects } from './themes';
export { THEMES, THEME_ORDER, DEFAULT_EFFECTS, getTheme } from './themes';

export type Mode =
  | 'raw'
  | 'email'
  | 'message'
  | 'meeting'
  | 'summary'
  | 'formal'
  | 'simple';

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

/**
 * Prompt templates for each post-processing mode.
 *
 * They use `{{LANG}}` as a placeholder for the human-readable language
 * name ("French", "English", "Japanese"…) injected at runtime by
 * `postProcess()` based on whatever Whisper detected (or the user
 * explicitly selected).
 *
 * The prompts are deliberately written in English because every major
 * LLM (Groq's llama-3.3, GPT-4o, Claude, Ollama models) follows English
 * instructions more reliably than localised ones. Experimentally, a
 * French system prompt biases the output language even when told "keep
 * the original language" — so we state the language twice, once as a
 * hard instruction ("RESPOND IN {{LANG}}") and once as context.
 *
 * Each prompt also includes an anti-preamble clause because Llama-style
 * models love to prepend things like "Here is the rewritten email:".
 */
export const MODE_PROMPTS: Record<Mode, string> = {
  raw: '',
  email:
    `You are rewriting a dictated voice note into a professional, polite email in {{LANG}}.` +
    ` RESPOND IN {{LANG}} ONLY — never translate to another language.` +
    ` Fix punctuation, grammar and capitalisation. Keep all facts, numbers and names exact.` +
    ` MANDATORY STRUCTURE: (1) a proper GREETING on the first line (e.g. "Bonjour", "Hello", "Hola", "Sehr geehrte Damen und Herren", "お世話になります"),` +
    ` (2) the body of the email, (3) a proper CLOSING on the last line (e.g. "Cordialement", "Best regards", "Un saludo", "Mit freundlichen Grüßen", "よろしくお願いいたします").` +
    ` Both greeting and closing are required — never omit either.` +
    ` OUTPUT RULES: return ONLY the final email text, no preamble, no quotes, no markdown fences, no commentary.`,
  message:
    `You are rewriting a dictated voice note into a short natural chat message in {{LANG}}.` +
    ` RESPOND IN {{LANG}} ONLY — never translate.` +
    ` Fix typos, punctuation and capitalisation. Keep it concise (1-3 sentences) and conversational.` +
    ` The output MUST be shorter than the input — compress filler words, repetitions and hesitations.` +
    ` OUTPUT RULES: return ONLY the final message, no preamble, no quotes, no markdown, no commentary.`,
  meeting:
    `You are turning a dictated voice note into clear meeting notes in {{LANG}}.` +
    ` RESPOND IN {{LANG}} ONLY — never translate.` +
    ` MANDATORY STRUCTURE: use plain markdown bullet points starting with "- " (one per line).` +
    ` Group by topic if relevant, keep every fact, decision and action item.` +
    ` OUTPUT RULES: return ONLY the bulleted notes, no preamble, no commentary, no code fences.`,
  summary:
    `You are summarising a dictated voice note into a concise synthesis in {{LANG}}.` +
    ` RESPOND IN {{LANG}} ONLY — never translate.` +
    ` Keep the key facts, compress redundancy, remove filler words. The output MUST be shorter than the input — aim for ~40% of the original length, never more than 80%.` +
    ` OUTPUT RULES: return ONLY the summary, no preamble, no quotes, no commentary.`,
  formal:
    `You are rewriting a dictated voice note in a formal, polished register in {{LANG}}.` +
    ` RESPOND IN {{LANG}} ONLY — never translate.` +
    ` Remove every hesitation / filler word: in French "euh, ben, bah, ouais, voilà, du coup, alors" at the start of a sentence;` +
    ` in English "um, uh, yeah, gonna, gotta, alright, so"; equivalents in Spanish, German, Japanese.` +
    ` Replace colloquial vocabulary with standard register, use full sentences and correct punctuation.` +
    ` Keep ALL facts, numbers, names and dates intact.` +
    ` OUTPUT RULES: return ONLY the rewritten text, no preamble, no quotes, no commentary.`,
  simple:
    `You are rewriting a dictated voice note in plain, accessible language in {{LANG}}.` +
    ` RESPOND IN {{LANG}} ONLY — never translate.` +
    ` Short sentences, common vocabulary, keep every fact. Target ~CEFR B1 level readability.` +
    ` OUTPUT RULES: return ONLY the rewritten text, no preamble, no quotes, no commentary.`,
};

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
