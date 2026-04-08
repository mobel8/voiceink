import { globalShortcut, BrowserWindow } from 'electron';
import { ConfigService } from './services/config';
import { IPC } from '../shared/types';

export class ShortcutManager {
  private mainWindow: BrowserWindow;
  private configService: ConfigService;

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

    // Push-to-talk shortcut
    if (shortcuts.pushToTalk) {
      try {
        const ok = globalShortcut.register(shortcuts.pushToTalk, () => {
          console.log('[Shortcut] Push-to-talk triggered via globalShortcut');
          this.mainWindow.webContents.send(IPC.APP_TOGGLE_RECORDING);
        });
        if (ok) {
          console.log(`[Shortcut] Registered push-to-talk: ${shortcuts.pushToTalk}`);
        } else {
          console.warn(`[Shortcut] Failed to register push-to-talk: ${shortcuts.pushToTalk}`);
        }
      } catch (err) {
        console.error(`[Shortcut] Error registering push-to-talk (${shortcuts.pushToTalk}):`, err);
      }
    }

    console.log('[Shortcut] Registration complete. Note: globalShortcut may not work on WSL2 — in-window fallback is active.');
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll();
  }

  updateShortcuts(): void {
    this.register();
  }
}
