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

export const MODE_PROMPTS: Record<Mode, string> = {
  raw: '',
  email:
    "Reformule ce texte dicté en email professionnel clair et poli. Garde la langue originale. Corrige la ponctuation et la grammaire. Retourne UNIQUEMENT le texte final, sans préambule.",
  message:
    "Transforme ce texte dicté en message court et naturel. Garde la langue originale. Corrige fautes et ponctuation. Retourne UNIQUEMENT le texte final.",
  meeting:
    "Structure ce texte dicté en notes de réunion claires avec puces et sections si pertinent. Garde la langue originale. Retourne UNIQUEMENT les notes.",
  summary:
    "Résume ce texte dicté de manière concise. Garde la langue originale. Retourne UNIQUEMENT le résumé.",
  formal:
    "Reformule ce texte dicté dans un registre formel et soutenu. Garde la langue originale. Retourne UNIQUEMENT le texte final.",
  simple:
    "Reformule ce texte dicté de façon simple et claire. Garde la langue originale. Retourne UNIQUEMENT le texte final.",
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
