import { globalShortcut, BrowserWindow } from 'electron';
import { IPC } from '../shared/types';
import { getSettings } from './services/config';

let registered: string[] = [];

/**
 * Fire the toggle event to the renderer, making the window visible first
 * (without stealing focus) if it was hidden.
 */
function fireToggle(getWin: () => BrowserWindow | null): void {
  const w = getWin();
  if (!w) return;
  if (!w.isVisible()) {
    try { w.showInactive(); } catch {}
  }
  w.webContents.send(IPC.ON_TOGGLE_RECORDING);
}

/**
 * Register the configured global shortcuts.
 *
 * NOTE on Push-to-Talk: Electron's `globalShortcut` does NOT emit key-up
 * events on Windows. A true "hold to talk, release to stop" needs either a
 * low-level keyboard hook (native, complex) or a separate PTT-specific
 * mechanism. For now PTT is registered as a second accelerator that also
 * toggles — giving the user an alternative hotkey they can bind to a
 * different key (e.g. a macro pad button) without conflicting with the
 * primary toggle. If/when we add a real PTT via native hook, we'll fire
 * `ON_PTT_DOWN` / `ON_PTT_UP` from there.
 */
export function registerShortcuts(getWin: () => BrowserWindow | null): void {
  unregisterShortcuts();
  const s = getSettings();

  try {
    if (s.shortcutToggle) {
      const ok = globalShortcut.register(s.shortcutToggle, () => fireToggle(getWin));
      if (ok) registered.push(s.shortcutToggle);
      else console.warn('[shortcuts] toggle registration refused (key in use?):', s.shortcutToggle);
    }
  } catch (e) {
    console.warn('[shortcuts] failed to register toggle:', e);
  }

  try {
    if (s.pttEnabled && s.shortcutPTT && s.shortcutPTT !== s.shortcutToggle) {
      const ok = globalShortcut.register(s.shortcutPTT, () => fireToggle(getWin));
      if (ok) registered.push(s.shortcutPTT);
      else console.warn('[shortcuts] PTT registration refused (key in use?):', s.shortcutPTT);
    }
  } catch (e) {
    console.warn('[shortcuts] failed to register PTT:', e);
  }
}

export function unregisterShortcuts(): void {
  for (const acc of registered) {
    try { globalShortcut.unregister(acc); } catch {}
  }
  registered = [];
}
