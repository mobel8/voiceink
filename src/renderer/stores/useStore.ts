import { create } from 'zustand';
import type {
  RecordingState,
  PipelineStatus,
  ProcessingMode,
  AppSettings,
  HistoryEntry,
  ChatMessage,
} from '@shared/types';

type View = 'main' | 'settings' | 'history' | 'file' | 'chat';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface AppState {
  // View
  currentView: View;
  setView: (view: View) => void;
  compactMode: boolean;
  setCompactMode: (v: boolean) => void;
  compactSize: 'xs' | 'sm' | 'md';
  setCompactSize: (s: 'xs' | 'sm' | 'md') => void;
  compactStyle: 'purple' | 'cyan' | 'green' | 'rose' | 'white';
  setCompactStyle: (s: 'purple' | 'cyan' | 'green' | 'rose' | 'white') => void;
  compactVisualization: 'radial' | 'waveform' | 'oscillogram';
  setCompactVisualization: (v: 'radial' | 'waveform' | 'oscillogram') => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;

  // Recording
  recordingState: RecordingState;
  setRecordingState: (state: RecordingState) => void;
  audioLevel: number;
  setAudioLevel: (level: number) => void;

  // Pipeline
  pipelineStatus: PipelineStatus;
  setPipelineStatus: (status: PipelineStatus) => void;

  // Transcription
  currentText: string;
  setCurrentText: (text: string) => void;
  processedText: string;
  setProcessedText: (text: string) => void;
  partialText: string;
  setPartialText: (text: string) => void;

  // LLM Streaming
  llmStreamText: string;
  setLlmStreamText: (text: string) => void;
  appendLlmStreamToken: (token: string) => void;
  isLlmStreaming: boolean;
  setIsLlmStreaming: (v: boolean) => void;

  // Timing
  recordingStartTime: number | null;
  setRecordingStartTime: (t: number | null) => void;
  lastTranscriptionMs: number | null;
  setLastTranscriptionMs: (ms: number | null) => void;

  // Mode
  selectedMode: ProcessingMode;
  setSelectedMode: (mode: ProcessingMode) => void;

  // Language
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;

  // Settings
  settings: AppSettings | null;
  setSettings: (settings: AppSettings) => void;

  // History
  history: HistoryEntry[];
  setHistory: (history: HistoryEntry[]) => void;

  // Model
  modelReady: boolean;
  setModelReady: (ready: boolean) => void;
  modelDownloadProgress: number;
  setModelDownloadProgress: (progress: number) => void;

  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  clearChat: () => void;
  isChatStreaming: boolean;
  setIsChatStreaming: (v: boolean) => void;
}

let toastId = 0;

export const useStore = create<AppState>((set) => ({
  // View
  currentView: 'main',
  setView: (view) => set({ currentView: view }),
  compactMode: false,
  setCompactMode: (v) => set({ compactMode: v }),
  compactSize: 'sm',
  setCompactSize: (s) => set({ compactSize: s }),
  compactStyle: 'purple',
  setCompactStyle: (s) => set({ compactStyle: s }),
  compactVisualization: 'radial',
  setCompactVisualization: (v) => set({ compactVisualization: v }),
  theme: 'dark',
  setTheme: (t) => set({ theme: t }),

  // Recording
  recordingState: 'idle',
  setRecordingState: (state) => set({ recordingState: state }),
  audioLevel: 0,
  setAudioLevel: (level) => set({ audioLevel: level }),

  // Pipeline
  pipelineStatus: { state: 'idle', message: 'Prêt' },
  setPipelineStatus: (status) => set({ pipelineStatus: status }),

  // Transcription
  currentText: '',
  setCurrentText: (text) => set({ currentText: text }),
  processedText: '',
  setProcessedText: (text) => set({ processedText: text }),
  partialText: '',
  setPartialText: (text) => set({ partialText: text }),

  // LLM Streaming
  llmStreamText: '',
  setLlmStreamText: (text) => set({ llmStreamText: text }),
  appendLlmStreamToken: (token) => set((state) => ({ llmStreamText: state.llmStreamText + token })),
  isLlmStreaming: false,
  setIsLlmStreaming: (v) => set({ isLlmStreaming: v }),

  // Timing
  recordingStartTime: null,
  setRecordingStartTime: (t) => set({ recordingStartTime: t }),
  lastTranscriptionMs: null,
  setLastTranscriptionMs: (ms) => set({ lastTranscriptionMs: ms }),

  // Mode
  selectedMode: 'raw',
  setSelectedMode: (mode) => set({ selectedMode: mode }),

  // Language
  selectedLanguage: 'fr',
  setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),
  targetLanguage: '',
  setTargetLanguage: (lang) => set({ targetLanguage: lang }),

  // Settings
  settings: null,
  setSettings: (settings) => set({ settings }),

  // History
  history: [],
  setHistory: (history) => set({ history }),

  // Model
  modelReady: false,
  setModelReady: (ready) => set({ modelReady: ready }),
  modelDownloadProgress: 0,
  setModelDownloadProgress: (progress) => set({ modelDownloadProgress: progress }),

  // Toasts
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: String(++toastId) }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Chat
  chatMessages: [],
  addChatMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  updateLastAssistantMessage: (content) =>
    set((state) => {
      const msgs = [...state.chatMessages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], content: msgs[i].content + content };
          break;
        }
      }
      return { chatMessages: msgs };
    }),
  clearChat: () => set({ chatMessages: [] }),
  isChatStreaming: false,
  setIsChatStreaming: (v) => set({ isChatStreaming: v }),
}));
