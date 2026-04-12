import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/types';

const api = {
  // Audio
  getAudioDevices: () => ipcRenderer.invoke(IPC.AUDIO_DEVICES),
  startAudio: () => ipcRenderer.invoke(IPC.AUDIO_START),
  stopAudio: () => ipcRenderer.invoke(IPC.AUDIO_STOP),
  onAudioLevel: (cb: (level: number) => void) => {
    const handler = (_: any, level: number) => cb(level);
    ipcRenderer.on(IPC.AUDIO_LEVEL, handler);
    return () => ipcRenderer.removeListener(IPC.AUDIO_LEVEL, handler);
  },

  // STT
  transcribe: (audioData: ArrayBuffer | string, language?: string) => ipcRenderer.invoke(IPC.STT_TRANSCRIBE, audioData, language),
  transcribeFileSTT: (filePath: string) => ipcRenderer.invoke(IPC.STT_TRANSCRIBE_FILE, filePath),
  onSTTResult: (cb: (result: any) => void) => {
    const handler = (_: any, result: any) => cb(result);
    ipcRenderer.on(IPC.STT_RESULT, handler);
    return () => ipcRenderer.removeListener(IPC.STT_RESULT, handler);
  },
  onSTTPartial: (cb: (text: string) => void) => {
    const handler = (_: any, text: string) => cb(text);
    ipcRenderer.on(IPC.STT_PARTIAL, handler);
    return () => ipcRenderer.removeListener(IPC.STT_PARTIAL, handler);
  },
  onSTTStatus: (cb: (status: string) => void) => {
    const handler = (_: any, status: string) => cb(status);
    ipcRenderer.on(IPC.STT_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC.STT_STATUS, handler);
  },
  downloadModel: (model: string) => ipcRenderer.invoke(IPC.STT_DOWNLOAD_MODEL, model),
  onModelProgress: (cb: (progress: number) => void) => {
    const handler = (_: any, progress: number) => cb(progress);
    ipcRenderer.on(IPC.STT_MODEL_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.STT_MODEL_PROGRESS, handler);
  },

  // LLM
  processText: (text: string, mode: string, targetLang?: string) => ipcRenderer.invoke(IPC.LLM_PROCESS, text, mode, targetLang),
  onLLMResult: (cb: (result: any) => void) => {
    const handler = (_: any, result: any) => cb(result);
    ipcRenderer.on(IPC.LLM_RESULT, handler);
    return () => ipcRenderer.removeListener(IPC.LLM_RESULT, handler);
  },
  onLLMStream: (cb: (chunk: string) => void) => {
    const handler = (_: any, chunk: string) => cb(chunk);
    ipcRenderer.on(IPC.LLM_STREAM, handler);
    return () => ipcRenderer.removeListener(IPC.LLM_STREAM, handler);
  },
  onLLMStatus: (cb: (status: string) => void) => {
    const handler = (_: any, status: string) => cb(status);
    ipcRenderer.on(IPC.LLM_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC.LLM_STATUS, handler);
  },

  // Injection
  injectText: (text: string) => ipcRenderer.invoke(IPC.INJECT_TEXT, text),
  copyToClipboard: (text: string) => ipcRenderer.invoke(IPC.INJECT_CLIPBOARD, text),

  // History
  getHistory: (filter: any) => ipcRenderer.invoke(IPC.HISTORY_GET, filter),
  searchHistory: (query: string) => ipcRenderer.invoke(IPC.HISTORY_SEARCH, query),
  deleteHistory: (id: string) => ipcRenderer.invoke(IPC.HISTORY_DELETE, id),
  exportHistory: (id: string, format: string) => ipcRenderer.invoke(IPC.HISTORY_EXPORT, id, format),
  addTag: (id: string, tag: string) => ipcRenderer.invoke(IPC.HISTORY_ADD_TAG, id, tag),
  removeTag: (id: string, tag: string) => ipcRenderer.invoke(IPC.HISTORY_REMOVE_TAG, id, tag),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (settings: any) => ipcRenderer.invoke(IPC.SETTINGS_SET, settings),
  resetSettings: () => ipcRenderer.invoke(IPC.SETTINGS_RESET),

  // App
  quit: () => ipcRenderer.send(IPC.APP_QUIT),
  minimize: () => ipcRenderer.send(IPC.APP_MINIMIZE),
  toggleRecording: () => ipcRenderer.send(IPC.APP_TOGGLE_RECORDING),
  setCompactMode: (compact: boolean, width?: number, height?: number) => ipcRenderer.invoke(IPC.APP_COMPACT_MODE, compact, width, height),
  setOrbPosition: (x: number, y: number) => ipcRenderer.invoke(IPC.APP_SET_ORB_POSITION, x, y),
  getOrbPosition: () => ipcRenderer.invoke(IPC.APP_GET_ORB_POSITION),
  onToggleRecording: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on(IPC.APP_TOGGLE_RECORDING, handler);
    return () => ipcRenderer.removeListener(IPC.APP_TOGGLE_RECORDING, handler);
  },
  onRecordingState: (cb: (state: string) => void) => {
    const handler = (_: any, state: string) => cb(state);
    ipcRenderer.on(IPC.APP_RECORDING_STATE, handler);
    return () => ipcRenderer.removeListener(IPC.APP_RECORDING_STATE, handler);
  },
  onPipelineStatus: (cb: (status: any) => void) => {
    const handler = (_: any, status: any) => cb(status);
    ipcRenderer.on(IPC.APP_PIPELINE_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC.APP_PIPELINE_STATUS, handler);
  },

  // Chat
  sendChat: (messages: any[]) => ipcRenderer.invoke(IPC.CHAT_SEND, messages),
  onChatStream: (cb: (token: string) => void) => {
    const handler = (_: any, token: string) => cb(token);
    ipcRenderer.on(IPC.CHAT_STREAM, handler);
    return () => ipcRenderer.removeListener(IPC.CHAT_STREAM, handler);
  },

  // File
  openFile: () => ipcRenderer.invoke(IPC.FILE_OPEN),
  transcribeFile: (filePath: string) => ipcRenderer.invoke(IPC.FILE_TRANSCRIBE, filePath),
  exportFile: (id: string, format: string, outputPath: string) =>
    ipcRenderer.invoke(IPC.FILE_EXPORT, id, format, outputPath),
};

export type VoiceInkAPI = typeof api;

contextBridge.exposeInMainWorld('voiceink', api);
