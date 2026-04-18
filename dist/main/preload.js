"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * IPC channel names. Must stay in sync with `src/shared/types.ts::IPC`.
 * We duplicate them here because the preload runs in a sandbox that
 * cannot resolve local modules.
 */
const IPC = {
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
const api = {
    getSettings: () => electron_1.ipcRenderer.invoke(IPC.GET_SETTINGS),
    setSettings: (patch) => electron_1.ipcRenderer.invoke(IPC.SET_SETTINGS, patch),
    transcribe: (req) => electron_1.ipcRenderer.invoke(IPC.TRANSCRIBE, req),
    getHistory: () => electron_1.ipcRenderer.invoke(IPC.GET_HISTORY),
    deleteHistory: (id) => electron_1.ipcRenderer.invoke(IPC.DELETE_HISTORY, id),
    clearHistory: () => electron_1.ipcRenderer.invoke(IPC.CLEAR_HISTORY),
    togglePinHistory: (id) => electron_1.ipcRenderer.invoke(IPC.TOGGLE_PIN_HISTORY, id),
    exportHistory: (format) => electron_1.ipcRenderer.invoke(IPC.EXPORT_HISTORY, format),
    getUsageStats: () => electron_1.ipcRenderer.invoke(IPC.GET_USAGE_STATS),
    setAutoStart: (enabled) => electron_1.ipcRenderer.invoke(IPC.SET_AUTO_START, enabled),
    copyText: (text) => electron_1.ipcRenderer.invoke(IPC.COPY_TEXT, text),
    injectText: (text) => electron_1.ipcRenderer.invoke(IPC.INJECT_TEXT, text),
    onToggleRecording: (cb) => {
        const listener = () => cb();
        electron_1.ipcRenderer.on(IPC.ON_TOGGLE_RECORDING, listener);
        return () => electron_1.ipcRenderer.removeListener(IPC.ON_TOGGLE_RECORDING, listener);
    },
    onPttDown: (cb) => {
        const listener = () => cb();
        electron_1.ipcRenderer.on(IPC.ON_PTT_DOWN, listener);
        return () => electron_1.ipcRenderer.removeListener(IPC.ON_PTT_DOWN, listener);
    },
    onPttUp: (cb) => {
        const listener = () => cb();
        electron_1.ipcRenderer.on(IPC.ON_PTT_UP, listener);
        return () => electron_1.ipcRenderer.removeListener(IPC.ON_PTT_UP, listener);
    },
    windowMinimize: () => electron_1.ipcRenderer.invoke(IPC.WINDOW_MINIMIZE),
    windowMaximize: () => electron_1.ipcRenderer.invoke(IPC.WINDOW_MAXIMIZE),
    windowClose: () => electron_1.ipcRenderer.invoke(IPC.WINDOW_CLOSE),
    windowSetAlwaysOnTop: (enabled) => electron_1.ipcRenderer.invoke(IPC.WINDOW_SET_ALWAYS_ON_TOP, enabled),
    windowResizeForDensity: (density) => electron_1.ipcRenderer.invoke(IPC.WINDOW_RESIZE_FOR_DENSITY, density),
    showWidgetContextMenu: () => electron_1.ipcRenderer.invoke(IPC.WIDGET_CONTEXT_MENU),
    onOpenSettings: (cb) => {
        const listener = () => cb();
        electron_1.ipcRenderer.on('voiceink:openSettings', listener);
        return () => electron_1.ipcRenderer.removeListener('voiceink:openSettings', listener);
    },
    log: (...args) => electron_1.ipcRenderer.invoke(IPC.LOG, ...args),
    /**
     * Fire-and-forget "renderer has rendered its first real frame" signal.
     * Main process uses this to gate window-visibility swaps during a
     * density hot-swap, so the new window never appears while it's still
     * painting the (possibly wrong-for-its-size) shell frame.
     */
    rendererReady: () => electron_1.ipcRenderer.send('voiceink:renderer-ready'),
};
electron_1.contextBridge.exposeInMainWorld('voiceink', api);
