// Renderer-side MP3 streaming player for the interpreter.
//
// The main process pushes base64-encoded MP3 chunks as they arrive
// from the TTS provider. We assemble them into a MediaSource-backed
// <audio> element so playback starts at the FIRST chunk — no waiting
// for the full utterance.
//
// Why MediaSource and not repeated Audio+URL.createObjectURL?
//   Repeated blob-url swaps restart playback at 0 and cause audible
//   gaps. MediaSource appends bytes to the same SourceBuffer so the
//   decoder sees an uninterrupted MP3 stream.
//
// Fallback path: if `MediaSource.isTypeSupported('audio/mpeg')` is
// false (rare; Chromium Linux builds without the MP3 codec), we fall
// back to a simple blob-url mode that plays only once all chunks are
// in — still functional, just latency-heavier.

import type { InterpretChunkEvent } from '../../shared/types';

export interface InterpretPlayerEvents {
  onFirstChunk?: (ttfbClientMs: number) => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

export class InterpretPlayer {
  private readonly requestId: string;
  private readonly audio: HTMLAudioElement;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private readonly pendingChunks: Uint8Array[] = [];
  private firstChunkAt = 0;
  private startAt = 0;
  private ended = false;
  private disposed = false;
  private readonly events: InterpretPlayerEvents;
  /** Fallback mode: accumulate into a single Blob, play at end. */
  private readonly fallbackBytes: Uint8Array[] = [];
  private useFallback = false;

  constructor(requestId: string, events: InterpretPlayerEvents = {}) {
    this.requestId = requestId;
    this.events = events;
    this.audio = new Audio();
    this.audio.autoplay = true;
    this.audio.preload = 'auto';
    this.audio.onerror = () => {
      // Media decoding error — surface as a player error but do not
      // retry here (the chunk protocol is one-shot).
      const err = this.audio.error;
      const code = err?.code ?? -1;
      this.events.onError?.(new Error(`Audio element error (code ${code})`));
    };
    this.audio.onended = () => {
      this.events.onEnd?.();
    };

    const MIME = 'audio/mpeg';
    if (typeof window !== 'undefined'
        && 'MediaSource' in window
        && (window as any).MediaSource.isTypeSupported?.(MIME)) {
      this.mediaSource = new MediaSource();
      this.audio.src = URL.createObjectURL(this.mediaSource);
      this.mediaSource.addEventListener('sourceopen', () => {
        try {
          const sb = this.mediaSource!.addSourceBuffer(MIME);
          sb.mode = 'sequence';
          sb.addEventListener('updateend', () => this.flushPending());
          this.sourceBuffer = sb;
          this.flushPending();
        } catch (err: any) {
          // Some platforms refuse to add an MP3 SourceBuffer even when
          // isTypeSupported returns true — fall back to Blob playback.
          this.useFallback = true;
          this.events.onError?.(new Error(`addSourceBuffer failed: ${err?.message || err}`));
        }
      });
    } else {
      this.useFallback = true;
    }
    this.startAt = Date.now();
  }

  /** Feed an inbound IPC chunk. Silently ignores chunks for other requestIds. */
  push(evt: InterpretChunkEvent): void {
    if (this.disposed) return;
    if (evt.requestId !== this.requestId) return;
    if (evt.error) {
      this.events.onError?.(new Error(evt.error));
      this.dispose();
      return;
    }

    if (evt.chunkBase64) {
      if (this.firstChunkAt === 0) {
        this.firstChunkAt = Date.now();
        this.events.onFirstChunk?.(this.firstChunkAt - this.startAt);
      }
      const bytes = base64ToUint8Array(evt.chunkBase64);
      if (this.useFallback) {
        this.fallbackBytes.push(bytes);
      } else {
        this.pendingChunks.push(bytes);
        this.flushPending();
      }
    }

    if (evt.done) {
      if (this.useFallback) {
        // Build a final blob URL and play.
        try {
          const blob = new Blob(this.fallbackBytes as BlobPart[], { type: 'audio/mpeg' });
          this.audio.src = URL.createObjectURL(blob);
          this.audio.play().catch((err) => {
            this.events.onError?.(new Error(`Fallback play failed: ${err?.message || err}`));
          });
        } catch (err: any) {
          this.events.onError?.(new Error(`Fallback assembly failed: ${err?.message || err}`));
        }
      } else if (this.mediaSource && this.mediaSource.readyState === 'open') {
        // Defer endOfStream() until any pending append flushes.
        const finish = () => {
          try {
            if (this.mediaSource && this.mediaSource.readyState === 'open') {
              this.mediaSource.endOfStream();
            }
          } catch { /* ignore — some browsers throw if already closed */ }
        };
        if (this.sourceBuffer && this.sourceBuffer.updating) {
          this.sourceBuffer.addEventListener('updateend', finish, { once: true });
        } else {
          finish();
        }
      }
      this.ended = true;
    }
  }

  /** True once every chunk has been consumed and sent to the audio element. */
  isEnded(): boolean {
    return this.ended;
  }

  /** Tear down the player, stopping playback and releasing resources. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    } catch { /* ignore */ }
    try {
      if (this.mediaSource && this.mediaSource.readyState === 'open') {
        this.mediaSource.endOfStream();
      }
    } catch { /* ignore */ }
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.pendingChunks.length = 0;
    this.fallbackBytes.length = 0;
  }

  private flushPending(): void {
    const sb = this.sourceBuffer;
    if (!sb || sb.updating || this.pendingChunks.length === 0) return;
    const next = this.pendingChunks.shift()!;
    try {
      // Pass an ArrayBuffer explicitly (not the Uint8Array view) to
      // dodge a strict-TS incompatibility between Uint8Array<ArrayBufferLike>
      // and SourceBuffer.appendBuffer(BufferSource).
      sb.appendBuffer(next.buffer.slice(next.byteOffset, next.byteOffset + next.byteLength) as ArrayBuffer);
    } catch (err: any) {
      // QuotaExceededError if the buffer is saturated — for short
      // utterances this shouldn't happen, but put the chunk back and
      // retry on the next updateend tick.
      this.pendingChunks.unshift(next);
      if (err?.name !== 'QuotaExceededError') {
        this.events.onError?.(new Error(`appendBuffer failed: ${err?.message || err}`));
      }
    }
  }
}

function base64ToUint8Array(b64: string): Uint8Array {
  // atob is available in renderer (Electron = Chromium). The main
  // process sends us pure base64 (no data-URL prefix).
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
