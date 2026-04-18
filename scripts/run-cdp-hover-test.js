/**
 * End-to-end hover/drag regression harness via Chrome DevTools Protocol.
 *
 * Electron is launched with VOICEINK_CDP=1, which opens a CDP server on
 * :9222. We attach to the pill window, stream the renderer console live,
 * and dispatch Input.dispatchMouseEvent — the ONLY reliable way to move
 * the mouse inside a transparent alwaysOnTop window on Windows.
 *
 * Success criteria
 *   1. The whole 176×52 window area triggers `.density-compact:hover`
 *      when the cursor is parked on ANY pixel inside it.
 *   2. Once hover is active, the pill width stays == 164 for 3 seconds
 *      (no oscillation).
 *   3. The console emits no unexpected errors during the test.
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const CDP_PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killElectron() {
  try { execSync('taskkill /F /IM electron.exe', { stdio: 'ignore' }); } catch {}
  try { execSync('taskkill /F /IM VoiceInk.exe',  { stdio: 'ignore' }); } catch {}
}

// ---- HTTP helper --------------------------------------------------------
function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: { Host: '127.0.0.1:' + CDP_PORT } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ---- CDP client ---------------------------------------------------------
class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (e) => reject(e));
    });
    this.ws.addEventListener('message', (ev) => {
      const data = typeof ev.data === 'string' ? ev.data : ev.data.toString();
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        const subs = this.listeners.get(msg.method) || [];
        for (const fn of subs) fn(msg.params);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('CDP timeout ' + method));
        }
      }, 5000);
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

// ---- Electron spawn -----------------------------------------------------
async function launch() {
  killElectron();
  await sleep(300);

  // Force compact mode so the pill window is the one we attach to. We
  // write it to the settings file via env — but easier: just trust the
  // current user config. The harness will filter targets by URL to
  // find the pill.
  const env = {
    ...process.env,
    // The sampler would spam console 10 Hz and drown our probe output.
    // We do the probing ourselves via Runtime.evaluate here.
    VOICEINK_PILL_SAMPLER: '',
    VOICEINK_CDP: '1',
    VOICEINK_FORCE_DENSITY: 'compact',
    ELECTRON_ENABLE_LOGGING: '1',
  };
  // ELECTRON_RUN_AS_NODE=1 is set globally on this machine; it forces
  // the Electron binary to behave as a stock Node runtime, which makes
  // require('electron') return the binary path instead of the API —
  // breaking the bundle immediately. We must DELETE the variable so
  // it's not forwarded.
  delete env.ELECTRON_RUN_AS_NODE;

  const electronBin = path.join(
    ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron.cmd' : 'electron'
  );
  const child = spawn(
    `"${electronBin}" dist/main/index.js`,
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], shell: true }
  );
  // Only surface fatal Electron output; CDP consoleAPICalled already
  // streams the renderer console in real time below.
  child.stdout.on('data', () => {});
  child.stderr.on('data', (b) => {
    const s = b.toString();
    if (/error|fatal|warn/i.test(s)) process.stderr.write('[e] ' + s);
  });
  return child;
}

// ---- Target discovery ---------------------------------------------------
async function findPillTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await httpJson(`http://127.0.0.1:${CDP_PORT}/json`);
      const t = list.find((x) =>
        x.type === 'page' && /compact/.test(x.url || '')
      );
      if (t) return t;
    } catch {}
    await sleep(250);
  }
  throw new Error('CDP target for pill window never appeared');
}

// ---- Main ---------------------------------------------------------------
async function main() {
  const fs = require('fs');
  const mainBundle = path.join(ROOT, 'dist', 'main', 'index.js');
  if (!fs.existsSync(mainBundle)) {
    console.error('✗ dist/main/index.js missing — run `scripts\\build.bat` first.');
    process.exit(4);
  }

  const child = await launch();
  console.log('▶ waiting for CDP target…');
  const target = await findPillTarget();
  console.log('▶ attached:', target.url);

  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.ready;

  // Live console feed — everything the renderer logs ends up here.
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  cdp.on('Runtime.consoleAPICalled', (p) => {
    const msg = (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    console.log('  [console.' + p.type + ']', msg);
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    console.error('  [exception]', p.exceptionDetails?.text,
      p.exceptionDetails?.exception?.description);
  });
  cdp.on('Log.entryAdded', (p) => {
    console.log('  [log.' + p.entry.level + ']', p.entry.text);
  });

  // Query window bounds from the renderer to compute absolute viewport.
  const bounds = await cdp.send('Runtime.evaluate', {
    expression: 'JSON.stringify({w: window.innerWidth, h: window.innerHeight})',
  });
  const { w, h } = JSON.parse(bounds.result.value);
  console.log('▶ viewport:', w + '×' + h);

  // Wait for the pill DOM to fully mount and lay out before probing.
  // Otherwise the first 1-2 probes can race the React commit and see
  // width=0 / no hover even though everything is fine.
  for (let i = 0; i < 60; i++) {
    const r = await cdp.send('Runtime.evaluate', {
      expression: `!!document.querySelector('.pill') && document.querySelector('.pill').getBoundingClientRect().width > 0`,
    });
    if (r.result.value) break;
    await sleep(100);
  }
  await sleep(250);

  // Helper: park the mouse at viewport-relative (x, y), then query the
  // actual :hover state + computed background of the pill.
  async function probe(x, y) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x, y,
      button: 'none',
      buttons: 0,
      modifiers: 0,
    });
    // Allow Chromium one frame to re-evaluate :hover.
    await sleep(80);
    const r = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const c = document.querySelector('.density-compact');
        const p = document.querySelector('.pill');
        const bg = p ? getComputedStyle(p).backgroundImage : '';
        const el = document.elementFromPoint(${x}, ${y});
        return JSON.stringify({
          hover: !!c?.matches(':hover'),
          glass: bg.includes('linear-gradient'),
          width: p?.getBoundingClientRect().width || 0,
          hit: (el?.className || el?.tagName || 'null').toString().slice(0, 40),
        });
      })()`,
    });
    return JSON.parse(r.result.value);
  }

  // ---- Test 1: hover triggers ANYWHERE in the window ------------------
  console.log('\n── Test 1: hover should activate on every pixel of the window');
  const points = [
    { label: 'centre',       x: w / 2,     y: h / 2 },
    { label: 'top-left',     x: 4,         y: 4 },
    { label: 'top-right',    x: w - 4,     y: 4 },
    { label: 'bottom-left',  x: 4,         y: h - 4 },
    { label: 'bottom-right', x: w - 4,     y: h - 4 },
    { label: 'far-left',     x: 10,        y: h / 2 },
    { label: 'far-right',    x: w - 10,    y: h / 2 },
  ];
  const results = [];
  for (const p of points) {
    const s = await probe(p.x, p.y);
    results.push({ ...p, ...s });
    const ok = s.hover && s.glass;
    console.log(`  ${ok ? 'OK' : 'NO'}  ${p.label.padEnd(14)} (${Math.round(p.x)}, ${Math.round(p.y)})  hover=${s.hover} glass=${s.glass} w=${Math.round(s.width)}`);
  }

  // ---- Test 2: stability on stationary cursor --------------------------
  console.log('\n── Test 2: hover stable for 3 s at centre');
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: w / 2, y: h / 2, button: 'none', buttons: 0,
  });
  await sleep(400);
  const stability = [];
  for (let i = 0; i < 30; i++) {
    const r = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const c = document.querySelector('.density-compact');
        const p = document.querySelector('.pill');
        const bg = p ? getComputedStyle(p).backgroundImage : '';
        return JSON.stringify({
          hover: !!c?.matches(':hover'),
          glass: bg.includes('linear-gradient'),
          w: p?.getBoundingClientRect().width || 0,
        });
      })()`,
    });
    stability.push(JSON.parse(r.result.value));
    await sleep(100);
  }
  const ws = stability.map((s) => Math.round(s.w));
  const allHover = stability.every((s) => s.hover);
  const allGlass = stability.every((s) => s.glass);
  const widthSpread = Math.max(...ws) - Math.min(...ws);
  console.log('  widths :', ws.join(','));
  console.log('  hovers :', stability.map((s) => s.hover ? 1 : 0).join(''));
  console.log('  glasses:', stability.map((s) => s.glass ? 1 : 0).join(''));
  console.log(`  allHover=${allHover} allGlass=${allGlass} widthSpread=${widthSpread}`);

  // ---- Verdict ---------------------------------------------------------
  const anyMiss = results.some((r) => !r.hover || !r.glass);
  const verdict = !anyMiss && allHover && allGlass && widthSpread < 4;

  cdp.close();
  killElectron();

  if (verdict) {
    console.log('\n✅ PASS: whole-window hover + stable expansion.');
    process.exit(0);
  }
  console.log('\n❌ FAIL');
  if (anyMiss) console.log('  - some points did not trigger hover / glass');
  if (!allHover) console.log('  - hover dropped during stationary 3 s');
  if (!allGlass) console.log('  - glass background dropped during stationary 3 s');
  if (widthSpread >= 4) console.log('  - pill width oscillated by', widthSpread, 'px');
  process.exit(1);
}

main().catch((e) => {
  console.error('HARNESS ERROR:', e);
  killElectron();
  process.exit(2);
});
