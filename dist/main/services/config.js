"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const DEFAULT_SETTINGS = {
    audio: {
        deviceId: 'default',
        sampleRate: 16000,
        channels: 1,
        sensitivity: 0.5,
        noiseReduction: true,
        autoGain: true,
    },
    stt: {
        provider: 'groq',
        localModel: 'small',
        language: 'fr',
        autoDetectLanguage: false,
        gpuEnabled: true,
        groqApiKey: '',
    },
    llm: {
        provider: 'glm',
        ollamaModel: 'mistral',
        ollamaUrl: 'http://localhost:11434',
        openaiApiKey: '',
        openaiModel: 'gpt-4o-mini',
        anthropicApiKey: '',
        anthropicModel: 'claude-3-haiku-20240307',
        glmApiKey: '5dd625c79ee44dd48449987797200c81.3BLXID2z3II45C11',
        glmModel: 'glm-4-flash',
        temperature: 0.3,
        mode: 'formal',
        customPrompt: '',
    },
    privacy: 'local',
    shortcuts: {
        toggleRecording: 'CommandOrControl+Shift+Space',
        cancelRecording: 'Escape',
    },
    ui: {
        theme: 'dark',
        language: 'fr',
        overlayPosition: 'top-right',
        showOverlay: true,
        minimizeToTray: true,
        startMinimized: false,
        launchAtStartup: false,
    },
};
class ConfigService {
    configPath;
    settings;
    constructor() {
        const userDataPath = electron_1.app?.getPath?.('userData') || path.join(process.env.APPDATA || process.env.HOME || '.', 'VoiceInk');
        this.configPath = path.join(userDataPath, 'settings.json');
        this.settings = this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(data);
                return this.merge(DEFAULT_SETTINGS, parsed);
            }
        }
        catch (err) {
            console.error('Failed to load settings:', err);
        }
        return { ...DEFAULT_SETTINGS };
    }
    merge(defaults, overrides) {
        const result = { ...defaults };
        for (const key of Object.keys(overrides)) {
            if (key in defaults &&
                typeof defaults[key] === 'object' &&
                !Array.isArray(defaults[key]) &&
                defaults[key] !== null) {
                result[key] = this.merge(defaults[key], overrides[key]);
            }
            else {
                result[key] = overrides[key];
            }
        }
        return result;
    }
    save() {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('Failed to save settings:', err);
        }
    }
    getSettings() {
        return { ...this.settings };
    }
    updateSettings(partial) {
        this.settings = this.merge(this.settings, partial);
        this.save();
        return this.getSettings();
    }
    resetSettings() {
        this.settings = { ...DEFAULT_SETTINGS };
        this.save();
        return this.getSettings();
    }
    getModelsPath() {
        const userDataPath = electron_1.app?.getPath?.('userData') || path.join(process.env.APPDATA || process.env.HOME || '.', 'VoiceInk');
        const modelsPath = path.join(userDataPath, 'models');
        if (!fs.existsSync(modelsPath)) {
            fs.mkdirSync(modelsPath, { recursive: true });
        }
        return modelsPath;
    }
}
exports.ConfigService = ConfigService;
