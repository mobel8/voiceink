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

/**
 * Migrate deprecated `mode` values to the current 4-mode set so users
 * who installed before the refactor don't end up with an unknown mode
 * that fails the validator on next transcribe.
 *
 * Mapping rationale:
 *   - email   → formal  (email = courteous register, minus greeting/closing)
 *   - meeting → natural (bullets are a format, not a tone; natural is safest)
 *   - summary → natural (length op, not a tone; natural preserves most content)
 *   - simple  → natural (plain vocabulary ≈ lightly-cleaned)
 */
const MODE_MIGRATION: Record<string, Settings['mode']> = {
  email: 'formal',
  meeting: 'natural',
  summary: 'natural',
  simple: 'natural',
};

export function getSettings(): Settings {
  const s = (store() as any).get('settings', DEFAULT_SETTINGS) as Settings;
  // Merge defaults (in case of new fields added later)
  const merged: Settings = { ...DEFAULT_SETTINGS, ...s };
  // Env var fallback for Groq key
  if (!merged.groqApiKey && process.env.GROQ_API_KEY) {
    merged.groqApiKey = process.env.GROQ_API_KEY;
  }
  // One-way mode migration — idempotent, only rewrites legacy strings.
  const migrated = MODE_MIGRATION[merged.mode as unknown as string];
  if (migrated) {
    merged.mode = migrated;
    try { (store() as any).set('settings.mode', migrated); } catch { /* ignore */ }
  }
  return merged;
}

export function setSettings(patch: Partial<Settings>): Settings {
  const current = getSettings();
  const next = { ...current, ...patch };
  (store() as any).set('settings', next);
  return next;
}
