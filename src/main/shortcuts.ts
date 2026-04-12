import { globalShortcut, BrowserWindow } from 'electron';
import { ConfigService } from './services/config';
import { IPC } from '../shared/types';

export class ShortcutManager {
  private mainWindow: BrowserWindow;
  private configService: ConfigService;
  private reregisterInterval: ReturnType<typeof setInterval> | null = null;
  private isLinux = process.platform === 'linux';

  constructor(mainWindow: BrowserWindow, configService: ConfigService) {
    this.mainWindow = mainWindow;
    this.configService = configService;
  }

  register(): void {
    this.unregisterAll();
    const settings = this.configService.getSettings();
    const shortcuts = settings.shortcuts;

    // Toggle recording shortcut
    if (shortcuts.toggleRecording) {
      try {
        const ok = globalShortcut.register(shortcuts.toggleRecording, () => {
          console.log('[Shortcut] Toggle recording triggered via globalShortcut');
          this.mainWindow.webContents.send(IPC.APP_TOGGLE_RECORDING);
        });
        if (ok) {
          console.log(`[Shortcut] Registered toggle: ${shortcuts.toggleRecording}`);
        } else {
          console.warn(`[Shortcut] Failed to register toggle: ${shortcuts.toggleRecording} (already in use or unsupported)`);
        }
      } catch (err) {
        console.error(`[Shortcut] Error registering toggle (${shortcuts.toggleRecording}):`, err);
      }
    }

    // Cancel recording shortcut
    if (shortcuts.cancelRecording) {
      try {
        const ok = globalShortcut.register(shortcuts.cancelRecording, () => {
          console.log('[Shortcut] Cancel recording triggered via globalShortcut');
          this.mainWindow.webContents.send(IPC.APP_RECORDING_STATE, 'idle');
        });
        if (ok) {
          console.log(`[Shortcut] Registered cancel: ${shortcuts.cancelRecording}`);
        } else {
          console.warn(`[Shortcut] Failed to register cancel: ${shortcuts.cancelRecording} (already in use or unsupported)`);
        }
      } catch (err) {
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
  private startPeriodicReregistration(): void {
    if (!this.isLinux) return;
    if (this.reregisterInterval) clearInterval(this.reregisterInterval);

    this.reregisterInterval = setInterval(() => {
      try {
        // Check if shortcuts are still registered; if not, re-register all
        const settings = this.configService.getSettings();
        const toggleKey = settings.shortcuts.toggleRecording;
        if (toggleKey && !globalShortcut.isRegistered(toggleKey)) {
          console.log('[Shortcut] Linux: toggle shortcut lost, re-registering...');
          this.doRegister();
        }
      } catch {
        // Silently ignore and try next cycle
      }
    }, 30_000);
  }

  /** Register shortcuts without clearing first (used by periodic re-registration). */
  private doRegister(): void {
    const settings = this.configService.getSettings();
    const shortcuts = settings.shortcuts;

    if (shortcuts.toggleRecording) {
      try {
        globalShortcut.unregister(shortcuts.toggleRecording);
      } catch { /* ignore */ }
      try {
        const ok = globalShortcut.register(shortcuts.toggleRecording, () => {
          console.log('[Shortcut] Toggle recording triggered via globalShortcut');
          this.mainWindow.webContents.send(IPC.APP_TOGGLE_RECORDING);
        });
        if (ok) {
          console.log(`[Shortcut] Re-registered toggle: ${shortcuts.toggleRecording}`);
        }
      } catch { /* ignore */ }
    }

    if (shortcuts.cancelRecording) {
      try {
        globalShortcut.unregister(shortcuts.cancelRecording);
      } catch { /* ignore */ }
      try {
        const ok = globalShortcut.register(shortcuts.cancelRecording, () => {
          console.log('[Shortcut] Cancel recording triggered via globalShortcut');
          this.mainWindow.webContents.send(IPC.APP_RECORDING_STATE, 'idle');
        });
        if (ok) {
          console.log(`[Shortcut] Re-registered cancel: ${shortcuts.cancelRecording}`);
        }
      } catch { /* ignore */ }
    }
  }

  unregisterAll(): void {
    if (this.reregisterInterval) {
      clearInterval(this.reregisterInterval);
      this.reregisterInterval = null;
    }
    globalShortcut.unregisterAll();
  }

  updateShortcuts(): void {
    this.register();
  }
}
