import React, { useEffect } from 'react';
import { useStore } from './stores/useStore';
import { TitleBar } from './components/TitleBar';
import { MainView } from './components/MainView';
import { SettingsView } from './components/SettingsView';
import { HistoryView } from './components/HistoryView';
import { FileView } from './components/FileView';
import { ChatView } from './components/ChatView';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { ToastContainer } from './components/Toast';
import { CompactOverlay } from './components/CompactOverlay';

export default function App() {
  const {
    currentView, compactMode, theme, setTheme, setSettings, setPipelineStatus, setRecordingState,
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

    // LLM stream listener
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

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Compact overlay mode
  if (compactMode) {
    return (
      <div className="h-screen w-screen bg-transparent overflow-hidden">
        <CompactOverlay />
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'settings':
        return <SettingsView />;
      case 'history':
        return <HistoryView />;
      case 'file':
        return <FileView />;
      case 'chat':
        return <ChatView />;
      default:
        return <MainView />;
    }
  };

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-primary)' }}>
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
      <StatusBar />
      <ToastContainer />
    </div>
  );
}
