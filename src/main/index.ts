import { app, BrowserWindow, ipcMain, Menu, screen, shell } from 'electron';
import { join } from 'path';
import { IPC, Density } from '../shared/types';
import { registerIpc } from './ipc';
import { registerShortcuts, unregisterShortcuts } from './shortcuts';
import { createTray } from './tray';
import {
  initFocusTracking,
  stopFocusTracking,
  registerOwnWindow,
  unregisterOwnWindow,
} from './services/focus';
import { getSettings, setSettings } from './services/config';

/**
 * Wraps an Electron BrowserWindow with the density it was built for and
 * per-instance state we want to clean up deterministically (e.g. the pill
 * move-debounce timer, a `disposed` flag so stale callbacks no-op).
 *
 * We keep a single `current` reference so the rest of the codebase can
 * always obtain "the" main window via `getWin()`, but during a density
 * swap we can legitimately have two contexts alive for a handful of
 * frames — the old one being torn down, the new one being shown.
 */
interface WindowCtx {
  win: BrowserWindow;
  density: Density;
  pillMoveTimer: NodeJS.Timeout | null;
  disposed: boolean;
}

let current: WindowCtx | null = null;
/** Serialises density swaps so overlapping clicks can't race each other. */
let swapInFlight: Promise<void> | null = null;

const isDev = !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL;
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

// Comfortable (main) window defaults.
const COMFORTABLE = { w: 1180, h: 760, minW: 880, minH: 560 };

// Compact pill widget — small floating badge (Superwhisper-style).
// 176x52 is generous enough for mic + status/waveform + expand button while
// staying very discreet.
const WIDGET = { w: 176, h: 52 };

function getWin(): BrowserWindow | null {
  return current && !current.win.isDestroyed() ? current.win : null;
}

/**
 * Compute the default pill position: centered horizontally, near the top of
 * the primary display (matches Superwhisper's placement). Used on first
 * launch when no `widgetBounds` has been persisted yet.
 */
function defaultPillPosition(): { x: number; y: number } {
  try {
    const primary = screen.getPrimaryDisplay();
    const { x, y, width } = primary.workArea;
    return { x: x + Math.round((width - WIDGET.w) / 2), y: y + 24 };
  } catch {
    return { x: 100, y: 40 };
  }
}

/**
 * Clamp the pill position inside the union of all displays' work areas so
 * we never spawn it off-screen (e.g. after the user unplugged a monitor).
 */
function clampToDisplays(x: number, y: number): { x: number; y: number } {
  try {
    const displays = screen.getAllDisplays();
    const onScreen = displays.some((d) => {
      const a = d.workArea;
      return x >= a.x - 40 && y >= a.y - 40 && x + WIDGET.w <= a.x + a.width + 40 && y + WIDGET.h <= a.y + a.height + 40;
    });
    if (onScreen) return { x, y };
  } catch {}
  return defaultPillPosition();
}

/**
 * Build a hidden BrowserWindow wired for the given density. No renderer
 * content is loaded here — the caller chooses between `loadRenderer()` and
 * immediate `show()` depending on whether this is the first window or a
 * background pre-build for a hot density swap.
 */
