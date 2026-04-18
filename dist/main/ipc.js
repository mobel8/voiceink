"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpc = registerIpc;
const electron_1 = require("electron");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const types_1 = require("../shared/types");
const config_1 = require("./services/config");
const whisper_1 = require("./engines/whisper");
const llm_1 = require("./engines/llm");
const history_1 = require("./services/history");
const injection_1 = require("./services/injection");
const replacements_1 = require("./services/replacements");
const validate_1 = require("./services/validate");
function registerIpc() {
    electron_1.ipcMain.handle(types_1.IPC.GET_SETTINGS, () => (0, config_1.getSettings)());
    electron_1.ipcMain.handle(types_1.IPC.SET_SETTINGS, (_e, patch) => (0, config_1.setSettings)((0, validate_1.sanitizeSettingsPatch)(patch)));
    electron_1.ipcMain.handle(types_1.IPC.GET_HISTORY, () => (0, history_1.listHistory)());
    electron_1.ipcMain.handle(types_1.IPC.ADD_HISTORY, (_e, entry) => (0, history_1.addHistory)(entry));
    electron_1.ipcMain.handle(types_1.IPC.DELETE_HISTORY, (_e, id) => {
        const safe = (0, validate_1.validateHistoryId)(id);
        if (!safe)
            return;
        return (0, history_1.deleteHistory)(safe);
    });
    electron_1.ipcMain.handle(types_1.IPC.CLEAR_HISTORY, () => (0, history_1.clearHistory)());
    electron_1.ipcMain.handle(types_1.IPC.TOGGLE_PIN_HISTORY, (_e, id) => {
        const safe = (0, validate_1.validateHistoryId)(id);
        if (!safe)
            return false;
        return (0, history_1.togglePinHistory)(safe);
    });
    electron_1.ipcMain.handle(types_1.IPC.GET_USAGE_STATS, () => (0, history_1.getUsageStats)());
    electron_1.ipcMain.handle(types_1.IPC.EXPORT_HISTORY, async (event, rawFormat) => {
        const format = (0, validate_1.validateExportFormat)(rawFormat);
        if (!format)
            return { ok: false, error: 'invalid format' };
        const { filename, content } = (0, history_1.exportHistory)(format);
        const win = electron_1.BrowserWindow.fromWebContents(event.sender) || electron_1.BrowserWindow.getAllWindows()[0];
        const res = await electron_1.dialog.showSaveDialog(win, {
            title: 'Exporter l\'historique',
            defaultPath: filename,
            filters: [
                format === 'json' ? { name: 'JSON', extensions: ['json'] } :
                    format === 'markdown' ? { name: 'Markdown', extensions: ['md'] } :
                        format === 'csv' ? { name: 'CSV', extensions: ['csv'] } :
                            { name: 'Texte', extensions: ['txt'] },
            ],
        });
        if (res.canceled || !res.filePath)
            return { ok: false, canceled: true };
        try {
            await (0, promises_1.writeFile)(res.filePath, content, 'utf-8');
            return { ok: true, path: res.filePath };
        }
        catch (err) {
            return { ok: false, error: err?.message || String(err) };
        }
    });
    electron_1.ipcMain.handle(types_1.IPC.SET_AUTO_START, (_e, enabled) => {
        const flag = !!enabled; // explicit boolean coerce
        try {
            electron_1.app.setLoginItemSettings({
                openAtLogin: flag,
                // --hidden is read by main/index.ts to decide whether to hide the window on startup.
                args: flag ? ['--hidden'] : [],
            });
            (0, config_1.setSettings)({ autoStart: flag });
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: err?.message || String(err) };
        }
    });
    electron_1.ipcMain.handle(types_1.IPC.COPY_TEXT, (_e, text) => {
        const safe = (0, validate_1.validateText)(text);
        if (safe === null)
            return;
        (0, injection_1.copyToClipboard)(safe);
    });
    electron_1.ipcMain.handle(types_1.IPC.INJECT_TEXT, (_e, text) => {
        const safe = (0, validate_1.validateText)(text);
        if (safe === null)
            return;
        return (0, injection_1.injectText)(safe);
    });
    electron_1.ipcMain.handle(types_1.IPC.TRANSCRIBE, async (_e, rawReq) => {
        const req = (0, validate_1.validateTranscribeRequest)(rawReq);
        if (!req) {
            return { ok: false, rawText: '', finalText: '', durationMs: 0, error: 'invalid request' };
        }
        const t0 = Date.now();
        try {
            const settings = (0, config_1.getSettings)();
            const buf = Buffer.from(req.audioBase64, 'base64');
            console.log(`[transcribe] received audio: ${buf.length} bytes (${req.mimeType})`);
            if (buf.length < 500) {
                throw new Error('Audio trop court / silencieux. Parlez un peu plus longtemps.');
            }
            const t1 = Date.now();
            const r = await (0, whisper_1.transcribeWithGroq)(buf, req.mimeType, settings);
            const t2 = Date.now();
            console.log(`[transcribe] groq whisper: ${t2 - t1}ms → "${r.text.slice(0, 80)}" (lang=${r.language || '?'})`);
            // Custom dictionary (replacements) — applied to the RAW Whisper output
            // before anything else so translation / LLM see the corrected text.
            let rawText = r.text;
            if (settings.replacementsEnabled !== false && settings.replacements?.length) {
                const rs = Date.now();
                rawText = (0, replacements_1.applyReplacements)(rawText, settings.replacements);
                if (rawText !== r.text) {
                    console.log(`[transcribe] applied ${settings.replacements.length} replacement rule(s) in ${Date.now() - rs}ms`);
                }
            }
            // Automatic translation if target language requested (explicit in request
            // takes precedence over stored setting).
            const translateTo = (req.translateTo !== undefined ? req.translateTo : settings.translateTo) || '';
            let translated = null;
            if (translateTo && rawText.trim()) {
                const ts = Date.now();
                translated = await (0, llm_1.translateText)(rawText, translateTo, settings, r.language);
                console.log(`[transcribe] translation → ${translateTo}: ${Date.now() - ts}ms`);
            }
            // LLM post-processing operates on whichever text we'll present
            // (translated if any, else raw) so the reformulation is in the target language.
            let final = translated ?? rawText;
            if (settings.llmEnabled && req.mode !== 'raw') {
                const ps = Date.now();
                final = await (0, llm_1.postProcess)(final, req.mode, settings);
                console.log(`[transcribe] llm post-process: ${Date.now() - ps}ms`);
            }
            const durationMs = Date.now() - t0;
            (0, history_1.addHistory)({
                id: (0, crypto_1.randomUUID)(),
                createdAt: Date.now(),
                rawText,
                finalText: final,
                mode: req.mode,
                language: r.language || req.language || 'auto',
                translatedTo: translateTo || undefined,
                durationMs,
                audioMs: 0,
                tags: [],
                wordCount: (0, replacements_1.wordCount)(final),
            });
            if (settings.autoCopy || settings.autoInject) {
                try {
                    electron_1.clipboard.writeText(final);
                }
                catch { }
            }
            return {
                ok: true,
                rawText,
                finalText: final,
                detectedLanguage: r.language,
                translatedTo: translateTo || undefined,
                durationMs,
            };
        }
        catch (err) {
            console.error('[transcribe] error:', err?.message || err);
            return {
                ok: false,
                rawText: '',
                finalText: '',
                durationMs: Date.now() - t0,
                error: err?.message || String(err),
            };
        }
    });
}
