// Cartesia Sonic-2 — HTTP chunked streaming TTS via /tts/bytes.
//
// WHY /tts/bytes and not /tts/sse or /tts/websocket?
//   As of 2025-04 Cartesia enforces `container: 'raw'` (raw PCM) on
//   both /tts/websocket and /tts/sse endpoints. Only /tts/bytes
//   accepts `container: 'mp3'` while still returning the audio in
//   HTTP/1.1 chunked transfer encoding, which keeps the pipeline
//   incremental (TTFB ~300 ms, first MP3 frame arrives ~1 ms after
//   the headers).
//
//   Using MP3 rather than raw PCM keeps the renderer playback path
//   uniform across all three providers (ElevenLabs, OpenAI, Cartesia
//   all emit audio/mpeg chunks fed into a single MediaSource
//   SourceBuffer with mime='audio/mpeg'). Switching to PCM would
//   require adding a WebAudio decoder path only for Cartesia.
//
// Protocol (as of 2025-04):
//   POST https://api.cartesia.ai/tts/bytes
//   Headers: X-API-Key, Cartesia-Version: 2024-11-13,
//            Content-Type: application/json
//   Body (JSON):
//     { model_id: 'sonic-2',
//       transcript,
//       voice: { mode:'id', id },
//       output_format: { container:'mp3', sample_rate:44100, bit_rate:128000 },
//       language?, speed? }
//   Response: Content-Type: audio/mpeg, Transfer-Encoding: chunked.
//             Body = raw MP3 bytes, one frame per chunk (~400-600 B).
//
// All three providers in our fleet deliver MP3 so the renderer has a
// single playback path (MediaSource with 'audio/mpeg').

import { TTSChunk, TTSStreamOptions } from './index';

// HTTP endpoint. Overridable via env var `VOICEINK_CARTESIA_URL` for
// local tests against a mock server — never document publicly since
// pointing end-users at a custom URL would leak their API key.
const CARTESIA_URL =
  process.env.VOICEINK_CARTESIA_URL ||
  process.env.VOICEINK_CARTESIA_WS_URL ||  // legacy name kept as alias
  'https://api.cartesia.ai/tts/bytes';
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

  const payload = {
    model_id: 'sonic-2',
    transcript: text,
    voice: { mode: 'id', id: opts.voiceId || '794f9389-aac1-45b6-b726-9d9369183238' },
    output_format: {
      container: 'mp3',
      sample_rate: 44100,
      bit_rate: 128000,
    },
    language: lang,
    speed,
  };

  // Node's global fetch (Node 20+) returns a Web ReadableStream on
  // res.body. With Transfer-Encoding: chunked, each reader.read()
  // returns one TCP chunk (~400-600 bytes) which we forward verbatim
  // to the renderer.
  const res = await fetch(CARTESIA_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Cartesia-Version': CARTESIA_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await safeReadText(res);
    throw new Error(`Cartesia HTTP ${res.status}: ${body || res.statusText}`);
  }
  if (!res.body) {
    throw new Error('Cartesia: no response body');
  }

  const reader = (res.body as any).getReader
    ? (res.body as ReadableStream<Uint8Array>).getReader()
    : null;
  if (!reader) throw new Error('Cartesia: response body is not a web stream');

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value && value.length > 0) {
        yield { chunk: Buffer.from(value), mime: 'audio/mpeg' };
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

async function safeReadText(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 500); } catch { return ''; }
}

function clampSpeed(x: number | undefined): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 1.0;
  return Math.min(2.0, Math.max(0.5, x));
}
