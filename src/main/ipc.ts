import { ipcMain, clipboard, app, dialog, BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';
import { IPC, TranscribeResponse, Settings } from '../shared/types';
import { getSettings, setSettings } from './services/config';
import { transcribeWithGroq } from './engines/whisper';
import { postProcess, translateText } from './engines/llm';
import {
  listHistory,
  addHistory,
  deleteHistory,
  clearHistory,
  togglePinHistory,
  getUsageStats,
  exportHistory,
} from './services/history';
import { injectText, copyToClipboard } from './services/injection';
import { applyReplacements, wordCount } from './services/replacements';
import {
  sanitizeSettingsPatch,
  validateHistoryId,
  validateExportFormat,
  validateTranscribeRequest,
  validateText,
} from './services/validate';

export function registerIpc(): void {
  ipcMain.handle(IPC.GET_SETTINGS, (): Settings => getSettings());
  ipcMain.handle(IPC.SET_SETTINGS, (_e, patch: unknown) => setSettings(sanitizeSettingsPatch(patch)));

  ipcMain.handle(IPC.GET_HISTORY, () => listHistory());
  ipcMain.handle(IPC.ADD_HISTORY, (_e, entry) => addHistory(entry));
  ipcMain.handle(IPC.DELETE_HISTORY, (_e, id: unknown) => {
    const safe = validateHistoryId(id);
    if (!safe) return;
    return deleteHistory(safe);
  });
  ipcMain.handle(IPC.CLEAR_HISTORY, () => clearHistory());
  ipcMain.handle(IPC.TOGGLE_PIN_HISTORY, (_e, id: unknown) => {
    const safe = validateHistoryId(id);
    if (!safe) return false;
    return togglePinHistory(safe);
  });
  ipcMain.handle(IPC.GET_USAGE_STATS, () => getUsageStats());

  ipcMain.handle(IPC.EXPORT_HISTORY, async (event, rawFormat: unknown) => {
    const format = validateExportFormat(rawFormat);
    if (!format) return { ok: false, error: 'invalid format' };
    const { filename, content } = exportHistory(format);
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];
    const res = await dialog.showSaveDialog(win!, {
      title: 'Exporter l\'historique',
      defaultPath: filename,
      filters: [
        format === 'json'     ? { name: 'JSON',     extensions: ['json'] } :
        format === 'markdown' ? { name: 'Markdown', extensions: ['md'] } :
        format === 'csv'      ? { name: 'CSV',      extensions: ['csv'] } :
                                { name: 'Texte',    extensions: ['txt'] },
      ],
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    try {
      await writeFile(res.filePath, content, 'utf-8');
      return { ok: true, path: res.filePath };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle(IPC.SET_AUTO_START, (_e, enabled: unknown) => {
    const flag = !!enabled; // explicit boolean coerce
    try {
      app.setLoginItemSettings({
        openAtLogin: flag,
        // --hidden is read by main/index.ts to decide whether to hide the window on startup.
        args: flag ? ['--hidden'] : [],
      });
      setSettings({ autoStart: flag });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle(IPC.COPY_TEXT, (_e, text: unknown) => {
    const safe = validateText(text);
    if (safe === null) return;
    copyToClipboard(safe);
  });
  ipcMain.handle(IPC.INJECT_TEXT, (_e, text: unknown) => {
    const safe = validateText(text);
    if (safe === null) return;
    return injectText(safe);
  });

  ipcMain.handle(IPC.TRANSCRIBE, async (_e, rawReq: unknown): Promise<TranscribeResponse> => {
    const req = validateTranscribeRequest(rawReq);
    if (!req) {
      return { ok: false, rawText: '', finalText: '', durationMs: 0, error: 'invalid request' };
    }
    const t0 = Date.now();
    try {
      const settings = getSettings();
      const buf = Buffer.from(req.audioBase64, 'base64');
      console.log(`[transcribe] received audio: ${buf.length} bytes (${req.mimeType})`);
      if (buf.length < 500) {
        throw new Error('Audio trop court / silencieux. Parlez un peu plus longtemps.');
      }

      const t1 = Date.now();
      const r = await transcribeWithGroq(buf, req.mimeType, settings);
      const t2 = Date.now();
      console.log(`[transcribe] groq whisper: ${t2 - t1}ms → "${r.text.slice(0, 80)}" (lang=${r.language || '?'})`);

      // Custom dictionary (replacements) — applied to the RAW Whisper output
      // before anything else so translation / LLM see the corrected text.
      let rawText = r.text;
      if (settings.replacementsEnabled !== false && settings.replacements?.length) {
        const rs = Date.now();
        rawText = applyReplacements(rawText, settings.replacements);
        if (rawText !== r.text) {
          console.log(`[transcribe] applied ${settings.replacements.length} replacement rule(s) in ${Date.now() - rs}ms`);
        }
      }

      // Automatic translation if target language requested (explicit in request
      // takes precedence over stored setting).
      const translateTo = (req.translateTo !== undefined ? req.translateTo : settings.translateTo) || '';
      let translated: string | null = null;
      if (translateTo && rawText.trim()) {
        const ts = Date.now();
        translated = await translateText(rawText, translateTo, settings, r.language);
        console.log(`[transcribe] translation → ${translateTo}: ${Date.now() - ts}ms`);
      }

      // LLM post-processing operates on whichever text we'll present
      // (translated if any, else raw) so the reformulation is in the
      // final target language. postProcess resolves the {{LANG}}
      // placeholder internally from (1) the explicit translation
      // target, (2) Whisper's detected language, or (3) the user's
      // language setting — in that order.
      let final = translated ?? rawText;
      if (req.mode !== 'raw') {
        const ps = Date.now();
        const langHint = translateTo || r.language;
        final = await postProcess(final, req.mode, settings, langHint);
        console.log(`[transcribe] llm post-process mode=${req.mode}: ${Date.now() - ps}ms`);
      }

      const durationMs = Date.now() - t0;

      addHistory({
        id: randomUUID(),
        createdAt: Date.now(),
        rawText,
        finalText: final,
        mode: req.mode,
        language: r.language || req.language || 'auto',
        translatedTo: translateTo || undefined,
        durationMs,
        audioMs: 0,
        tags: [],
        wordCount: wordCount(final),
      });

      if (settings.autoCopy || settings.autoInject) {
        try { clipboard.writeText(final); } catch {}
      }

      return {
        ok: true,
        rawText,
        finalText: final,
        detectedLanguage: r.language,
        translatedTo: translateTo || undefined,
        durationMs,
      };
    } catch (err: any) {
      console.error('[transcribe] error:', err?.message || err);
      return {
        ok: false,
        rawText: '',
        finalText: '',
        durationMs: Date.now() - t0,
        error: err?.message || String(err),
      };
    }
  });
}
