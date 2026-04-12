// ===== Audio =====
export interface AudioDevice {
  deviceId: string;
  label: string;
  isDefault: boolean;
}

export interface AudioConfig {
  deviceId: string;
  sampleRate: number;
  channels: number;
  sensitivity: number;
  noiseReduction: boolean;
  autoGain: boolean;
}

// ===== STT =====
export type STTModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';
export type STTProvider = 'local' | 'groq' | 'openai' | 'glm';

export interface STTConfig {
  provider: STTProvider;
  localModel: STTModel;
  language: string;
  autoDetectLanguage: boolean;
  gpuEnabled: boolean;
  groqApiKey: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  segments: TranscriptionSegment[];
  duration: number;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

// ===== LLM =====
export type LLMProvider = 'none' | 'ollama' | 'openai' | 'anthropic' | 'glm';

export type ProcessingMode =
  | 'raw'
  | 'email'
  | 'short_message'
  | 'meeting_notes'
  | 'summary'
  | 'formal'
  | 'simplified'
  | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  ollamaModel: string;
  ollamaUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  glmApiKey: string;
  glmModel: string;
  temperature: number;
  mode: ProcessingMode;
  customPrompt: string;
}

export interface ProcessingResult {
  original: string;
  processed: string;
  mode: ProcessingMode;
}

// ===== Privacy =====
export type PrivacyMode = 'local' | 'hybrid' | 'cloud';

// ===== History =====
export interface HistoryEntry {
  id: string;
  timestamp: number;
  originalText: string;
  processedText: string;
  mode: ProcessingMode;
  language: string;
  duration: number;
  tags: string[];
  source: 'dictation' | 'file';
  fileName?: string;
}

export interface HistoryFilter {
  search?: string;
  tag?: string;
  mode?: ProcessingMode;
  dateFrom?: number;
  dateTo?: number;
  source?: 'dictation' | 'file';
}

// ===== Settings =====
export interface AppSettings {
  audio: AudioConfig;
  stt: STTConfig;
  llm: LLMConfig;
  privacy: PrivacyMode;
  shortcuts: ShortcutConfig;
  ui: UIConfig;
}

export interface ShortcutConfig {
  toggleRecording: string;
  cancelRecording: string;
  pushToTalk?: string; // kept optional for backward-compat with saved settings
}

export interface UIConfig {
  theme: 'light' | 'dark' | 'system';
  language: 'fr' | 'en';
  overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showOverlay: boolean;
  minimizeToTray: boolean;
  startMinimized: boolean;
  launchAtStartup: boolean;
}

// ===== IPC Channels =====
export const IPC = {
  // Audio
  AUDIO_DEVICES: 'audio:devices',
  AUDIO_START: 'audio:start',
  AUDIO_STOP: 'audio:stop',
  AUDIO_DATA: 'audio:data',
  AUDIO_LEVEL: 'audio:level',

  // STT
  STT_TRANSCRIBE: 'stt:transcribe',
  STT_TRANSCRIBE_FILE: 'stt:transcribe-file',
  STT_RESULT: 'stt:result',
  STT_PARTIAL: 'stt:partial',
  STT_STATUS: 'stt:status',
  STT_DOWNLOAD_MODEL: 'stt:download-model',
  STT_MODEL_PROGRESS: 'stt:model-progress',

  // LLM
  LLM_PROCESS: 'llm:process',
  LLM_RESULT: 'llm:result',
  LLM_STREAM: 'llm:stream',
  LLM_STATUS: 'llm:status',

  // Injection
  INJECT_TEXT: 'inject:text',
  INJECT_CLIPBOARD: 'inject:clipboard',

  // History
  HISTORY_GET: 'history:get',
  HISTORY_SEARCH: 'history:search',
  HISTORY_DELETE: 'history:delete',
  HISTORY_EXPORT: 'history:export',
  HISTORY_ADD_TAG: 'history:add-tag',
  HISTORY_REMOVE_TAG: 'history:remove-tag',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_RESET: 'settings:reset',

  // App
  APP_QUIT: 'app:quit',
  APP_MINIMIZE: 'app:minimize',
  APP_TOGGLE_RECORDING: 'app:toggle-recording',
  APP_RECORDING_STATE: 'app:recording-state',
  APP_PIPELINE_STATUS: 'app:pipeline-status',
  APP_COMPACT_MODE: 'app:compact-mode',
  APP_SET_ORB_POSITION: 'app:set-orb-position',
  APP_GET_ORB_POSITION: 'app:get-orb-position',

  // Chat
  CHAT_SEND: 'chat:send',
  CHAT_STREAM: 'chat:stream',

  // File
  FILE_OPEN: 'file:open',
  FILE_TRANSCRIBE: 'file:transcribe',
  FILE_EXPORT: 'file:export',
} as const;

// ===== Recording State =====
export type RecordingState = 'idle' | 'recording' | 'processing' | 'injecting';

export interface PipelineStatus {
  state: RecordingState;
  message: string;
  progress?: number;
}

// ===== Chat =====
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// ===== Export =====
export type ExportFormat = 'txt' | 'docx' | 'srt' | 'json';

// ===== Languages =====
export const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
] as const;

// ===== Processing Mode Labels =====
export const MODE_LABELS: Record<ProcessingMode, string> = {
  raw: 'Texte brut',
  email: 'Email professionnel',
  short_message: 'Message court',
  meeting_notes: 'Notes de réunion',
  summary: 'Résumé',
  formal: 'Reformulation formelle',
  simplified: 'Reformulation simplifiée',
  custom: 'Mode personnalisé',
};

export const MODE_PROMPTS: Record<Exclude<ProcessingMode, 'custom' | 'raw'>, string> = {
  email: `Tu es un assistant de rédaction. Reformule le texte dicté en email professionnel bien structuré. Ajoute une formule de politesse appropriée. Corrige la grammaire et la ponctuation. Réponds uniquement avec l'email reformulé, sans explication.`,
  short_message: `Tu es un assistant de rédaction. Reformule le texte dicté en message court et concis. Garde l'essentiel, supprime les hésitations et répétitions. Corrige la grammaire. Réponds uniquement avec le message, sans explication.`,
  meeting_notes: `Tu es un assistant de prise de notes. Transforme le texte dicté en notes de réunion structurées avec des points clés, des décisions et des actions. Utilise des puces. Corrige la grammaire. Réponds uniquement avec les notes, sans explication.`,
  summary: `Tu es un assistant de synthèse. Résume le texte dicté en quelques phrases clés. Garde les informations essentielles. Corrige la grammaire. Réponds uniquement avec le résumé, sans explication.`,
  formal: `Tu es un assistant de rédaction. Reformule le texte dicté dans un registre formel et professionnel. Corrige la grammaire et la ponctuation. Réponds uniquement avec le texte reformulé, sans explication.`,
  simplified: `Tu es un assistant de rédaction. Reformule le texte dicté de manière simple et claire. Utilise des phrases courtes. Corrige la grammaire. Réponds uniquement avec le texte simplifié, sans explication.`,
};
