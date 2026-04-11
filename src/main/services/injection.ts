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

  private async isTerminalFocused(): Promise<boolean> {
    const { execSync } = require('child_process');
    const terminalClasses = [
      'xterm', 'xterm-256color', 'gnome-terminal', 'gnome-terminal-server',
      'konsole', 'terminator', 'tilix', 'alacritty', 'kitty', 'st', 'urxvt',
      'rxvt', 'mate-terminal', 'xfce4-terminal', 'lxterminal', 'guake',
      'yakuake', 'hyper', 'wezterm', 'foot', 'terminology',
    ];
    try {
      // Step 1: get active window ID
      const winId = execSync('xdotool getactivewindow 2>/dev/null', { timeout: 1000 })
        .toString().trim();
      if (!winId) return false;

      // Step 2: get window class via xprop (more reliable than xdotool chained)
      const xpropOut = execSync(`xprop -id ${winId} WM_CLASS 2>/dev/null`, { timeout: 1000 })
        .toString().toLowerCase();
      console.log(`[Injection] Active window class: ${xpropOut.trim()}`);
      return terminalClasses.some((t) => xpropOut.includes(t));
    } catch {
      return false;
    }
  }

  private async simulatePasteLinux(): Promise<void> {
    const { exec } = require('child_process');

    // Terminals use Ctrl+Shift+V, everything else uses Ctrl+V
    const isTerminal = await this.isTerminalFocused();
    const pasteKey = isTerminal ? 'ctrl+shift+v' : 'ctrl+v';
    console.log(`[Injection] Paste key: ${pasteKey} (terminal: ${isTerminal})`);

    const tools = [
      `xdotool key ${pasteKey}`,
      'ydotool key 29:1 47:1 47:0 29:0',
      'xte "keydown Control_L" "key v" "keyup Control_L"',
    ];

    for (const cmd of tools) {
      const ok = await new Promise<boolean>((resolve) => {
        exec(cmd, (error: any) => resolve(!error));
      });
      if (ok) return;
    }

    console.log('[Injection] Auto-paste unavailable. Text copied to clipboard — press Ctrl+V to paste.');
  }

  copyToClipboard(text: string): void {
    clipboard.writeText(text);
  }
}
