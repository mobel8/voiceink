import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron';
import * as path from 'path';
import { ConfigService } from './services/config';

export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow;
  private configService: ConfigService;

  constructor(mainWindow: BrowserWindow, configService: ConfigService) {
    this.mainWindow = mainWindow;
    this.configService = configService;
  }

  create(): void {
    const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
    let icon: Electron.NativeImage;
    try {
      icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        icon = nativeImage.createEmpty();
      }
    } catch {
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('VoiceInk - Dictée Intelligente');
    this.updateMenu();

    this.tray.on('click', () => {
      if (this.mainWindow.isVisible()) {
        this.mainWindow.hide();
      } else {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });
  }

  updateMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
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
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  setRecording(isRecording: boolean): void {
    if (this.tray) {
      this.tray.setToolTip(
        isRecording ? 'VoiceInk - Enregistrement en cours...' : 'VoiceInk - Dictée Intelligente'
      );
    }
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
