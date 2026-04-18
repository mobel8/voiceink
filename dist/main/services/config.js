"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.setSettings = setSettings;
const electron_store_1 = __importDefault(require("electron-store"));
const types_1 = require("../../shared/types");
// electron-store persistent settings
const store = new electron_store_1.default({
    name: 'voiceink-settings',
    defaults: { settings: types_1.DEFAULT_SETTINGS },
});
function getSettings() {
    const s = store.get('settings', types_1.DEFAULT_SETTINGS);
    // Merge defaults (in case of new fields added later)
    const merged = { ...types_1.DEFAULT_SETTINGS, ...s };
    // Env var fallback for Groq key
    if (!merged.groqApiKey && process.env.GROQ_API_KEY) {
        merged.groqApiKey = process.env.GROQ_API_KEY;
    }
    return merged;
}
function setSettings(patch) {
    const current = getSettings();
    const next = { ...current, ...patch };
    store.set('settings', next);
    return next;
}
