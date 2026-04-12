"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortcutManager = void 0;
const electron_1 = require("electron");
const types_1 = require("../shared/types");
class ShortcutManager {
    mainWindow;
    configService;
    reregisterInterval = null;
    isLinux = process.platform === 'linux';
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
        // On Linux/X11, globalShortcut registrations can be silently lost.
        // Periodically re-register to keep them alive.
        this.startPeriodicReregistration();
    }
    /**
     * On Linux, globalShortcut grabs can be lost (X11 focus changes, WM interference, etc).
     * Re-register every 30 seconds to keep shortcuts functional.
     */
    startPeriodicReregistration() {
        if (!this.isLinux)
            return;
        if (this.reregisterInterval)
            clearInterval(this.reregisterInterval);
        this.reregisterInterval = setInterval(() => {
            try {
                // Check if shortcuts are still registered; if not, re-register all
                const settings = this.configService.getSettings();
                const toggleKey = settings.shortcuts.toggleRecording;
                if (toggleKey && !electron_1.globalShortcut.isRegistered(toggleKey)) {
                    console.log('[Shortcut] Linux: toggle shortcut lost, re-registering...');
                    this.doRegister();
                }
            }
            catch {
                // Silently ignore and try next cycle
            }
        }, 30_000);
    }
    /** Register shortcuts without clearing first (used by periodic re-registration). */
    doRegister() {
        const settings = this.configService.getSettings();
        const shortcuts = settings.shortcuts;
        if (shortcuts.toggleRecording) {
            try {
                electron_1.globalShortcut.unregister(shortcuts.toggleRecording);
            }
            catch { /* ignore */ }
            try {
                const ok = electron_1.globalShortcut.register(shortcuts.toggleRecording, () => {
                    console.log('[Shortcut] Toggle recording triggered via globalShortcut');
                    this.mainWindow.webContents.send(types_1.IPC.APP_TOGGLE_RECORDING);
                });
                if (ok) {
                    console.log(`[Shortcut] Re-registered toggle: ${shortcuts.toggleRecording}`);
                }
            }
            catch { /* ignore */ }
        }
        if (shortcuts.cancelRecording) {
            try {
                electron_1.globalShortcut.unregister(shortcuts.cancelRecording);
            }
            catch { /* ignore */ }
            try {
                const ok = electron_1.globalShortcut.register(shortcuts.cancelRecording, () => {
                    console.log('[Shortcut] Cancel recording triggered via globalShortcut');
                    this.mainWindow.webContents.send(types_1.IPC.APP_RECORDING_STATE, 'idle');
                });
                if (ok) {
                    console.log(`[Shortcut] Re-registered cancel: ${shortcuts.cancelRecording}`);
                }
            }
            catch { /* ignore */ }
        }
    }
    unregisterAll() {
        if (this.reregisterInterval) {
            clearInterval(this.reregisterInterval);
            this.reregisterInterval = null;
        }
        electron_1.globalShortcut.unregisterAll();
    }
    updateShortcuts() {
        this.register();
    }
}
exports.ShortcutManager = ShortcutManager;
