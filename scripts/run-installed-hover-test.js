/**
 * Regression test that runs against the ACTUAL INSTALLED VoiceInk.exe,
 * not the dev loopback. Reproduces the exact path the user takes when
 * they double-click the desktop shortcut while persisted settings
 * disagree with the window main creates:
 *
 *   - Force compact so main opens a 176×55 pill even if the saved
 *     `density` is 'comfortable' (which used to be the bug trigger).
 *   - Drive CDP Input.dispatchMouseEvent at the dot, the halo, and
 *     the hidden mic / expand button footprints.
 *   - Assert:
 *       dot hover       → pill-full opacity 1  (expanded)
 *       halo ±18 px hover → expanded
 *       mic-area hover  → pill-full opacity 0  (retracted)
 *       expand-area hover → retracted
 *
 * Failing any of the above surfaces a mismatch between the view React
 * actually mounts and the window main actually sized — which is what
 * the user was seeing on their desktop.
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');

const INSTALL = path.join(process.env.LOCALAPPDATA, 'Programs', 'VoiceInk', 'VoiceInk.exe');
const CDP_PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killAll() {
  for (const n of ['VoiceInk.exe', 'electron.exe']) {
    try { execSync(`taskkill /F /IM ${n}`, { stdio: 'ignore' }); } catch {}
  }
}
function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let b = ''; res.on('data', (c) => (b += c));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

class CDP {
  constructor(ws) {
    this.ws = new WebSocket(ws); this.id = 0;
    this.pending = new Map(); this.listeners = new Map();
    this.ready = new Promise((ok, err) => {
      this.ws.addEventListener('open', () => ok());
      this.ws.addEventListener('error', (e) => err(e));
    });
    this.ws.addEventListener('message', (ev) => {
      const m = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      } else if (m.method) {
        for (const fn of (this.listeners.get(m.method) || [])) fn(m.params);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); }
      }, 5000);
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
}

async function evalJS(cdp, js) {
  const r = await cdp.send('Runtime.evaluate', { expression: js, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' // ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description));
  return r.result.value;
}

(async () => {
  const runs = parseInt(process.argv[2] || '1', 10);
  let totalFail = 0;

  for (let r = 1; r <= runs; r++) {
    console.log('===============================');
    console.log(' INSTALLED RUN ' + r + ' / ' + runs);
    console.log('===============================');
    killAll(); await sleep(600);

    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    env.VOICEINK_CDP = '1';
    env.VOICEINK_FORCE_DENSITY = 'compact';

    const child = spawn(INSTALL, [], {
      shell: false, detached: false, windowsHide: false, env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', () => {});   // silence app stdout
    child.stderr.on('data', () => {});

    let targets = [];
    for (let i = 0; i < 240; i++) {
      await sleep(250);
      try {
        targets = await httpJson(`http://127.0.0.1:${CDP_PORT}/json`);
        targets = targets.filter((t) => t.type === 'page' && /index\.html/.test(t.url));
        if (targets.length) break;
      } catch {}
    }
    if (!targets.length) { console.error('CDP never came up'); totalFail++; continue; }

    const tgt = targets.find((t) => /compact/.test(t.url)) || targets[0];
    console.log('attached:', tgt.url);
    const cdp = new CDP(tgt.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
      const txt = args.map((a) => a.value ?? a.description ?? '').join(' ');
      console.log('  [console ' + type + '] ' + txt);
    });

    // Wait for first render + capsule to exist
    for (let i = 0; i < 60; i++) {
      await sleep(100);
      const ok = await evalJS(cdp, `!!document.querySelector('.pill-idle-capsule')`);
      if (ok) break;
    }

    // Geometry
    const geom = await evalJS(cdp, `(() => {
      const v = { w: innerWidth, h: innerHeight };
      const r = document.querySelector('.pill-idle-capsule').getBoundingClientRect();
      return { v, cap: { x: r.x + r.width/2, y: r.y + r.height/2, halfW: r.width/2, halfH: r.height/2 } };
    })()`);
    console.log('viewport:', geom.v.w + '×' + geom.v.h, ' capsule centre:', Math.round(geom.cap.x) + ',' + Math.round(geom.cap.y));

    async function moveTo(x, y) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
    }
    async function snap() {
      return evalJS(cdp, `(() => {
        const full = document.querySelector('.pill-full');
        const cap  = document.querySelector('.pill-idle-capsule');
        return {
          fullOp: parseFloat(getComputedStyle(full).opacity).toFixed(2),
          capOp:  parseFloat(getComputedStyle(cap).opacity).toFixed(2),
          hasCapHover: !!document.querySelector('.pill-idle-capsule:hover'),
          hasFullHover: !!document.querySelector('.pill-full:hover'),
          hasFaceHover: !!document.querySelector('.pill-idle-face:hover'),
        };
      })()`);
    }

    const cx = geom.cap.x, cy = geom.cap.y;
    const probes = [
      { name: 'dot-centre',        x: cx,      y: cy,      expect: 'expand' },
      { name: 'halo-left',         x: cx - 18, y: cy,      expect: 'expand' },
      { name: 'halo-right',        x: cx + 18, y: cy,      expect: 'expand' },
      { name: 'halo-top',          x: cx,      y: cy - 12, expect: 'expand' },
      { name: 'halo-bottom',       x: cx,      y: cy + 12, expect: 'expand' },
      { name: 'mic-area',          x: 22,      y: cy,      expect: 'retract' },
      { name: 'expand-area',       x: geom.v.w - 22, y: cy, expect: 'retract' },
      { name: 'top-left-corner',   x: 4,       y: 4,       expect: 'retract' },
      { name: 'bottom-right-corner', x: geom.v.w - 4, y: geom.v.h - 4, expect: 'retract' },
    ];

    let failed = 0;
    for (const p of probes) {
      await moveTo(-10, -10); await sleep(130);
      await moveTo(p.x, p.y); await sleep(200);
      const s = await snap();
      const expanded = parseFloat(s.fullOp) > 0.5;
      const ok = (p.expect === 'expand') ? expanded : !expanded;
      console.log('  ' + (ok ? 'OK ' : 'FAIL') + '  ' + p.name.padEnd(20) +
        ' (' + Math.round(p.x) + ',' + Math.round(p.y) + ')  fullOp=' + s.fullOp +
        ' capOp=' + s.capOp);
      if (!ok) failed++;
    }

    // Collapse
    await moveTo(-50, -50); await sleep(350);
    const collapsed = await snap();
    const collapseOK = parseFloat(collapsed.fullOp) < 0.05;
    console.log('  ' + (collapseOK ? 'OK ' : 'FAIL') + '  leave-pill-area      fullOp=' + collapsed.fullOp);
    if (!collapseOK) failed++;

    console.log(failed === 0 ? '\n✅ PASS (all ' + probes.length + ' probes + collapse)\n'
                             : '\n❌ FAIL: ' + failed + ' check(s)\n');
    totalFail += failed;

    try { cdp.ws.close(); } catch {}
    try { process.kill(child.pid); } catch {}
    await sleep(400);
  }

  killAll();
  console.log(totalFail === 0
    ? '=== ALL ' + runs + ' INSTALLED RUN(S) PASSED ==='
    : '=== ' + totalFail + ' FAIL(s) across ' + runs + ' run(s) ===');
  process.exit(totalFail === 0 ? 0 : 1);
})().catch((e) => { console.error('fatal:', e); killAll(); process.exit(3); });
