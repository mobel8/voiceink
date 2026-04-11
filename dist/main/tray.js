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
exports.TrayManager = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
class TrayManager {
    tray = null;
    mainWindow;
    configService;
    constructor(mainWindow, configService) {
        this.mainWindow = mainWindow;
        this.configService = configService;
    }
    create() {
        const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
        let icon;
        try {
            icon = electron_1.nativeImage.createFromPath(iconPath);
            if (icon.isEmpty()) {
                icon = electron_1.nativeImage.createEmpty();
            }
        }
        catch {
            icon = electron_1.nativeImage.createEmpty();
        }
        this.tray = new electron_1.Tray(icon);
        this.tray.setToolTip('VoiceInk - Dictée Intelligente');
        this.updateMenu();
        this.tray.on('click', () => {
            if (this.mainWindow.isVisible()) {
                this.mainWindow.hide();
            }
            else {
                this.mainWindow.show();
                this.mainWindow.focus();
            }
        });
    }
    updateMenu() {
        if (!this.tray)
            return;
        const contextMenu = electron_1.Menu.buildFromTemplate([
            {
                label: 'Afficher VoiceInk',
                click: () => {
                    this.mainWindow.show();
                    this.mainWindow.focus();
                },
            },
            { type: 'separator' },
            {
                label: '🎙️ Démarrer la dictée',
                click: () => {
                    this.mainWindow.webContents.send('app:toggle-recording');
                },
            },
            { type: 'separator' },
            {
                label: 'Paramètres',
                click: () => {
                    this.mainWindow.show();
                    this.mainWindow.webContents.send('navigate', 'settings');
                },
            },
            {
                label: 'Historique',
                click: () => {
                    this.mainWindow.show();
                    this.mainWindow.webContents.send('navigate', 'history');
                },
            },
            { type: 'separator' },
            {
                label: 'Quitter',
                click: () => {
                    this.mainWindow.removeAllListeners('close');
                    electron_1.app.quit();
                },
            },
        ]);
        this.tray.setContextMenu(contextMenu);
    }
    setRecording(isRecording) {
        if (this.tray) {
            this.tray.setToolTip(isRecording ? 'VoiceInk - Enregistrement en cours...' : 'VoiceInk - Dictée Intelligente');
        }
    }
    destroy() {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
    }
}
exports.TrayManager = TrayManager;
