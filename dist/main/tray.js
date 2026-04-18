"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTray = createTray;
const electron_1 = require("electron");
const path_1 = require("path");
const fs_1 = require("fs");
const types_1 = require("../shared/types");
let tray = null;
function createTray(getWin) {
    const iconPath = resolveIconPath();
    let image;
    try {
        image = electron_1.nativeImage.createFromPath(iconPath);
        if (image.isEmpty())
            image = electron_1.nativeImage.createEmpty();
    }
    catch {
        image = electron_1.nativeImage.createEmpty();
    }
    tray = new electron_1.Tray(image);
    tray.setToolTip('VoiceInk — Dictée IA');
    const menu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Afficher VoiceInk',
            click: () => {
                const w = getWin();
                if (w) {
                    w.show();
                    w.focus();
                }
            },
        },
        {
            label: 'Démarrer / Arrêter dictée',
            click: () => {
                const w = getWin();
                // Do not show/focus the window: otherwise the auto-injection paste
                // would land in VoiceInk itself instead of the user's current app.
                if (w)
                    w.webContents.send(types_1.IPC.ON_TOGGLE_RECORDING);
            },
        },
        { type: 'separator' },
        {
            label: 'Quitter',
            click: () => {
                electron_1.app.isQuitting = true;
                electron_1.app.quit();
            },
        },
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => {
        const w = getWin();
        if (!w)
            return;
        if (w.isVisible())
            w.hide();
        else {
            w.show();
            w.focus();
        }
    });
    return tray;
}
function resolveIconPath() {
    const candidates = [
        (0, path_1.join)(process.resourcesPath || '', 'assets', 'icon.png'),
        (0, path_1.join)(__dirname, '..', '..', 'assets', 'icon.png'),
        (0, path_1.join)(__dirname, '..', '..', 'assets', 'icon.svg'),
        (0, path_1.join)(process.cwd(), 'assets', 'icon.png'),
        (0, path_1.join)(process.cwd(), 'assets', 'icon.svg'),
    ];
    for (const c of candidates) {
        if (c && (0, fs_1.existsSync)(c))
            return c;
    }
    return '';
}
