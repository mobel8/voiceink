// Cartesia Sonic-2 — WebSocket streaming TTS.
//
// WHY websocket and not HTTP?
//   Cartesia publishes both, but the WS path streams the first audio
//   chunk ~40 ms after the server accepts the prompt — the HTTP path
//   waits for the full prompt to be tokenised before returning. For
//   an interpreter where every millisecond is user-perceivable we
//   use WS.
//
// Protocol (as of 2025):
//   connect  : wss://api.cartesia.ai/tts/websocket
//              ?api_key=...&cartesia_version=2024-11-13
//   send     : JSON { model_id, transcript, voice:{mode:'id',id},
//                     output_format:{container:'mp3',sample_rate,bit_rate,encoding:'mp3'},
//                     language?, speed?, context_id, continue:false }
//   receive  : { type:'chunk', data:<base64 mp3>, context_id, done }
//              { type:'done',  context_id }
//              { type:'error', error, context_id }
//
// All three providers in our fleet deliver MP3 so the renderer has a
// single playback path (MediaSource with 'audio/mpeg').

import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { TTSChunk, TTSStreamOptions } from './index';

// WS endpoint. Overridable via env var `VOICEINK_CARTESIA_WS_URL`
// for local tests against a mock server — never document this publicly
// since pointing end-users at a custom URL would leak their API key.
const WS_ENDPOINT = process.env.VOICEINK_CARTESIA_WS_URL || 'wss://api.cartesia.ai/tts/websocket';
const CARTESIA_VERSION = '2024-11-13';

/** Minimum language subset Cartesia Sonic-2 supports well. */
const SUPPORTED_LANGS = new Set([
  'en', 'fr', 'de', 'es', 'pt', 'zh', 'ja', 'hi', 'it', 'ko',
  'nl', 'pl', 'ru', 'sv', 'tr',
]);

export async function* streamCartesia(
  apiKey: string,
  opts: TTSStreamOptions,
): AsyncGenerator<TTSChunk, void, void> {
  const text = (opts.text || '').trim();
  if (!text) return;

  const lang = opts.language && SUPPORTED_LANGS.has(opts.language.toLowerCase())
    ? opts.language.toLowerCase()
    : 'en';
  const speed = clampSpeed(opts.speed);

  const url = `${WS_ENDPOINT}?api_key=${encodeURIComponent(apiKey)}` +
    `&cartesia_version=${CARTESIA_VERSION}`;

  const ws = new WebSocket(url);
  const contextId = randomUUID();

  // Queue of incoming chunks. We use a two-pointer buffer: the WS
  // callbacks push, the generator awaits. A `done` or `error` closes
  // the stream cleanly.
  type Msg =
    | { kind: 'chunk'; buf: Buffer }
    | { kind: 'done' }
    | { kind: 'error'; err: Error };
  const queue: Msg[] = [];
  let waiters: Array<(m: Msg) => void> = [];
  const push = (m: Msg) => {
    const w = waiters.shift();
    if (w) w(m); else queue.push(m);
  };
  const pull = (): Promise<Msg> =>
    new Promise((resolve) => {
      const m = queue.shift();
      if (m) resolve(m); else waiters.push(resolve);
    });

  // Abort plumbing — propagate renderer cancellation to the WS.
  const onAbort = () => {
    try { ws.close(1000, 'aborted'); } catch {}
    push({ kind: 'error', err: new Error('Interpreter aborted') });
  };
  opts.signal?.addEventListener('abort', onAbort, { once: true });

  ws.on('open', () => {
    const payload = {
      model_id: 'sonic-2',
      transcript: text,
      voice: { mode: 'id', id: opts.voiceId || '794f9389-aac1-45b6-b726-9d9369183238' },
      output_format: {
        container: 'mp3',
        sample_rate: 44100,
        bit_rate: 128000,
        encoding: 'mp3',
      },
      language: lang,
      speed,
      context_id: contextId,
      continue: false,
    };
    try {
      ws.send(JSON.stringify(payload));
    } catch (err: any) {
      push({ kind: 'error', err: new Error(`Cartesia WS send failed: ${err?.message || err}`) });
    }
  });

  ws.on('message', (raw: Buffer) => {
    let parsed: any;
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch {
      // Binary frames aren't expected with this config (MP3 is base64
      // inside a JSON envelope) — ignore.
      return;
    }
    if (parsed?.context_id && parsed.context_id !== contextId) return;

    if (parsed?.type === 'chunk' && typeof parsed.data === 'string' && parsed.data.length > 0) {
      try {
        const buf = Buffer.from(parsed.data, 'base64');
        if (buf.length > 0) push({ kind: 'chunk', buf });
      } catch {
        // Malformed chunk — ignore, the next one usually arrives fine.
      }
      if (parsed.done === true) push({ kind: 'done' });
    } else if (parsed?.type === 'done') {
      push({ kind: 'done' });
    } else if (parsed?.type === 'error') {
      const msg = typeof parsed.error === 'string' ? parsed.error : 'Cartesia TTS error';
      push({ kind: 'error', err: new Error(`Cartesia: ${msg}`) });
    }
  });

  ws.on('close', (code: number, reason: Buffer) => {
    // Push a sentinel in case the remote closed without sending 'done'
    // (rare, but possible on network drops). Harmless if 'done' already
    // arrived because the generator returns at the first terminal msg.
    push({ kind: 'done' });
    if (code !== 1000 && code !== 1005) {
      const txt = reason?.toString?.('utf8') || '';
      push({ kind: 'error', err: new Error(`Cartesia WS closed ${code} ${txt}`.trim()) });
    }
  });

  ws.on('error', (err: Error) => {
    push({ kind: 'error', err: new Error(`Cartesia WS error: ${err.message}`) });
  });

  try {
    while (true) {
      const msg = await pull();
      if (msg.kind === 'chunk') {
        yield { chunk: msg.buf, mime: 'audio/mpeg' };
      } else if (msg.kind === 'done') {
        return;
      } else {
        throw msg.err;
      }
    }
  } finally {
    opts.signal?.removeEventListener('abort', onAbort);
    try { ws.close(1000, 'done'); } catch {}
  }
}

function clampSpeed(x: number | undefined): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 1.0;
  return Math.min(2.0, Math.max(0.5, x));
}
