"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const types_1 = require("../shared/types");
const api = {
    // Audio
    getAudioDevices: () => electron_1.ipcRenderer.invoke(types_1.IPC.AUDIO_DEVICES),
    startAudio: () => electron_1.ipcRenderer.invoke(types_1.IPC.AUDIO_START),
    stopAudio: () => electron_1.ipcRenderer.invoke(types_1.IPC.AUDIO_STOP),
    onAudioLevel: (cb) => {
        const handler = (_, level) => cb(level);
        electron_1.ipcRenderer.on(types_1.IPC.AUDIO_LEVEL, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.AUDIO_LEVEL, handler);
    },
    // STT
    transcribe: (audioData, language) => electron_1.ipcRenderer.invoke(types_1.IPC.STT_TRANSCRIBE, audioData, language),
    transcribeFileSTT: (filePath) => electron_1.ipcRenderer.invoke(types_1.IPC.STT_TRANSCRIBE_FILE, filePath),
    onSTTResult: (cb) => {
        const handler = (_, result) => cb(result);
        electron_1.ipcRenderer.on(types_1.IPC.STT_RESULT, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.STT_RESULT, handler);
    },
    onSTTPartial: (cb) => {
        const handler = (_, text) => cb(text);
        electron_1.ipcRenderer.on(types_1.IPC.STT_PARTIAL, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.STT_PARTIAL, handler);
    },
    onSTTStatus: (cb) => {
        const handler = (_, status) => cb(status);
        electron_1.ipcRenderer.on(types_1.IPC.STT_STATUS, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.STT_STATUS, handler);
    },
    downloadModel: (model) => electron_1.ipcRenderer.invoke(types_1.IPC.STT_DOWNLOAD_MODEL, model),
    onModelProgress: (cb) => {
        const handler = (_, progress) => cb(progress);
        electron_1.ipcRenderer.on(types_1.IPC.STT_MODEL_PROGRESS, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.STT_MODEL_PROGRESS, handler);
    },
    // LLM
    processText: (text, mode, targetLang) => electron_1.ipcRenderer.invoke(types_1.IPC.LLM_PROCESS, text, mode, targetLang),
    onLLMResult: (cb) => {
        const handler = (_, result) => cb(result);
        electron_1.ipcRenderer.on(types_1.IPC.LLM_RESULT, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.LLM_RESULT, handler);
    },
    onLLMStream: (cb) => {
        const handler = (_, chunk) => cb(chunk);
        electron_1.ipcRenderer.on(types_1.IPC.LLM_STREAM, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.LLM_STREAM, handler);
    },
    onLLMStatus: (cb) => {
        const handler = (_, status) => cb(status);
        electron_1.ipcRenderer.on(types_1.IPC.LLM_STATUS, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.LLM_STATUS, handler);
    },
    // Injection
    injectText: (text) => electron_1.ipcRenderer.invoke(types_1.IPC.INJECT_TEXT, text),
    copyToClipboard: (text) => electron_1.ipcRenderer.invoke(types_1.IPC.INJECT_CLIPBOARD, text),
    // History
    getHistory: (filter) => electron_1.ipcRenderer.invoke(types_1.IPC.HISTORY_GET, filter),
    searchHistory: (query) => electron_1.ipcRenderer.invoke(types_1.IPC.HISTORY_SEARCH, query),
    deleteHistory: (id) => electron_1.ipcRenderer.invoke(types_1.IPC.HISTORY_DELETE, id),
    exportHistory: (id, format) => electron_1.ipcRenderer.invoke(types_1.IPC.HISTORY_EXPORT, id, format),
    addTag: (id, tag) => electron_1.ipcRenderer.invoke(types_1.IPC.HISTORY_ADD_TAG, id, tag),
    removeTag: (id, tag) => electron_1.ipcRenderer.invoke(types_1.IPC.HISTORY_REMOVE_TAG, id, tag),
    // Settings
    getSettings: () => electron_1.ipcRenderer.invoke(types_1.IPC.SETTINGS_GET),
    setSettings: (settings) => electron_1.ipcRenderer.invoke(types_1.IPC.SETTINGS_SET, settings),
    resetSettings: () => electron_1.ipcRenderer.invoke(types_1.IPC.SETTINGS_RESET),
    // App
    quit: () => electron_1.ipcRenderer.send(types_1.IPC.APP_QUIT),
    minimize: () => electron_1.ipcRenderer.send(types_1.IPC.APP_MINIMIZE),
    toggleRecording: () => electron_1.ipcRenderer.send(types_1.IPC.APP_TOGGLE_RECORDING),
    setCompactMode: (compact, width, height) => electron_1.ipcRenderer.invoke(types_1.IPC.APP_COMPACT_MODE, compact, width, height),
    setOrbPosition: (x, y) => electron_1.ipcRenderer.invoke(types_1.IPC.APP_SET_ORB_POSITION, x, y),
    getOrbPosition: () => electron_1.ipcRenderer.invoke(types_1.IPC.APP_GET_ORB_POSITION),
    onToggleRecording: (cb) => {
        const handler = () => cb();
        electron_1.ipcRenderer.on(types_1.IPC.APP_TOGGLE_RECORDING, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.APP_TOGGLE_RECORDING, handler);
    },
    onRecordingState: (cb) => {
        const handler = (_, state) => cb(state);
        electron_1.ipcRenderer.on(types_1.IPC.APP_RECORDING_STATE, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.APP_RECORDING_STATE, handler);
    },
    onPipelineStatus: (cb) => {
        const handler = (_, status) => cb(status);
        electron_1.ipcRenderer.on(types_1.IPC.APP_PIPELINE_STATUS, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.APP_PIPELINE_STATUS, handler);
    },
    // Chat
    sendChat: (messages) => electron_1.ipcRenderer.invoke(types_1.IPC.CHAT_SEND, messages),
    onChatStream: (cb) => {
        const handler = (_, token) => cb(token);
        electron_1.ipcRenderer.on(types_1.IPC.CHAT_STREAM, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.CHAT_STREAM, handler);
    },
    // File
    openFile: () => electron_1.ipcRenderer.invoke(types_1.IPC.FILE_OPEN),
    transcribeFile: (filePath) => electron_1.ipcRenderer.invoke(types_1.IPC.FILE_TRANSCRIBE, filePath),
    exportFile: (id, format, outputPath) => electron_1.ipcRenderer.invoke(types_1.IPC.FILE_EXPORT, id, format, outputPath),
};
electron_1.contextBridge.exposeInMainWorld('voiceink', api);