function buildWindow(density: Density): WindowCtx {
  const s = getSettings();

  // Defense-in-depth webPreferences. Order matters: even if one flag is
  // mis-set in the future, the others still protect the app.
  //   - contextIsolation + sandbox isolate the renderer from Node.
  //   - webSecurity enables SOP/CSP enforcement.
  //   - webviewTag is off because we never embed <webview>.
  //   - allowRunningInsecureContent, experimentalFeatures off.
  const commonWebPrefs: Electron.WebPreferences = {
    preload: join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    webviewTag: false,
    spellcheck: false,
  };

  let win: BrowserWindow;
  if (density === 'compact') {
    const pos = s.widgetBounds ? clampToDisplays(s.widgetBounds.x, s.widgetBounds.y) : defaultPillPosition();
    win = new BrowserWindow({
      width: WIDGET.w,
      height: WIDGET.h,
      x: pos.x,
      y: pos.y,
      minWidth: WIDGET.w,
      minHeight: WIDGET.h,
      maxWidth: WIDGET.w,
      maxHeight: WIDGET.h,
      transparent: true,
      // The '#01000000' (alpha = 1/255) is invisible to the eye but
      // non-zero to DWM — critical for Windows + transparent: true.
      // With a fully-transparent backgroundColor, every pixel of the
      // window ends up alpha=0 in the final compositor output, and
      // DWM turns click-through. Any CSS alpha inside the page (even
      // 0.2) is multiplied against that zero and still lands at 0.
      // One alpha step is all we need to make the whole window
      // hit-testable while staying visually identical.
      backgroundColor: '#01000000',
      frame: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      show: false,
      focusable: true,
      paintWhenInitiallyHidden: true,
      webPreferences: commonWebPrefs,
    });
    // 'screen-saver' level keeps the pill above fullscreen videos etc.
    win.setAlwaysOnTop(true, 'screen-saver');
  } else {
    win = new BrowserWindow({
      width: COMFORTABLE.w,
      height: COMFORTABLE.h,
      minWidth: COMFORTABLE.minW,
      minHeight: COMFORTABLE.minH,
      backgroundColor: '#07070d',
      frame: false,
      titleBarStyle: 'hidden',
      show: false,
      alwaysOnTop: !!s.alwaysOnTop,
      paintWhenInitiallyHidden: true,
      webPreferences: commonWebPrefs,
    });
  }

  const ctx: WindowCtx = { win, density, pillMoveTimer: null, disposed: false };

  if (density === 'compact') {
    // Persist pill position on drag end (debounced). We deliberately capture
    // `ctx` in the closure instead of calling getWin(): during a density
    // swap a stale move event on the old pill would otherwise overwrite
    // widgetBounds with the new window's coordinates.
    win.on('move', () => {
      if (ctx.disposed || win.isDestroyed()) return;
      if (ctx.pillMoveTimer) clearTimeout(ctx.pillMoveTimer);
      ctx.pillMoveTimer = setTimeout(() => {
        if (ctx.disposed || win.isDestroyed()) return;
        try {
          const [x, y] = win.getPosition();
          setSettings({ widgetBounds: { x, y } });
        } catch {}
      }, 250);
    });
  }

  win.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      if (!win.isDestroyed()) win.hide();
    }
  });

  win.webContents.on('console-message', (_e, level, message, line, source) => {
    console.log(`[renderer ${level}] ${message} (${source}:${line})`);
  });

  return ctx;
}

/**
 * Load the renderer bundle for a given ctx.
 *
 * The density is passed as a URL hash (`#compact` / `#comfortable`). An
 * inline script in `index.html` reads it before any CSS rule evaluates
 * and stamps `data-density` on `<html>`, which is what keeps the hot
 * density swap flicker-free.
 */
