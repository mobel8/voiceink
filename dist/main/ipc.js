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
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
const types_1 = require("../shared/types");
let currentRecordingState = 'idle';
let audioTempPath = null;
function registerIpcHandlers(ipcMain, mainWindow, configService, historyService, whisperEngine, llmEngine, textInjector, exportService) {
    // ===== Settings =====
    ipcMain.handle(types_1.IPC.SETTINGS_GET, () => {
        return configService.getSettings();
    });
    ipcMain.handle(types_1.IPC.SETTINGS_SET, (_event, settings) => {
        return configService.updateSettings(settings);
    });
    ipcMain.handle(types_1.IPC.SETTINGS_RESET, () => {
        return configService.resetSettings();
    });
    // ===== Audio =====
    ipcMain.handle(types_1.IPC.AUDIO_START, async () => {
        currentRecordingState = 'recording';
        mainWindow.webContents.send(types_1.IPC.APP_RECORDING_STATE, 'recording');
        sendPipelineStatus(mainWindow, { state: 'recording', message: 'Enregistrement en cours...' });
        return true;
    });
    ipcMain.handle(types_1.IPC.AUDIO_STOP, async () => {
        currentRecordingState = 'processing';
        mainWindow.webContents.send(types_1.IPC.APP_RECORDING_STATE, 'processing');
        sendPipelineStatus(mainWindow, { state: 'processing', message: 'Traitement en cours...' });
        return true;
    });
    // ===== STT Transcription (decoupled from LLM) =====
    ipcMain.handle(types_1.IPC.STT_TRANSCRIBE, async (_event, audioData, language) => {
        const t0 = Date.now();
        try {
            sendPipelineStatus(mainWindow, { state: 'processing', message: 'Transcription...' });
            // Decode base64 to buffer — fast in-memory operation
            let audioBuffer;
            if (audioData.startsWith('data:')) {
                const commaIdx = audioData.indexOf(',');
                audioBuffer = Buffer.from(audioData.substring(commaIdx + 1), 'base64');
            }
            else {
                audioBuffer = await fs.promises.readFile(audioData);
            }
            const tDecode = Date.now();
            console.log(`[Pipeline] Decode: ${audioBuffer.length} bytes in ${tDecode - t0}ms`);
            const settings = configService.getSettings();
            const isCloudProvider = ['groq', 'openai', 'glm'].includes(settings.stt.provider);
            let transcription;
            if (isCloudProvider) {
                // Cloud providers: send buffer directly — skip temp file entirely
                transcription = await whisperEngine.transcribeFromBuffer(audioBuffer, language);
            }
            else {
                // Local whisper: needs a file path
                const tempDir = electron_1.app.getPath('temp');
                audioTempPath = path.join(tempDir, `voiceink-${Date.now()}.wav`);
                await fs.promises.writeFile(audioTempPath, audioBuffer);
                transcription = await whisperEngine.transcribe(audioTempPath, language);
                fs.promises.unlink(audioTempPath).catch(() => { });
            }
            const elapsed = Date.now() - t0;
            console.log(`[Pipeline] Total transcription: ${elapsed}ms — "${(transcription.text || '').substring(0, 80)}"`);
            mainWindow.webContents.send(types_1.IPC.STT_RESULT, transcription);
            sendPipelineStatus(mainWindow, {
                state: 'idle',
                message: transcription.text?.trim() ? `Transcrit en ${(elapsed / 1000).toFixed(1)}s` : 'Aucun texte detecte',
            });
            currentRecordingState = 'idle';
            mainWindow.webContents.send(types_1.IPC.APP_RECORDING_STATE, 'idle');
            return transcription;
        }
        catch (error) {
            console.error('Pipeline error:', error);
            sendPipelineStatus(mainWindow, { state: 'idle', message: `Erreur: ${error.message}` });
            currentRecordingState = 'idle';
            mainWindow.webContents.send(types_1.IPC.APP_RECORDING_STATE, 'idle');
            throw error;
        }
    });
    // ===== File Transcription =====
    ipcMain.handle(types_1.IPC.FILE_OPEN, async () => {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'mp4', 'ogg', 'webm', 'flac'] },
            ],
        });
        if (result.canceled || result.filePaths.length === 0)
            return null;
        return result.filePaths[0];
    });
    ipcMain.handle(types_1.IPC.FILE_TRANSCRIBE, async (_event, filePath) => {
        try {
            sendPipelineStatus(mainWindow, { state: 'processing', message: 'Transcription du fichier...' });
            const transcription = await whisperEngine.transcribe(filePath);
            // LLM post-processing
            const processed = await llmEngine.process(transcription.text);
            // Save to history
            const historyEntry = {
                id: (0, uuid_1.v4)(),
                timestamp: Date.now(),
                originalText: transcription.text,
                processedText: processed.processed,
                mode: processed.mode,
                language: transcription.language,
                duration: transcription.duration,
                tags: [],
                source: 'file',
                fileName: path.basename(filePath),
            };
            historyService.add(historyEntry);
            sendPipelineStatus(mainWindow, { state: 'idle', message: 'Fichier transcrit ✓' });
            return { transcription, processed, historyId: historyEntry.id };
        }
        catch (error) {
            sendPipelineStatus(mainWindow, { state: 'idle', message: `Erreur: ${error.message}` });
            throw error;
        }
    });
    // ===== LLM (streaming) =====
    ipcMain.handle(types_1.IPC.LLM_PROCESS, async (_event, text, mode, targetLang) => {
        try {
            const settings = configService.getSettings();
            const activeMode = (mode || settings.llm.mode);
            // Raw mode with no translation — no LLM needed
            if ((activeMode === 'raw' && !targetLang) || settings.llm.provider === 'none') {
                return { original: text, processed: text, mode: activeMode };
            }
            let systemPrompt;
            if (targetLang) {
                const langNames = { fr: 'francais', en: 'anglais', es: 'espagnol', de: 'allemand', it: 'italien', pt: 'portugais', zh: 'chinois', ja: 'japonais', ko: 'coreen', ar: 'arabe', ru: 'russe', nl: 'neerlandais', pl: 'polonais' };
                const targetName = langNames[targetLang] || targetLang;
                if (activeMode === 'raw' || activeMode === 'custom') {
                    systemPrompt = `Traduis fidelement le texte suivant en ${targetName}. Reponds UNIQUEMENT avec la traduction, sans explication.`;
                }
                else {
                    const modePrompt = llmEngine.getSystemPrompt(activeMode, settings.llm.customPrompt || undefined);
                    systemPrompt = `${modePrompt}\n\nIMPORTANT: Le texte final doit etre en ${targetName}. Traduis et reformule en ${targetName}.`;
                }
            }
            else {
                systemPrompt = llmEngine.getSystemPrompt(activeMode, settings.llm.customPrompt || undefined);
            }
            // Stream tokens to renderer
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text },
            ];
            mainWindow.webContents.send(types_1.IPC.LLM_STREAM, '\x00START'); // signal start
            const processed = await llmEngine.chatStream(messages, (token) => {
                mainWindow.webContents.send(types_1.IPC.LLM_STREAM, token);
            });
            mainWindow.webContents.send(types_1.IPC.LLM_STREAM, '\x00END'); // signal end
            const result = { original: text, processed, mode: activeMode };
            mainWindow.webContents.send(types_1.IPC.LLM_RESULT, result);
            // Save to history
            const historyEntry = {
                id: (0, uuid_1.v4)(),
                timestamp: Date.now(),
                originalText: text,
                processedText: processed,
                mode: activeMode,
                language: '',
                duration: 0,
                tags: [],
                source: 'dictation',
            };
            historyService.add(historyEntry);
            return result;
        }
        catch (error) {
            mainWindow.webContents.send(types_1.IPC.LLM_STREAM, '\x00END');
            throw error;
        }
    });
    // ===== Injection =====
    ipcMain.handle(types_1.IPC.INJECT_TEXT, async (_event, text) => {
        console.log(`[Injection] Injecting ${text.length} chars: "${text.substring(0, 60)}"`);
        const wasVisible = mainWindow.isVisible();
        // Always hide window before paste — even if not focused, the window may
        // be on top and intercept the xdotool keypress on Linux/X11
        if (wasVisible) {
            mainWindow.hide();
            await new Promise(r => setTimeout(r, 200)); // let OS restore focus to previous app
        }
        await textInjector.injectText(text);
        console.log('[Injection] Done');
        // Restore window after paste
        if (wasVisible) {
            await new Promise(r => setTimeout(r, 150));
            mainWindow.showInactive(); // show without stealing focus
        }
    });
    ipcMain.handle(types_1.IPC.INJECT_CLIPBOARD, async (_event, text) => {
        textInjector.copyToClipboard(text);
    });
    // ===== History =====
    ipcMain.handle(types_1.IPC.HISTORY_GET, (_event, filter) => {
        return historyService.get(filter);
    });
    ipcMain.handle(types_1.IPC.HISTORY_SEARCH, (_event, query) => {
        return historyService.get({ search: query });
    });
    ipcMain.handle(types_1.IPC.HISTORY_DELETE, (_event, id) => {
        historyService.delete(id);
    });
    ipcMain.handle(types_1.IPC.HISTORY_ADD_TAG, (_event, id, tag) => {
        historyService.addTag(id, tag);
    });
    ipcMain.handle(types_1.IPC.HISTORY_REMOVE_TAG, (_event, id, tag) => {
        historyService.removeTag(id, tag);
    });
    ipcMain.handle(types_1.IPC.HISTORY_EXPORT, async (_event, id, format) => {
        const entry = historyService.getById(id);
        if (!entry)
            throw new Error('Entry not found');
        const result = await electron_1.dialog.showSaveDialog(mainWindow, {
            defaultPath: `voiceink-${id.slice(0, 8)}.${format}`,
            filters: [{ name: format.toUpperCase(), extensions: [format] }],
        });
        if (result.canceled || !result.filePath)
            return null;
        return exportService.exportEntry(entry, format, result.filePath);
    });
    // ===== Model Download =====
    ipcMain.handle(types_1.IPC.STT_DOWNLOAD_MODEL, async (_event, model) => {
        try {
            const modelPath = await whisperEngine.downloadModel(model, (progress) => {
                mainWindow.webContents.send(types_1.IPC.STT_MODEL_PROGRESS, progress);
            });
            return modelPath;
        }
        catch (error) {
            throw error;
        }
    });
    // ===== STT Status =====
    ipcMain.handle(types_1.IPC.STT_STATUS, () => {
        return whisperEngine.getModelStatus();
    });
    // ===== Chat =====
    ipcMain.handle(types_1.IPC.CHAT_SEND, async (_event, messages) => {
        try {
            const result = await llmEngine.chatStream(messages, (token) => {
                mainWindow.webContents.send(types_1.IPC.CHAT_STREAM, token);
            });
            return result;
        }
        catch (error) {
            console.error('Chat error:', error);
            throw error;
        }
    });
    // ===== App Controls =====
    ipcMain.on(types_1.IPC.APP_QUIT, () => {
        electron_1.app.quit();
    });
    ipcMain.on(types_1.IPC.APP_MINIMIZE, () => {
        mainWindow.minimize();
    });
    ipcMain.on(types_1.IPC.APP_TOGGLE_RECORDING, () => {
        if (currentRecordingState === 'idle') {
            currentRecordingState = 'recording';
            mainWindow.webContents.send(types_1.IPC.APP_RECORDING_STATE, 'recording');
        }
        else if (currentRecordingState === 'recording') {
            currentRecordingState = 'processing';
            mainWindow.webContents.send(types_1.IPC.APP_RECORDING_STATE, 'processing');
        }
    });
    // ===== Compact Mode =====
    let savedBounds = null;
    ipcMain.handle(types_1.IPC.APP_COMPACT_MODE, (_event, compact, width, height) => {
        if (compact) {
            if (!savedBounds)
                savedBounds = mainWindow.getBounds();
            const display = electron_1.screen.getPrimaryDisplay();
            const { width: screenW } = display.workAreaSize;
            const cw = width || 90;
            const ch = height || 90;
            mainWindow.setMinimumSize(60, 60);
            mainWindow.setResizable(false);
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
            mainWindow.setBounds({ x: Math.round(screenW / 2 - cw / 2), y: 18, width: cw, height: ch });
        }
        else {
            // Panel mode: compact floating panel, still on top
            const pw = width || 340;
            const ph = height || 480;
            mainWindow.setMinimumSize(280, 360);
            mainWindow.setMaximumSize(400, 520);
            mainWindow.setResizable(true);
            mainWindow.setAlwaysOnTop(true, 'floating');
            if (savedBounds) {
                const pos = mainWindow.getPosition();
                mainWindow.setBounds({ x: pos[0], y: pos[1], width: pw, height: ph });
                savedBounds = null;
            }
            else {
                mainWindow.setSize(pw, ph);
            }
        }
        return true;
    });
    // ===== Orb Position Persistence =====
    ipcMain.handle(types_1.IPC.APP_SET_ORB_POSITION, (_event, x, y) => {
        configService.updateSettings({ _orbPosition: { x, y } });
    });
    ipcMain.handle(types_1.IPC.APP_GET_ORB_POSITION, () => {
        const settings = configService.getSettings();
        return settings?._orbPosition || null;
    });
}
function sendPipelineStatus(mainWindow, status) {
    mainWindow.webContents.send(types_1.IPC.APP_PIPELINE_STATUS, status);
}
