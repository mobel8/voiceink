import { ipcMain, clipboard, app, dialog, BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';
import { IPC, TranscribeResponse, InterpretResponse, InterpretChunkEvent, Settings, VoiceInfo, TTSProvider } from '../shared/types';
import { getSettings, setSettings } from './services/config';
import { transcribeWithGroq } from './engines/whisper';
import { postProcess, translateText } from './engines/llm';
import { streamTTS } from './engines/tts';
import { listVoices } from './engines/tts/catalog';
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
  validateInterpretRequest,
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

  // -------------------------------------------------------------------
  // INTERPRETER — voice-to-voice translation pipeline.
  //
  //   Audio in (Whisper) → translated text (Groq llama) → streamed
  //   MP3 chunks pushed to the renderer via IPC.ON_INTERPRET_CHUNK.
  //
  // The handler returns the final metadata (rawText, translatedText,
  // ttfbMs) synchronously once the last chunk has been emitted, so the
  // renderer can show latency stats next to the classic transcribe
  // ones. Chunks are streamed as soon as they arrive from the TTS
  // provider — playback begins ~300-800 ms after end-of-audio on a
  // cold path.
  // -------------------------------------------------------------------
  ipcMain.handle(IPC.INTERPRET, async (event, rawReq: unknown): Promise<InterpretResponse> => {
    const req = validateInterpretRequest(rawReq);
    if (!req) {
      return {
        ok: false, requestId: '', rawText: '', translatedText: '',
        durationMs: 0, error: 'invalid request',
      };
    }
    const sender = event.sender;
    const send = (payload: InterpretChunkEvent) => {
      if (!sender.isDestroyed()) {
        sender.send(IPC.ON_INTERPRET_CHUNK, payload);
      }
    };

    const t0 = Date.now();
    let seq = 0;
    let ttfbMs: number | undefined;
    try {
      const settings = getSettings();
      const buf = Buffer.from(req.audioBase64, 'base64');
      console.log(`[interpret] received audio: ${buf.length} bytes (${req.mimeType}) → ${req.targetLang}`);
      if (buf.length < 500) {
        throw new Error('Audio trop court / silencieux. Parlez un peu plus longtemps.');
      }

      // 1) Whisper transcription in the SOURCE language.
      const t1 = Date.now();
      const sourceLangHint = req.sourceLang && req.sourceLang !== 'auto' ? req.sourceLang : '';
      const whisperSettings = sourceLangHint
        ? { ...settings, language: sourceLangHint }
        : settings;
      const r = await transcribeWithGroq(buf, req.mimeType, whisperSettings);
      console.log(`[interpret] whisper: ${Date.now() - t1}ms → "${r.text.slice(0, 80)}" (lang=${r.language || '?'})`);

      let rawText = r.text;
      if (settings.replacementsEnabled !== false && settings.replacements?.length) {
        rawText = applyReplacements(rawText, settings.replacements);
      }

      if (!rawText.trim()) {
        throw new Error('Aucune parole détectée dans l\'audio.');
      }

      // 2) Translation to the target language — reuse the same
      //    translateText machinery as the classic pipeline.
      const t2 = Date.now();
      const translated = await translateText(rawText, req.targetLang, settings, r.language);
      console.log(`[interpret] translate → ${req.targetLang}: ${Date.now() - t2}ms`);

      // 3) TTS streaming — forward every MP3 chunk to the renderer as
      //    soon as it arrives. The `ttfbMs` metric is measured at the
      //    first chunk so the UI can display the perceived latency.
      const t3 = Date.now();
      const ttsIter = streamTTS(settings, translated, { language: req.targetLang });
      for await (const { chunk, mime } of ttsIter) {
        if (ttfbMs === undefined) {
          ttfbMs = Date.now() - t3;
          console.log(`[interpret] tts first chunk: ${ttfbMs}ms`);
        }
        send({
          requestId: req.requestId,
          seq: seq++,
          chunkBase64: chunk.toString('base64'),
          mime,
          done: false,
        });
      }
      // Flush sentinel so the renderer can close its MediaSource buffer.
      send({ requestId: req.requestId, seq: seq++, chunkBase64: '', mime: 'audio/mpeg', done: true });

      const durationMs = Date.now() - t0;
      console.log(`[interpret] done: total=${durationMs}ms, ttfb=${ttfbMs}ms, chunks=${seq}`);

      addHistory({
        id: randomUUID(),
        createdAt: Date.now(),
        rawText,
        finalText: translated,
        mode: 'raw',
        language: r.language || req.sourceLang || 'auto',
        translatedTo: req.targetLang,
        durationMs,
        audioMs: 0,
        tags: ['interpret'],
        wordCount: wordCount(translated),
      });

      return {
        ok: true,
        requestId: req.requestId,
        rawText,
        translatedText: translated,
        detectedLanguage: r.language,
        durationMs,
        ttfbMs,
      };
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[interpret] error:', msg);
      // Tell the renderer to tear down its player.
      send({
        requestId: req.requestId,
        seq: seq++,
        chunkBase64: '',
        mime: 'audio/mpeg',
        done: true,
        error: msg,
      });
      return {
        ok: false,
        requestId: req.requestId,
        rawText: '',
        translatedText: '',
        durationMs: Date.now() - t0,
        error: msg,
      };
    }
  });

  // -------------------------------------------------------------------
  // LIST_VOICES — fetch the live voice catalog from a TTS provider so
  // the Settings UI can render a filterable picker with every available
  // voice (~100 from Cartesia, 30+ premade ElevenLabs, 11 OpenAI).
  //
  // The renderer caches the list client-side for 1h per provider, so
  // this handler is called rarely (on Settings mount + manual refresh).
  // -------------------------------------------------------------------
  ipcMain.handle(IPC.LIST_VOICES, async (_e, providerRaw: unknown): Promise<VoiceInfo[]> => {
    const provider = (typeof providerRaw === 'string' ? providerRaw : '') as TTSProvider;
    if (!['cartesia', 'elevenlabs', 'openai'].includes(provider)) {
      return [];
    }
    const settings = getSettings();
    const apiKey = settings.ttsApiKey?.[provider] || '';
    try {
      const list = await listVoices(provider, apiKey);
      console.log(`[voices] ${provider}: ${list.length} voices`);
      return list;
    } catch (err: any) {
      console.error(`[voices] ${provider} error:`, err?.message || err);
      return [];
    }
  });

  // -------------------------------------------------------------------
  // SPEAK — simple text-to-speech bypassing Whisper. Streams MP3 chunks
  // on the same IPC.ON_INTERPRET_CHUNK channel so the renderer can
  // reuse the existing InterpretPlayer. Used by the Listener's audio
  // mode (the text is already in the target language so we just need
  // voice synthesis).
  // -------------------------------------------------------------------
  ipcMain.handle(IPC.SPEAK, async (event, rawReq: unknown): Promise<{ ok: boolean; ttfbMs?: number; error?: string; requestId: string }> => {
    const req = rawReq as { requestId: string; text: string; language?: string };
    if (!req || !req.requestId || !req.text?.trim()) {
      return { ok: false, requestId: req?.requestId || '', error: 'invalid request' };
    }
    const sender = event.sender;
    const send = (payload: InterpretChunkEvent) => {
      if (!sender.isDestroyed()) sender.send(IPC.ON_INTERPRET_CHUNK, payload);
    };
    let seq = 0;
    let ttfbMs: number | undefined;
    try {
      const settings = getSettings();
      const t0 = Date.now();
      const iter = streamTTS(settings, req.text, { language: req.language });
      for await (const { chunk, mime } of iter) {
        if (ttfbMs === undefined) ttfbMs = Date.now() - t0;
        send({
          requestId: req.requestId,
          seq: seq++,
          chunkBase64: chunk.toString('base64'),
          mime,
          done: false,
        });
      }
      send({ requestId: req.requestId, seq: seq++, chunkBase64: '', mime: 'audio/mpeg', done: true });
      return { ok: true, ttfbMs, requestId: req.requestId };
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[speak] error:', msg);
      send({ requestId: req.requestId, seq: seq++, chunkBase64: '', mime: 'audio/mpeg', done: true, error: msg });
      return { ok: false, error: msg, requestId: req.requestId };
    }
  });

  // -------------------------------------------------------------------
  // LISTENER_TRANSCRIBE — one-shot audio segment → transcription +
  // optional translation. Called by the listener hook once per VAD
  // segment. Returns *both* the source transcription and the translated
  // text so the UI can render side-by-side. If listenerMode='audio',
  // the renderer itself kicks off a TTS playback via IPC.INTERPRET —
  // no new pipeline needed here, just the text response.
  // -------------------------------------------------------------------
  ipcMain.handle(IPC.LISTENER_TRANSCRIBE, async (_e, rawReq: unknown): Promise<{
    ok: boolean;
    text: string;
    translated?: string;
    sourceLang?: string;
    error?: string;
  }> => {
    try {
      const req = rawReq as { audioBase64: string; mimeType: string; targetLang: string; sourceLang?: string };
      if (!req || typeof req.audioBase64 !== 'string' || !req.audioBase64) {
        return { ok: false, text: '', error: 'invalid request' };
      }
      const settings = getSettings();
      const buf = Buffer.from(req.audioBase64, 'base64');
      if (buf.length < 500) {
        return { ok: false, text: '', error: 'audio too short' };
      }
      const sourceLangHint = req.sourceLang && req.sourceLang !== 'auto' ? req.sourceLang : '';
      const whisperSettings = sourceLangHint ? { ...settings, language: sourceLangHint } : settings;
      const wh = await transcribeWithGroq(buf, req.mimeType, whisperSettings);
      const text = (settings.replacementsEnabled && settings.replacements?.length)
        ? applyReplacements(wh.text, settings.replacements)
        : wh.text;
      if (!text.trim()) {
        return { ok: true, text: '', sourceLang: wh.language };
      }
      let translated: string | undefined;
      const tgt = req.targetLang;
      // Only translate if target differs from detected source.
      if (tgt && tgt !== wh.language && tgt !== sourceLangHint) {
        try {
          translated = await translateText(text, tgt, settings, wh.language);
        } catch (err: any) {
          console.warn('[listener] translate failed:', err?.message);
          // Graceful degradation — still return the transcription.
        }
      }
      return { ok: true, text, translated, sourceLang: wh.language };
    } catch (err: any) {
      console.error('[listener] error:', err?.message || err);
      return { ok: false, text: '', error: err?.message || String(err) };
    }
  });
}
