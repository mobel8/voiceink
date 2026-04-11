"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortcutManager = void 0;
const electron_1 = require("electron");
const types_1 = require("../shared/types");
class ShortcutManager {
    mainWindow;
    configService;
    constructor(mainWindow, configService) {
        this.mainWindow = mainWindow;
        this.configService = configService;
    }
    register() {
        this.unregisterAll();
        const settings = this.configService.getSettings();
        const shortcuts = settings.shortcuts;
        // Toggle recording shortcut
        if (shortcuts.toggleRecording) {
            try {
                const ok = electron_1.globalShortcut.register(shortcuts.toggleRecording, () => {
                    console.log('[Shortcut] Toggle recording triggered via globalShortcut');
                    this.mainWindow.webContents.send(types_1.IPC.APP_TOGGLE_RECORDING);
                });
                if (ok) {
                    console.log(`[Shortcut] Registered toggle: ${shortcuts.toggleRecording}`);
                }
                else {
                    console.warn(`[Shortcut] Failed to register toggle: ${shortcuts.toggleRecording} (already in use or unsupported)`);
                }
            }
            catch (err) {
                console.error(`[Shortcut] Error registering toggle (${shortcuts.toggleRecording}):`, err);
            }
        }
        // Cancel recording shortcut
        if (shortcuts.cancelRecording) {
            try {
                const ok = electron_1.globalShortcut.register(shortcuts.cancelRecording, () => {
                    console.log('[Shortcut] Cancel recording triggered via globalShortcut');
                    this.mainWindow.webContents.send(types_1.IPC.APP_RECORDING_STATE, 'idle');
                });
                if (ok) {
                    console.log(`[Shortcut] Registered cancel: ${shortcuts.cancelRecording}`);
                }
                else {
                    console.warn(`[Shortcut] Failed to register cancel: ${shortcuts.cancelRecording} (already in use or unsupported)`);
                }
            }
            catch (err) {
                console.error(`[Shortcut] Error registering cancel (${shortcuts.cancelRecording}):`, err);
            }
        }
        console.log('[Shortcut] Registration complete. Note: globalShortcut may not work on WSL2 — in-window fallback is active.');
    }
    unregisterAll() {
        electron_1.globalShortcut.unregisterAll();
    }
    updateShortcuts() {
        this.register();
    }
}
exports.ShortcutManager = ShortcutManager;