async function loadRenderer(ctx: WindowCtx): Promise<void> {
  // Base hash is the density; append a `-sampler` suffix when
  // VOICEINK_PILL_SAMPLER=1 is set so the renderer's regression sampler
  // runs. The suffix is harmless otherwise — the density bootstrap just
  // ignores anything it doesn't recognise.
  const sampler = process.env.VOICEINK_PILL_SAMPLER === '1' ? '-sampler' : '';
  const hash = ctx.density + sampler;
  if (isDev) {
    await ctx.win.loadURL(`${DEV_URL}#${hash}`);
    if (process.env.VOICEINK_DEVTOOLS === '1' && ctx.density === 'comfortable') {
      ctx.win.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    await ctx.win.loadFile(join(__dirname, '..', 'renderer', 'index.html'), { hash });
  }
}

/**
 * Resolve once the window has reliably produced its first CORRECT frame.
 *
 * Two independent signals must fire before we consider the window safe to
 * show during a density hot-swap:
 *
 *  1. `ready-to-show`  — Electron/OS: the compositor has a real frame.
 *  2. `renderer-ready` — our JS side: React has committed its first render
 *                       and a `requestAnimationFrame` has elapsed, so we
 *                       know the committed pixels are actually on screen.
 *
 * Waiting for both removes the ≈50 ms window where `ready-to-show` has
 * fired but React still shows its default/empty shell. A 2-second cap is
 * applied so a broken renderer never freezes the UI.
 */
function waitForFirstPaint(ctx: WindowCtx): Promise<void> {
  return new Promise<void>((resolve) => {
    let nativeReady = false;
    let rendererReady = false;
    let settled = false;

    const maybeResolve = () => {
      if (settled || !nativeReady || !rendererReady) return;
      settled = true;
      ipcMain.off('voiceink:renderer-ready', onRendererReady);
      clearTimeout(cap);
      resolve();
    };

    const onReadyToShow = () => {
      nativeReady = true;
      maybeResolve();
    };

    const onRendererReady = (event: Electron.IpcMainEvent) => {
      // Reject stray signals from siblings (e.g. previous swap).
      if (ctx.win.isDestroyed() || event.sender !== ctx.win.webContents) return;
      rendererReady = true;
      maybeResolve();
    };

    ctx.win.once('ready-to-show', onReadyToShow);
    ipcMain.on('voiceink:renderer-ready', onRendererReady);

    // Hard cap: show the window anyway after 2 s so a broken renderer
    // can never leave the user with a perpetually hidden pill/main window.
    const cap = setTimeout(() => {
      if (settled) return;
      settled = true;
      ipcMain.off('voiceink:renderer-ready', onRendererReady);
      resolve();
    }, 2000);
  });
}

/** Fully release a ctx: clears its timer, removes handlers, destroys. */
function disposeCtx(ctx: WindowCtx): void {
  ctx.disposed = true;
  if (ctx.pillMoveTimer) {
    clearTimeout(ctx.pillMoveTimer);
    ctx.pillMoveTimer = null;
  }
  if (!ctx.win.isDestroyed()) {
    // Un-track the HWND BEFORE destroy so the focus tracker's set
    // doesn't accumulate dead entries across many density swaps.
    try { unregisterOwnWindow(ctx.win); } catch {}
    try { ctx.win.removeAllListeners('close'); } catch {}
    try { ctx.win.destroy(); } catch {}
  }
}

async function createWindow(): Promise<void> {
  const density = getSettings().density;
  const ctx = buildWindow(density);
  current = ctx;

  // Load the bundle and wait for BOTH the native ready-to-show and React's
  // rendererReady signal before showing the window, so the very first
  // visible frame is the correct pill / comfortable UI — no blank shell.
  await loadRenderer(ctx);
  await waitForFirstPaint(ctx);

  if (ctx.disposed || ctx.win.isDestroyed()) return;

  // Honour --hidden CLI arg (set when launched by Windows auto-start) and
  // the `startMinimized` setting: in both cases we stay in the tray only.
  const hidden = process.argv.includes('--hidden') || !!getSettings().startMinimized;
  if (hidden) {
    registerOwnWindow(ctx.win);
    return;
  }
  // Show the pill WITHOUT stealing focus, so whatever the user was doing
  // remains active (critical for injection to keep working).
  if (density === 'compact') {
    ctx.win.showInactive();
  } else {
    ctx.win.show();
  }
  registerOwnWindow(ctx.win);
}

/**
 * Hot-swap the window between densities without a visible gap.
 *
 * Strategy:
 *   1. Persist the new density so the incoming renderer hydrates correctly.
 *   2. Build the new window HIDDEN and load the renderer.
 *   3. Wait for its first paint (`ready-to-show`).
 *   4. Show new + hide old in the same tick; register the new HWND so
 *      focus tracking treats it as "ours" immediately.
 *   5. Update the `current` reference, then dispose the old ctx on the
 *      next macrotask (gives the compositor time to commit the new frame).
 *
 * Calls are serialised via `swapInFlight` so repeated clicks can't race.
 */
async function swapDensity(density: Density): Promise<void> {
  if (swapInFlight) { await swapInFlight; }
  swapInFlight = (async () => {
    const prev = current;
    if (prev && prev.density === density && !prev.win.isDestroyed()) return;

    // 1. Persist BEFORE building so the new renderer hydrates with the
    //    correct density on first paint.
    setSettings({ density });

    // 2. Build hidden + load.
    const next = buildWindow(density);
    try {
      await loadRenderer(next);
    } catch (e) {
      console.warn('[swap] loadRenderer failed', e);
      disposeCtx(next);
      return;
    }
    await waitForFirstPaint(next);

    // 3. Swap atomically. Windows show/hide on frameless+transparent
    //    windows is synchronous and produces no animation.
    const wasVisible = prev ? prev.win.isVisible() : true;
    if (wasVisible) {
      if (density === 'compact') next.win.showInactive();
      else next.win.show();
    }
    registerOwnWindow(next.win);

    // 4. Flip the reference atomically. From here on, `getWin()` points
    //    at the new window.
    current = next;

    // 5. Defer the teardown a tick so the new frame is guaranteed to be
    //    on-screen before the old HWND vanishes (avoids a 1-frame flash
    //    on some GPU drivers).
    if (prev) {
      setImmediate(() => disposeCtx(prev));
    }
  })();
  try { await swapInFlight; } finally { swapInFlight = null; }
}

/**
 * Pop a right-click context menu on the pill. Called from the renderer via
 * IPC so the menu renders natively (no transparency issues).
 */
function showWidgetContextMenu(): void {
  const w = getWin();
  if (!w) return;
  const menu = Menu.buildFromTemplate([
    {
      label: 'Agrandir (mode confortable)',
      click: async () => {
        await swapDensity('comfortable');
      },
    },
    {
      label: 'Ouvrir les paramètres',
      click: async () => {
        await swapDensity('comfortable');
        const nw = getWin();
        nw?.webContents.send('voiceink:openSettings');
      },
    },
    { type: 'separator' },
    {
      label: 'Masquer la pilule',
      click: () => w.hide(),
    },
    {
      label: 'Quitter VoiceInk',
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);
  menu.popup({ window: w });
}

/** Reconcile the OS login-item state with our saved `autoStart` setting. */
function reconcileAutoStart(): void {
  try {
    const s = getSettings();
    app.setLoginItemSettings({
      openAtLogin: !!s.autoStart,
      args: s.autoStart ? ['--hidden'] : [],
    });
  } catch (e) {
    console.warn('[autostart]', e);
  }
}

/**
 * Origins the renderer is allowed to navigate to. Production = our bundled
 * file:// URL. Development = the Vite dev server. Anything else (e.g. a
 * compromised renderer trying to load example.com) is blocked and opened
 * in the user's default browser instead.
 */
function isAllowedRendererOrigin(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return true;
    if (isDev && u.origin === new URL(DEV_URL).origin) return true;
    // DevTools extensions use devtools:// — tolerated.
    if (u.protocol === 'devtools:') return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Attach defense-in-depth guards to every webContents we create. This is a
 * belt-and-braces layer on top of contextIsolation + sandbox: even if the
 * renderer were compromised, it can't redirect our window to a phishing
 * page or spawn arbitrary BrowserWindows.
 */
function installNavigationGuards(): void {
  app.on('web-contents-created', (_event, contents) => {
    // Block in-place navigations to any non-whitelisted origin.
    contents.on('will-navigate', (e, url) => {
      if (!isAllowedRendererOrigin(url)) {
        e.preventDefault();
        try { shell.openExternal(url); } catch {}
      }
    });

    // Any target=_blank link or window.open() opens in the user's default
    // browser — we never spawn a new BrowserWindow from the renderer.
    contents.setWindowOpenHandler(({ url }) => {
      try { shell.openExternal(url); } catch {}
      return { action: 'deny' };
    });

    // Refuse <webview> attachment in case the flag ever slips back on.
    contents.on('will-attach-webview', (e) => e.preventDefault());

    // Never allow permission prompts (camera, geolocation…) — mic is
    // handled via getUserMedia and Electron auto-grants on sandbox.
    contents.session.setPermissionRequestHandler((_wc, permission, cb) => {
      if (permission === 'media') return cb(true);
      cb(false);
    });
  });
}

app.whenReady().then(async () => {
  installNavigationGuards();
  registerIpc();
  reconcileAutoStart();

  ipcMain.handle(IPC.WINDOW_MINIMIZE, () => getWin()?.minimize());
  ipcMain.handle(IPC.WINDOW_MAXIMIZE, () => {
    const w = getWin();
    if (!w) return;
    if (w.isMaximized()) w.unmaximize(); else w.maximize();
  });
  ipcMain.handle(IPC.WINDOW_CLOSE, () => getWin()?.close());
  ipcMain.handle(IPC.WINDOW_SET_ALWAYS_ON_TOP, (_e, enabled: boolean) => {
    const w = getWin();
    setSettings({ alwaysOnTop: !!enabled });
    if (w && getSettings().density === 'comfortable') {
      w.setAlwaysOnTop(!!enabled, 'floating');
    }
  });
  ipcMain.handle(IPC.WINDOW_RESIZE_FOR_DENSITY, async (_e, density: Density) => {
    if (density !== 'compact' && density !== 'comfortable') return;
    await swapDensity(density);
  });
  ipcMain.handle(IPC.WIDGET_CONTEXT_MENU, () => showWidgetContextMenu());
  ipcMain.handle(IPC.LOG, (_e, ...args) => console.log('[renderer]', ...args));

  // Focus tracking runs the whole app lifetime so the HWND history is
  // always up to date regardless of density / recreates.
  try { initFocusTracking(); } catch (e) { console.warn('[focus]', e); }

  await createWindow();
  try { createTray(getWin); } catch (e) { console.warn('[tray]', e); }
  try { registerShortcuts(getWin); } catch (e) { console.warn('[shortcuts]', e); }
});

app.on('window-all-closed', () => {
  // keep tray alive
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  unregisterShortcuts();
  stopFocusTracking();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
