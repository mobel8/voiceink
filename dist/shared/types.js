"use strict";
// Types partagés entre main et renderer
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = exports.DEFAULT_SETTINGS = exports.MODE_PROMPTS = exports.getTheme = exports.DEFAULT_EFFECTS = exports.THEME_ORDER = exports.THEMES = void 0;
var themes_1 = require("./themes");
Object.defineProperty(exports, "THEMES", { enumerable: true, get: function () { return themes_1.THEMES; } });
Object.defineProperty(exports, "THEME_ORDER", { enumerable: true, get: function () { return themes_1.THEME_ORDER; } });
Object.defineProperty(exports, "DEFAULT_EFFECTS", { enumerable: true, get: function () { return themes_1.DEFAULT_EFFECTS; } });
Object.defineProperty(exports, "getTheme", { enumerable: true, get: function () { return themes_1.getTheme; } });
exports.MODE_PROMPTS = {
    raw: '',
    email: "Reformule ce texte dicté en email professionnel clair et poli. Garde la langue originale. Corrige la ponctuation et la grammaire. Retourne UNIQUEMENT le texte final, sans préambule.",
    message: "Transforme ce texte dicté en message court et naturel. Garde la langue originale. Corrige fautes et ponctuation. Retourne UNIQUEMENT le texte final.",
    meeting: "Structure ce texte dicté en notes de réunion claires avec puces et sections si pertinent. Garde la langue originale. Retourne UNIQUEMENT les notes.",
    summary: "Résume ce texte dicté de manière concise. Garde la langue originale. Retourne UNIQUEMENT le résumé.",
    formal: "Reformule ce texte dicté dans un registre formel et soutenu. Garde la langue originale. Retourne UNIQUEMENT le texte final.",
    simple: "Reformule ce texte dicté de façon simple et claire. Garde la langue originale. Retourne UNIQUEMENT le texte final.",
};
exports.DEFAULT_SETTINGS = {
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
exports.IPC = {
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
};
