import { IpcMain, BrowserWindow, dialog, app, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { IPC, HistoryEntry, RecordingState, PipelineStatus } from '../shared/types';
import { ConfigService } from './services/config';
import { HistoryService } from './services/history';
import { WhisperEngine } from './engines/whisper';
import { LLMEngine } from './engines/llm';
import { TextInjector } from './services/injection';
import { ExportService } from './services/export';

let currentRecordingState: RecordingState = 'idle';
let audioTempPath: string | null = null;

export function registerIpcHandlers(
  ipcMain: IpcMain,
  mainWindow: BrowserWindow,
  configService: ConfigService,
  historyService: HistoryService,
  whisperEngine: WhisperEngine,
  llmEngine: LLMEngine,
  textInjector: TextInjector,
  exportService: ExportService
): void {

  // ===== Settings =====
  ipcMain.handle(IPC.SETTINGS_GET, () => {
    return configService.getSettings();
  });

  ipcMain.handle(IPC.SETTINGS_SET, (_event, settings) => {
    return configService.updateSettings(settings);
  });

  ipcMain.handle(IPC.SETTINGS_RESET, () => {
    return configService.resetSettings();
  });

  // ===== Audio =====
  ipcMain.handle(IPC.AUDIO_START, async () => {
    currentRecordingState = 'recording';
    mainWindow.webContents.send(IPC.APP_RECORDING_STATE, 'recording');
    sendPipelineStatus(mainWindow, { state: 'recording', message: 'Enregistrement en cours...' });
    return true;
  });

  ipcMain.handle(IPC.AUDIO_STOP, async () => {
    currentRecordingState = 'processing';
    mainWindow.webContents.send(IPC.APP_RECORDING_STATE, 'processing');
    sendPipelineStatus(mainWindow, { state: 'processing', message: 'Traitement en cours...' });
    return true;
  });

  // ===== STT Transcription (decoupled from LLM) =====
  ipcMain.handle(IPC.STT_TRANSCRIBE, async (_event, audioData: string, language?: string) => {
    const t0 = Date.now();
    try {
      sendPipelineStatus(mainWindow, { state: 'processing', message: 'Transcription...' });

      // Decode base64 to buffer — fast in-memory operation
      let audioBuffer: Buffer;
      if (audioData.startsWith('data:')) {
        const commaIdx = audioData.indexOf(',');
        audioBuffer = Buffer.from(audioData.substring(commaIdx + 1), 'base64');
      } else {
        audioBuffer = await fs.promises.readFile(audioData);
      }
      const tDecode = Date.now();
      console.log(`[Pipeline] Decode: ${audioBuffer.length} bytes in ${tDecode - t0}ms`);

      const settings = configService.getSettings();
      const isCloudProvider = ['groq', 'openai', 'glm'].includes(settings.stt.provider);

      let transcription;
      if (isCloudProvider) {
        // Cloud providers: send buffer directly — skip temp file entirely
        transcription = await whisperEngine.transcribeFromBuffer(audioBuffer, language);
      } else {
        // Local whisper: needs a file path
        const tempDir = app.getPath('temp');
        audioTempPath = path.join(tempDir, `voiceink-${Date.now()}.wav`);
        await fs.promises.writeFile(audioTempPath, audioBuffer);
        transcription = await whisperEngine.transcribe(audioTempPath, language);
        fs.promises.unlink(audioTempPath).catch(() => {});
      }

      const elapsed = Date.now() - t0;
      console.log(`[Pipeline] Total transcription: ${elapsed}ms — "${(transcription.text || '').substring(0, 80)}"`);
      mainWindow.webContents.send(IPC.STT_RESULT, transcription);

      sendPipelineStatus(mainWindow, {
        state: 'idle',
        message: transcription.text?.trim() ? `Transcrit en ${(elapsed / 1000).toFixed(1)}s` : 'Aucun texte detecte',
      });

      currentRecordingState = 'idle';
      mainWindow.webContents.send(IPC.APP_RECORDING_STATE, 'idle');
      return transcription;
    } catch (error: any) {
      console.error('Pipeline error:', error);
      sendPipelineStatus(mainWindow, { state: 'idle', message: `Erreur: ${error.message}` });
      currentRecordingState = 'idle';
      mainWindow.webContents.send(IPC.APP_RECORDING_STATE, 'idle');
      throw error;
    }
  });

  // ===== File Transcription =====
  ipcMain.handle(IPC.FILE_OPEN, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'mp4', 'ogg', 'webm', 'flac'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.FILE_TRANSCRIBE, async (_event, filePath: string) => {
    try {
      sendPipelineStatus(mainWindow, { state: 'processing', message: 'Transcription du fichier...' });

      const transcription = await whisperEngine.transcribe(filePath);

      // LLM post-processing
      const processed = await llmEngine.process(transcription.text);

      // Save to history
      const historyEntry: HistoryEntry = {
        id: uuidv4(),
        timestamp: Date.now(),
        originalText: transcription.text,
        processedText: processed.processed,
        mode: processed.mode,
        language: transcription.language,
        duration: transcription.duration,
        tags: [],
        source: 'file',
        fileName: path.basename(filePath),
      };
      historyService.add(historyEntry);

      sendPipelineStatus(mainWindow, { state: 'idle', message: 'Fichier transcrit ✓' });
      return { transcription, processed, historyId: historyEntry.id };
    } catch (error: any) {
      sendPipelineStatus(mainWindow, { state: 'idle', message: `Erreur: ${error.message}` });
      throw error;
    }
  });

  // ===== LLM (streaming) =====
  ipcMain.handle(IPC.LLM_PROCESS, async (_event, text: string, mode?: string, targetLang?: string) => {
    try {
      const settings = configService.getSettings();
      const activeMode = (mode || settings.llm.mode) as any;

      // Raw mode with no translation — no LLM needed
      if ((activeMode === 'raw' && !targetLang) || settings.llm.provider === 'none') {
        return { original: text, processed: text, mode: activeMode };
      }

      let systemPrompt: string;
      if (targetLang) {
        const langNames: Record<string, string> = { fr: 'francais', en: 'anglais', es: 'espagnol', de: 'allemand', it: 'italien', pt: 'portugais', zh: 'chinois', ja: 'japonais', ko: 'coreen', ar: 'arabe', ru: 'russe', nl: 'neerlandais', pl: 'polonais' };
        const targetName = langNames[targetLang] || targetLang;
        if (activeMode === 'raw' || activeMode === 'custom') {
          systemPrompt = `Traduis fidelement le texte suivant en ${targetName}. Reponds UNIQUEMENT avec la traduction, sans explication.`;
        } else {
          const modePrompt = llmEngine.getSystemPrompt(activeMode, settings.llm.customPrompt || undefined);
          systemPrompt = `${modePrompt}\n\nIMPORTANT: Le texte final doit etre en ${targetName}. Traduis et reformule en ${targetName}.`;
        }
      } else {
        systemPrompt = llmEngine.getSystemPrompt(activeMode, settings.llm.customPrompt || undefined);
      }

      // Stream tokens to renderer
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ];

      mainWindow.webContents.send(IPC.LLM_STREAM, '\x00START');  // signal start
      const processed = await llmEngine.chatStream(messages, (token: string) => {
        mainWindow.webContents.send(IPC.LLM_STREAM, token);
      });
      mainWindow.webContents.send(IPC.LLM_STREAM, '\x00END');  // signal end

      const result = { original: text, processed, mode: activeMode };
      mainWindow.webContents.send(IPC.LLM_RESULT, result);

      // Save to history
      const historyEntry: HistoryEntry = {
        id: uuidv4(),
        timestamp: Date.now(),
        originalText: text,
        processedText: processed,
        mode: activeMode,
        language: '',
        duration: 0,
        tags: [],
        source: 'dictation',
      };
      historyService.add(historyEntry);

      return result;
    } catch (error: any) {
      mainWindow.webContents.send(IPC.LLM_STREAM, '\x00END');
      throw error;
    }
  });

  // ===== Injection =====
  ipcMain.handle(IPC.INJECT_TEXT, async (_event, text: string) => {
    console.log(`[Injection] Injecting ${text.length} chars: "${text.substring(0, 60)}"`);
    const wasVisible = mainWindow.isVisible();

    // Always hide window before paste — even if not focused, the window may
    // be on top and intercept the xdotool keypress on Linux/X11
    if (wasVisible) {
      mainWindow.hide();
      await new Promise(r => setTimeout(r, 200)); // let OS restore focus to previous app
    }

    await textInjector.injectText(text);
    console.log('[Injection] Done');

    // Restore window after paste
    if (wasVisible) {
      await new Promise(r => setTimeout(r, 150));
      mainWindow.showInactive(); // show without stealing focus
    }
  });

  ipcMain.handle(IPC.INJECT_CLIPBOARD, async (_event, text: string) => {
    textInjector.copyToClipboard(text);
  });

  // ===== History =====
  ipcMain.handle(IPC.HISTORY_GET, (_event, filter) => {
    return historyService.get(filter);
  });

  ipcMain.handle(IPC.HISTORY_SEARCH, (_event, query: string) => {
    return historyService.get({ search: query });
  });

  ipcMain.handle(IPC.HISTORY_DELETE, (_event, id: string) => {
    historyService.delete(id);
  });

  ipcMain.handle(IPC.HISTORY_ADD_TAG, (_event, id: string, tag: string) => {
    historyService.addTag(id, tag);
  });

  ipcMain.handle(IPC.HISTORY_REMOVE_TAG, (_event, id: string, tag: string) => {
    historyService.removeTag(id, tag);
  });

  ipcMain.handle(IPC.HISTORY_EXPORT, async (_event, id: string, format: string) => {
    const entry = historyService.getById(id);
    if (!entry) throw new Error('Entry not found');

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `voiceink-${id.slice(0, 8)}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });

    if (result.canceled || !result.filePath) return null;
    return exportService.exportEntry(entry, format as any, result.filePath);
  });

  // ===== Model Download =====
  ipcMain.handle(IPC.STT_DOWNLOAD_MODEL, async (_event, model: string) => {
    try {
      const modelPath = await whisperEngine.downloadModel(model as any, (progress) => {
        mainWindow.webContents.send(IPC.STT_MODEL_PROGRESS, progress);
      });
      return modelPath;
    } catch (error: any) {
      throw error;
    }
  });

  // ===== STT Status =====
  ipcMain.handle(IPC.STT_STATUS, () => {
    return whisperEngine.getModelStatus();
  });

  // ===== Chat =====
  ipcMain.handle(IPC.CHAT_SEND, async (_event, messages: { role: string; content: string }[]) => {
    try {
      const result = await llmEngine.chatStream(messages, (token: string) => {
        mainWindow.webContents.send(IPC.CHAT_STREAM, token);
      });
      return result;
    } catch (error: any) {
      console.error('Chat error:', error);
      throw error;
    }
  });

  // ===== App Controls =====
  ipcMain.on(IPC.APP_QUIT, () => {
    app.quit();
  });

  ipcMain.on(IPC.APP_MINIMIZE, () => {
    mainWindow.minimize();
  });

  ipcMain.on(IPC.APP_TOGGLE_RECORDING, () => {
    if (currentRecordingState === 'idle') {
      currentRecordingState = 'recording';
      mainWindow.webContents.send(IPC.APP_RECORDING_STATE, 'recording');
    } else if (currentRecordingState === 'recording') {
      currentRecordingState = 'processing';
      mainWindow.webContents.send(IPC.APP_RECORDING_STATE, 'processing');
    }
  });

  // ===== Compact Mode =====
  let savedBounds: { x: number; y: number; width: number; height: number } | null = null;

  ipcMain.handle(IPC.APP_COMPACT_MODE, (_event, compact: boolean, width?: number, height?: number) => {
    if (compact) {
      if (!savedBounds) savedBounds = mainWindow.getBounds();
      const display = screen.getPrimaryDisplay();
      const { width: screenW } = display.workAreaSize;
      const cw = width  || 90;
      const ch = height || 90;
      mainWindow.setMinimumSize(60, 60);
      mainWindow.setResizable(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.setBounds({ x: Math.round(screenW / 2 - cw / 2), y: 18, width: cw, height: ch });
    } else {
      // Panel mode: compact floating panel, still on top
      const pw = width  || 340;
      const ph = height || 480;
      mainWindow.setMinimumSize(280, 360);
      mainWindow.setMaximumSize(400, 520);
      mainWindow.setResizable(true);
      mainWindow.setAlwaysOnTop(true, 'floating');
      if (savedBounds) {
        const pos = mainWindow.getPosition();
        mainWindow.setBounds({ x: pos[0], y: pos[1], width: pw, height: ph });
        savedBounds = null;
      } else {
        mainWindow.setSize(pw, ph);
      }
    }
    return true;
  });

  // ===== Orb Position Persistence =====
  ipcMain.handle(IPC.APP_SET_ORB_POSITION, (_event, x: number, y: number) => {
    configService.updateSettings({ _orbPosition: { x, y } } as any);
  });

  ipcMain.handle(IPC.APP_GET_ORB_POSITION, () => {
    const settings = configService.getSettings() as any;
    return settings?._orbPosition || null;
  });
}

function sendPipelineStatus(mainWindow: BrowserWindow, status: PipelineStatus): void {
  mainWindow.webContents.send(IPC.APP_PIPELINE_STATUS, status);
}
