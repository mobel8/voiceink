import Store from 'electron-store';
import { Settings, DEFAULT_SETTINGS } from '../../shared/types';

// electron-store persistent settings
const store = new Store<{ settings: Settings }>({
  name: 'voiceink-settings',
  defaults: { settings: DEFAULT_SETTINGS },
});

export function getSettings(): Settings {
  const s = (store as any).get('settings', DEFAULT_SETTINGS) as Settings;
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
  (store as any).set('settings', next);
  return next;
}
