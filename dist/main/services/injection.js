"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyToClipboard = copyToClipboard;
exports.injectText = injectText;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const os_1 = require("os");
const focus_1 = require("./focus");
const win32_1 = require("./win32");
function copyToClipboard(text) {
    electron_1.clipboard.writeText(text);
}
/**
 * Inject text into the target app:
 *   1. Copy text to clipboard.
 *   2. Blur our window(s) so Windows-level focus releases us.
 *   3. On Windows: call `SetForegroundWindow(targetHwnd)` + `keybd_event(Ctrl+V)`
 *      directly via koffi. No child process, no console flash.
 *   4. Fallback to PowerShell only if koffi is unavailable.
 *   5. macOS/Linux: osascript / xdotool.
 *
 * We do NOT restore the previous clipboard: users expect the transcription
 * to remain available for re-pasting.
 */
async function injectText(text) {
    electron_1.clipboard.writeText(text);
    // Blur our windows so focus can move to the target app.
    for (const w of electron_1.BrowserWindow.getAllWindows()) {
        try {
            w.blur();
        }
        catch { }
    }
    const os = (0, os_1.platform)();
    if (os === 'win32') {
        const targetHwnd = (0, focus_1.getLastExternalHwnd)();
        const ok = await sendPasteNative(targetHwnd);
        if (!ok) {
            console.warn('[inject] native path unavailable, using PowerShell fallback');
            await sendPastePowerShell(targetHwnd);
        }
    }
    else if (os === 'darwin') {
        await new Promise((r) => setTimeout(r, 80));
        await new Promise((resolve) => {
            (0, child_process_1.exec)(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`, () => resolve());
        });
    }
    else {
        await new Promise((r) => setTimeout(r, 80));
        await new Promise((resolve) => (0, child_process_1.exec)('xdotool key ctrl+v', () => resolve()));
    }
}
/**
 * Native Windows paste via koffi. Returns true on success, false if
 * koffi is unavailable (caller should fall back).
 *
 * Flow (all synchronous native calls, no process spawn):
 *   1. SetForegroundWindow(hwnd)  —  bring target app to foreground
 *   2. ShowWindow(hwnd, SW_SHOW)  —  in case it was minimised
 *   3. Wait ~40 ms for the OS to commit the focus change
 *   4. keybd_event Ctrl down, V down, V up, Ctrl up  —  delivers Ctrl+V
 *      to the active app (which is now the target).
 *
 * Total latency ~50-80 ms and no visible UI change anywhere.
 */
async function sendPasteNative(hwnd) {
    const w = (0, win32_1.getWin32)();
    if (!w)
        return false;
    const SW_SHOW = 5;
    try {
        if (hwnd) {
            try {
                const h = BigInt(hwnd);
                // Validate still a window (target may have closed between poll and now).
                const valid = w.IsWindow(h);
                if (valid) {
                    // Try to unminimise if needed, then bring to foreground.
                    w.ShowWindow(h, SW_SHOW);
                    const ok = w.SetForegroundWindow(h);
                    if (!ok) {
                        // SetForegroundWindow can fail due to Win32 focus-stealing
                        // prevention. AttachThreadInput trick often works as a
                        // fallback — but is noisy; we just log and proceed. The
                        // paste may still land correctly if the target was already
                        // the foreground (common when using global shortcut).
                        console.log('[inject] SetForegroundWindow returned 0, proceeding anyway');
                    }
                }
            }
            catch (e) {
                console.warn('[inject] foreground restore error:', e?.message || e);
            }
        }
        // Let the OS commit the focus change before sending keystrokes.
        await new Promise((r) => setTimeout(r, 40));
        // Ctrl down, V down, V up, Ctrl up — deliver Ctrl+V.
        w.keybd_event(win32_1.VK.CONTROL, 0, 0, 0);
        w.keybd_event(win32_1.VK.V, 0, 0, 0);
        w.keybd_event(win32_1.VK.V, 0, win32_1.VK.KEYEVENTF_KEYUP, 0);
        w.keybd_event(win32_1.VK.CONTROL, 0, win32_1.VK.KEYEVENTF_KEYUP, 0);
        return true;
    }
    catch (err) {
        console.warn('[inject] native paste error:', err?.message || err);
        return false;
    }
}
/**
 * PowerShell fallback when koffi isn't available. Kept intentionally minimal
 * and with windowsHide — may still produce a brief flash on some systems,
 * which is why the native path is strongly preferred.
 */
function sendPastePowerShell(hwnd) {
    return new Promise((resolve) => {
        const setFg = hwnd
            ? `$null = [VoiceInk.U]::SetForegroundWindow([IntPtr]${hwnd}); Start-Sleep -Milliseconds 60;`
            : 'Start-Sleep -Milliseconds 80;';
        const script = [
            `Add-Type -Namespace VoiceInk -Name U -MemberDefinition '[System.Runtime.InteropServices.DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(System.IntPtr hWnd);' -ErrorAction SilentlyContinue;`,
            `Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue;`,
            setFg,
            `[System.Windows.Forms.SendKeys]::SendWait('^v');`,
        ].join(' ');
        const cmd = `powershell -NoProfile -WindowStyle Hidden -Command "${script}"`;
        (0, child_process_1.exec)(cmd, { windowsHide: true }, (err) => {
            if (err)
                console.warn('[inject] PS fallback error:', err.message);
            resolve();
        });
    });
}
