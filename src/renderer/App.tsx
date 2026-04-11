import React, { useEffect } from 'react';
import { useStore } from './stores/useStore';
import { CompactOverlay } from './components/CompactOverlay';
import { PanelView } from './components/PanelView';
import { ToastContainer } from './components/Toast';

export default function App() {
  const {
    panelExpanded, compactMode, setCompactMode,
    theme, setTheme, setSettings, setPipelineStatus, setRecordingState,
    setLlmStreamText, appendLlmStreamToken, setIsLlmStreaming,
  } = useStore();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.voiceink) {
          const settings = await window.voiceink.getSettings();
          setSettings(settings);
          if (settings.ui?.theme) setTheme(settings.ui.theme as 'dark' | 'light');
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadSettings();

    let unsubPipeline: (() => void) | undefined;
    let unsubRecording: (() => void) | undefined;

    if (window.voiceink) {
      unsubPipeline = window.voiceink.onPipelineStatus((status: any) => {
        setPipelineStatus(status);
      });

      unsubRecording = window.voiceink.onRecordingState((state: any) => {
        setRecordingState(state);
      });
    }

    let unsubLlmStream: (() => void) | undefined;
    if (window.voiceink?.onLLMStream) {
      unsubLlmStream = window.voiceink.onLLMStream((token: string) => {
        if (token === '\x00START') {
          setLlmStreamText('');
          setIsLlmStreaming(true);
        } else if (token === '\x00END') {
          setIsLlmStreaming(false);
        } else {
          appendLlmStreamToken(token);
        }
      });
    }

    return () => {
      unsubPipeline?.();
      unsubRecording?.();
      unsubLlmStream?.();
    };
  }, [setSettings, setPipelineStatus, setRecordingState, setLlmStreamText, appendLlmStreamToken, setIsLlmStreaming]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Panel mode: expanded floating panel
  if (panelExpanded) {
    return (
      <div className="h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        <PanelView />
        <ToastContainer />
      </div>
    );
  }

  // Default: orb mode (circular clip)
  return (
    <div
      className="h-screen w-screen overflow-hidden compact-root"
      style={{
        background: 'transparent',
        borderRadius: '50%',
        clipPath: 'circle(50% at 50% 50%)',
        WebkitClipPath: 'circle(50% at 50% 50%)',
      }}
    >
      <CompactOverlay />
    </div>
  );
}
