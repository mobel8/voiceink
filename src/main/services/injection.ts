import { clipboard } from 'electron';

export class TextInjector {
  async injectText(text: string): Promise<void> {
    // Store current clipboard content
    const previousClipboard = clipboard.readText();

    // Set new text to clipboard
    clipboard.writeText(text);

    // Simulate Ctrl+V (or Cmd+V on Mac) to paste
    await this.simulatePaste();

    // Restore previous clipboard after a delay
    setTimeout(() => {
      clipboard.writeText(previousClipboard);
    }, 500);
  }

  private async simulatePaste(): Promise<void> {
    // Use platform-specific paste simulation
    const platform = process.platform;

    if (platform === 'win32') {
      await this.simulatePasteWindows();
    } else if (platform === 'darwin') {
      await this.simulatePasteMac();
    } else {
      await this.simulatePasteLinux();
    }
  }

  private async simulatePasteWindows(): Promise<void> {
    // Use PowerShell to simulate Ctrl+V
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(
        'powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"',
        (error: any) => {
          if (error) {
            console.error('Paste simulation failed:', error);
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });
  }

  private async simulatePasteMac(): Promise<void> {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(
        'osascript -e \'tell application "System Events" to keystroke "v" using command down\'',
        (error: any) => {
          if (error) {
            console.error('Paste simulation failed:', error);
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });
  }

  private async simulatePasteLinux(): Promise<void> {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec('xdotool key ctrl+v', (error: any) => {
        if (error) {
          console.error('Paste simulation failed:', error);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  copyToClipboard(text: string): void {
    clipboard.writeText(text);
  }
}
