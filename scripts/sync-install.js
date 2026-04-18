/**
 * Push the current `dist/` + `assets/` into the installed VoiceInk's
 * app.asar so the desktop shortcut picks up code changes without going
 * through the NSIS installer. Intended as a dev-loop command: run it
 * after `scripts\build.bat` (or call `scripts\sync-install.bat` which
 * chains build → sync → relaunch).
 *
 * Steps
 *   1. Locate the installed VoiceInk.exe + app.asar.
 *   2. Kill every running VoiceInk / electron process so Windows
 *      releases the file lock on app.asar.
 *   3. Extract the current app.asar to a temp directory (preserves
 *      bundled node_modules, package.json, etc.).
 *   4. Overwrite `<tmp>/dist/` and `<tmp>/assets/` with the freshly
 *      built versions from the repo.
 *   5. Repack the temp directory back to app.asar.
 *   6. Relaunch VoiceInk.exe.
 *
 * We use @electron/asar programmatically (already a transitive
 * dependency via electron-builder) instead of `npx asar` to avoid the
 * 3-5 s spin-up npx adds on every run.
 */
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { spawn, spawnSync } = require('child_process');
const asar = require('@electron/asar');

const ROOT = path.resolve(__dirname, '..');

// ---- 1. Locate the installed app --------------------------------------
const CANDIDATES = [
  process.env.LOCALAPPDATA        && path.join(process.env.LOCALAPPDATA,        'Programs', 'VoiceInk'),
  process.env.ProgramFiles        && path.join(process.env.ProgramFiles,        'VoiceInk'),
  process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'VoiceInk'),
].filter(Boolean);

let installDir = null;
for (const c of CANDIDATES) {
  if (fs.existsSync(path.join(c, 'VoiceInk.exe'))) {
    installDir = c;
    break;
  }
}
if (!installDir) {
  console.error('[sync-install] VoiceInk.exe not found. Searched:');
  for (const c of CANDIDATES) console.error('  - ' + c);
  console.error('Run the NSIS installer once, then re-run this script.');
  process.exit(2);
}
const exe          = path.join(installDir, 'VoiceInk.exe');
const installedAsar = path.join(installDir, 'resources', 'app.asar');
if (!fs.existsSync(installedAsar)) {
  console.error('[sync-install] missing', installedAsar);
  process.exit(2);
}
console.log('[sync-install] target :', exe);
console.log('[sync-install] asar   :', installedAsar,
  '(', (fs.statSync(installedAsar).size / 1e6).toFixed(2), 'MB)');

// ---- 2. Stop running VoiceInk so Windows releases the asar lock -------
function killTree(name) {
  // Redirect both streams because taskkill prints to stderr when the
  // process it's looking for is not running.
  spawnSync('taskkill', ['/F', '/IM', name], { stdio: 'ignore' });
}
killTree('VoiceInk.exe');
killTree('electron.exe');

// Give Windows a moment to finish the handle release — 300 ms is
// usually enough; 800 ms keeps the script reliable on slower drives.
function sleepSync(ms) {
  spawnSync(process.execPath, ['-e', `setTimeout(()=>{}, ${ms})`]);
}
sleepSync(800);

// ---- 3. Extract the current asar --------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voiceink-sync-'));
console.log('[sync-install] extract →', tmp);
asar.extractAll(installedAsar, tmp);

// ---- 4. Overwrite dist/ + assets/ with fresh sources ------------------
function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const sp = path.join(src, ent.name);
    const dp = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDirSync(sp, dp);
    else fs.copyFileSync(sp, dp);
  }
}

for (const sub of ['dist', 'assets']) {
  const src = path.join(ROOT, sub);
  const dst = path.join(tmp, sub);
  if (!fs.existsSync(src)) {
    console.error('[sync-install] missing source folder:', src);
    console.error('Run `scripts\\build.bat` first.');
    process.exit(3);
  }
  fs.rmSync(dst, { recursive: true, force: true });
  copyDirSync(src, dst);
  console.log('[sync-install] synced', sub + '/');
}

// We deliberately do NOT overwrite <tmp>/package.json or node_modules:
//   • package.json inside asar was pruned by electron-builder to drop
//     devDependencies; copying our repo's package.json back would
//     re-introduce them and bloat the asar.
//   • node_modules inside asar is the production-only subset — no
//     point replacing it until we bump a dependency, and the NSIS
//     installer handles dep bumps anyway.

// ---- 5. Repack --------------------------------------------------------
console.log('[sync-install] repacking asar...');
asar.createPackage(tmp, installedAsar)
  .then(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('[sync-install] repacked',
      '(', (fs.statSync(installedAsar).size / 1e6).toFixed(2), 'MB)');

    // ---- 6. Relaunch --------------------------------------------------
    console.log('[sync-install] launching', exe);
    const child = spawn(exe, [], { detached: true, stdio: 'ignore' });
    child.unref();
    console.log('[sync-install] done.');
    process.exit(0);
  })
  .catch((e) => {
    console.error('[sync-install] repack failed:', e);
    process.exit(4);
  });
