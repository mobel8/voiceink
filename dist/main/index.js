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
const electron_1 = require("electron");
const path = __importStar(require("path"));
const tray_1 = require("./tray");
const shortcuts_1 = require("./shortcuts");
const ipc_1 = require("./ipc");
const types_1 = require("../shared/types");
const config_1 = require("./services/config");
const history_1 = require("./services/history");
const whisper_1 = require("./engines/whisper");
const llm_1 = require("./engines/llm");
const injection_1 = require("./services/injection");
const export_1 = require("./services/export");
let mainWindow = null;
let trayManager = null;
let shortcutManager = null;
const configService = new config_1.ConfigService();
const historyService = new history_1.HistoryService();
const whisperEngine = new whisper_1.WhisperEngine(configService);
const llmEngine = new llm_1.LLMEngine(configService);
const textInjector = new injection_1.TextInjector();
const exportService = new export_1.ExportService();
const isDev = !electron_1.app.isPackaged && process.env.VOICEINK_DEV === '1';
function createMainWindow() {
    const win = new electron_1.BrowserWindow({
        width: 90,
        height: 90,
        minWidth: 60,
        minHeight: 60,
        frame: false,
        transparent: true,
        resizable: false,
        show: false,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
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
    }
    else {
        win.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
    // In-window keyboard shortcut fallback (works even when globalShortcut fails on WSL2/Linux)
    win.webContents.on('before-input-event', (_event, input) => {
        if (input.type !== 'keyDown')
            return;
        // Toggle recording: Ctrl+Shift+Space
        if (input.control && input.shift && (input.key === ' ' || input.key === 'Space' || input.code === 'Space')) {
            console.log('[Shortcut] Toggle recording via before-input-event fallback');
            win.webContents.send(types_1.IPC.APP_TOGGLE_RECORDING);
        }
        // Cancel recording: Escape
        if (input.key === 'Escape') {
            console.log('[Shortcut] Cancel recording via before-input-event fallback');
            win.webContents.send(types_1.IPC.APP_RECORDING_STATE, 'idle');
        }
    });
    win.once('ready-to-show', () => {
        console.log('[Window] ready-to-show fired');
        const settings = configService.getSettings();
        if (!settings.ui.startMinimized) {
            win.show();
            win.focus();
            console.log('[Window] show() called');
        }
        else {
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
electron_1.app.whenReady().then(async () => {
    mainWindow = createMainWindow();
    trayManager = new tray_1.TrayManager(mainWindow, configService);
    shortcutManager = new shortcuts_1.ShortcutManager(mainWindow, configService);
    (0, ipc_1.registerIpcHandlers)(electron_1.ipcMain, mainWindow, configService, historyService, whisperEngine, llmEngine, textInjector, exportService);
    shortcutManager.register();
    trayManager.create();
    await historyService.initialize();
    await whisperEngine.initialize();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        mainWindow = createMainWindow();
    }
    else {
        mainWindow.show();
    }
});
electron_1.app.on('will-quit', () => {
    electron_1.globalShortcut.unregisterAll();
    historyService.close();
    whisperEngine.cleanup(); // stops server + clears state
});
electron_1.app.on('before-quit', () => {
    if (mainWindow) {
        mainWindow.removeAllListeners('close');
        mainWindow.close();
    }
});
