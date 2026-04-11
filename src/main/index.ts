import { app, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron';
import * as path from 'path';
import { TrayManager } from './tray';
import { ShortcutManager } from './shortcuts';
import { registerIpcHandlers } from './ipc';
import { IPC } from '../shared/types';
import { ConfigService } from './services/config';
import { HistoryService } from './services/history';
import { WhisperEngine } from './engines/whisper';
import { LLMEngine } from './engines/llm';
import { TextInjector } from './services/injection';
import { ExportService } from './services/export';

let mainWindow: BrowserWindow | null = null;
let trayManager: TrayManager | null = null;
let shortcutManager: ShortcutManager | null = null;

const configService = new ConfigService();
const historyService = new HistoryService();
const whisperEngine = new WhisperEngine(configService);
const llmEngine = new LLMEngine(configService);
const textInjector = new TextInjector();
const exportService = new ExportService();

const isDev = !app.isPackaged && process.env.VOICEINK_DEV === '1';

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 400,
    minHeight: 600,
    frame: false,
    transparent: true,
    resizable: true,
    show: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  // Auto-grant microphone permission for speech recognition
  win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'microphone', 'audioCapture'].includes(permission);
    callback(allowed);
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // In-window keyboard shortcut fallback (works even when globalShortcut fails on WSL2/Linux)
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return;

    // Toggle recording: Ctrl+Shift+Space
    if (input.control && input.shift && (input.key === ' ' || input.key === 'Space' || input.code === 'Space')) {
      console.log('[Shortcut] Toggle recording via before-input-event fallback');
      win.webContents.send(IPC.APP_TOGGLE_RECORDING);
    }

    // Cancel recording: Escape
    if (input.key === 'Escape') {
      console.log('[Shortcut] Cancel recording via before-input-event fallback');
      win.webContents.send(IPC.APP_RECORDING_STATE, 'idle');
    }
  });

  win.once('ready-to-show', () => {
    console.log('[Window] ready-to-show fired');
    const settings = configService.getSettings();
    if (!settings.ui.startMinimized) {
      win.show();
      win.focus();
      console.log('[Window] show() called');
    } else {
      console.log('[Window] startMinimized is true, skipping show');
    }
  });

  // Fallback: if ready-to-show never fires after 5s, force show
  setTimeout(() => {
    if (win && !win.isDestroyed() && !win.isVisible()) {
      console.log('[Window] FALLBACK: forcing show after 5s timeout');
      win.show();
      win.focus();
    }
  }, 5000);

  // Log renderer errors
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error(`[Window] did-fail-load: ${code} ${desc}`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[Window] render-process-gone:', details);
  });
  win.webContents.on('did-finish-load', () => {
    console.log('[Window] did-finish-load OK');
  });

  win.on('close', (e) => {
    const settings = configService.getSettings();
    if (settings.ui.minimizeToTray) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

app.whenReady().then(async () => {
  mainWindow = createMainWindow();

  trayManager = new TrayManager(mainWindow, configService);
  shortcutManager = new ShortcutManager(mainWindow, configService);

  registerIpcHandlers(
    ipcMain,
    mainWindow,
    configService,
    historyService,
    whisperEngine,
    llmEngine,
    textInjector,
    exportService
  );

  shortcutManager.register();
  trayManager.create();

  await historyService.initialize();
  await whisperEngine.initialize();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    mainWindow = createMainWindow();
  } else {
    mainWindow.show();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  historyService.close();
  whisperEngine.cleanup(); // stops server + clears state
});

app.on('before-quit', () => {
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
});
