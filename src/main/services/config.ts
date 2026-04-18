import Store from 'electron-store';
import { Settings, DEFAULT_SETTINGS } from '../../shared/types';

/**
 * electron-store captures app.getPath('userData') synchronously in its
 * constructor. If the Store is built at module-load time, it runs
 * before main/index.ts has a chance to call app.setName('voiceink'),
 * locking the settings file to %APPDATA%\Electron\ — a parallel tree
 * that drifts from the packaged app's %APPDATA%\voiceink\.
 *
 * We defer construction to first use so app.setName() / app.setPath()
 * have already fired by the time the Store is created.
 */
let _store: Store<{ settings: Settings }> | null = null;
function store(): Store<{ settings: Settings }> {
  if (!_store) {
    _store = new Store<{ settings: Settings }>({
      name: 'voiceink-settings',
      defaults: { settings: DEFAULT_SETTINGS },
    });
  }
  return _store;
}

export function getSettings(): Settings {
  const s = (store() as any).get('settings', DEFAULT_SETTINGS) as Settings;
  // Merge defaults (in case of new fields added later)
  const merged: Settings = { ...DEFAULT_SETTINGS, ...s };
  // Env var fallback for Groq key
  if (!merged.groqApiKey && process.env.GROQ_API_KEY) {
    merged.groqApiKey = process.env.GROQ_API_KEY;
  }
  return merged;
}

export function setSettings(patch: Partial<Settings>): Settings {
  const current = getSettings();
  const next = { ...current, ...patch };
  (store() as any).set('settings', next);
  return next;
}
