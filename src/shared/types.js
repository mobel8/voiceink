"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODE_PROMPTS = exports.MODE_LABELS = exports.SUPPORTED_LANGUAGES = exports.IPC = void 0;
// ===== IPC Channels =====
exports.IPC = {
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
    // File
    FILE_OPEN: 'file:open',
    FILE_TRANSCRIBE: 'file:transcribe',
    FILE_EXPORT: 'file:export',
};
// ===== Languages =====
exports.SUPPORTED_LANGUAGES = [
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
];
// ===== Processing Mode Labels =====
exports.MODE_LABELS = {
    raw: 'Texte brut',
    email: 'Email professionnel',
    short_message: 'Message court',
    meeting_notes: 'Notes de réunion',
    summary: 'Résumé',
    formal: 'Reformulation formelle',
    simplified: 'Reformulation simplifiée',
    custom: 'Mode personnalisé',
};
exports.MODE_PROMPTS = {
    email: `Tu es un assistant de rédaction. Reformule le texte dicté en email professionnel bien structuré. Ajoute une formule de politesse appropriée. Corrige la grammaire et la ponctuation. Réponds uniquement avec l'email reformulé, sans explication.`,
    short_message: `Tu es un assistant de rédaction. Reformule le texte dicté en message court et concis. Garde l'essentiel, supprime les hésitations et répétitions. Corrige la grammaire. Réponds uniquement avec le message, sans explication.`,
    meeting_notes: `Tu es un assistant de prise de notes. Transforme le texte dicté en notes de réunion structurées avec des points clés, des décisions et des actions. Utilise des puces. Corrige la grammaire. Réponds uniquement avec les notes, sans explication.`,
    summary: `Tu es un assistant de synthèse. Résume le texte dicté en quelques phrases clés. Garde les informations essentielles. Corrige la grammaire. Réponds uniquement avec le résumé, sans explication.`,
    formal: `Tu es un assistant de rédaction. Reformule le texte dicté dans un registre formel et professionnel. Corrige la grammaire et la ponctuation. Réponds uniquement avec le texte reformulé, sans explication.`,
    simplified: `Tu es un assistant de rédaction. Reformule le texte dicté de manière simple et claire. Utilise des phrases courtes. Corrige la grammaire. Réponds uniquement avec le texte simplifié, sans explication.`,
};
