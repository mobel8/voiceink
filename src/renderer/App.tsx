import { useEffect } from 'react';
import { useStore } from './stores/useStore';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { MainView } from './components/MainView';
import { SettingsView } from './components/SettingsView';
import { HistoryView } from './components/HistoryView';
import { StatusBar } from './components/StatusBar';
import { CompactView } from './components/CompactView';
import { applyTheme } from './lib/theme';
import { getTheme, DEFAULT_EFFECTS } from '../shared/themes';

export default function App() {
  const { view, settings, setView, loadSettings, loadHistory } = useStore();

  useEffect(() => {
    loadSettings();
    loadHistory();
    // Signal to the main process that we've committed our first render.
    // Double rAF guarantees the commit has actually been painted before
    // main is allowed to swap the window into view.
    const ready = () => {
      try { window.voiceink?.rendererReady?.(); } catch { /* no-op */ }
    };
    requestAnimationFrame(() => requestAnimationFrame(ready));
  }, [loadSettings, loadHistory]);

  // Flag the html/body so index.css can make everything transparent in pill
  // mode without affecting comfortable mode. The attribute is already set by
  // the inline bootstrap script in index.html from the URL hash, so this is
  // essentially a no-op on first paint — but we re-assert it here in case
  // density changes at runtime (in-app switch, though all switches go
  // through window recreation). No cleanup: we never want the attribute
  // momentarily absent between two runs of this effect.
  useEffect(() => {
    const density = settings.density || 'comfortable';
    document.documentElement.dataset.density = density;
    document.body.dataset.density = density;
  }, [settings.density]);

  // Apply the active theme + effects at mount and whenever they change.
  // This rewrites CSS variables on :root so every existing component
  // repaints with the new palette, zero reload.
  useEffect(() => {
    const theme = getTheme(settings.themeId);
    const effects = settings.themeEffects || DEFAULT_EFFECTS;
    applyTheme(theme, effects);
  }, [settings.themeId, settings.themeEffects]);

  // Main can push us to the Settings view after expanding from the pill.
  useEffect(() => {
    const unsub = window.voiceink.onOpenSettings?.(() => setView('settings'));
    return () => unsub?.();
  }, [setView]);

  const compact = settings.density === 'compact';

  // Pill mode: just the floating widget, no frame/titlebar/sidebar/aurora.
  if (compact) {
    return (
      <div className="density-compact h-full w-full">
        <CompactView />
      </div>
    );
  }

  // Comfortable (main window) layout.
  return (
    <div className="density-comfortable relative h-full w-full flex flex-col">
      <div className="bg-aurora"><div className="spot-3" /></div>
      <div className="relative z-10 flex flex-col h-full">
        <TitleBar />
        <div className="flex-1 flex min-h-0">
          <Sidebar />
          <main className="flex-1 min-w-0 min-h-0 overflow-auto">
            <div key={view} className="h-full">
              {view === 'main' && <MainView />}
              {view === 'settings' && <SettingsView />}
              {view === 'history' && <HistoryView />}
            </div>
          </main>
        </div>
        <StatusBar />
      </div>
    </div>
  );
}
