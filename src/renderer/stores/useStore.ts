import { create } from 'zustand';
import { Settings, DEFAULT_SETTINGS, HistoryEntry } from '../../shared/types';

export type View = 'main' | 'history' | 'settings';
export type RecState = 'idle' | 'recording' | 'processing' | 'error';

/**
 * Read the density the main process baked into the URL hash when it
 * created this window (`#compact` or `#comfortable`). Returning it here
 * lets the very first React render pick the right layout, so there is no
 * one-frame flash of the comfortable UI inside a 176x52 pill window
 * during a comfortable → compact swap.
 */
function initialDensity(): Settings['density'] {
  if (typeof location === 'undefined') return DEFAULT_SETTINGS.density;
  let h = (location.hash || '').replace('#', '');
  // Strip the optional `-sampler` test suffix appended by main when
  // VOICEINK_PILL_SAMPLER=1 is set.
  h = h.replace(/-sampler$/, '');
  if (h === 'compact' || h === 'comfortable') return h as Settings['density'];
  return DEFAULT_SETTINGS.density;
}

/**
 * Seed settings with the URL-hash density so the initial render matches
 * the window's actual size. Everything else stays at defaults until
 * `loadSettings()` finishes (~1 IPC round-trip, <10 ms).
 */
const INITIAL_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  density: initialDensity(),
};

interface State {
  view: View;
  setView: (v: View) => void;

  settings: Settings;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;

  history: HistoryEntry[];
  loadHistory: () => Promise<void>;
  removeHistory: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;

  recState: RecState;
  setRecState: (s: RecState) => void;
  lastTranscript: string;
  setLastTranscript: (t: string) => void;
  lastLatencyMs: number;
  setLastLatencyMs: (n: number) => void;
  lastError: string;
  setLastError: (e: string) => void;

  audioLevel: number; // 0..1 live RMS
  setAudioLevel: (n: number) => void;
}

declare global { interface Window { voiceink: any } }

export const useStore = create<State>()((set, get) => ({
  view: 'main',
  setView: (v) => set({ view: v }),

  settings: INITIAL_SETTINGS,
  loadSettings: async () => {
    const s = await window.voiceink.getSettings();
    set({ settings: s });
  },
  updateSettings: async (patch) => {
    const next = await window.voiceink.setSettings(patch);
    set({ settings: next });
  },

  history: [],
  loadHistory: async () => {
    const h = await window.voiceink.getHistory();
    set({ history: h });
  },
  removeHistory: async (id) => {
    await window.voiceink.deleteHistory(id);
    await get().loadHistory();
  },
  clearHistory: async () => {
    await window.voiceink.clearHistory();
    set({ history: [] });
  },

  recState: 'idle',
  setRecState: (s) => set({ recState: s }),
  lastTranscript: '',
  setLastTranscript: (t) => set({ lastTranscript: t }),
  lastLatencyMs: 0,
  setLastLatencyMs: (n) => set({ lastLatencyMs: n }),
  lastError: '',
  setLastError: (e) => set({ lastError: e }),

  audioLevel: 0,
  setAudioLevel: (n) => set({ audioLevel: n }),
}));
