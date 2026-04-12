import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '../stores/useStore';

declare global {
  interface Window {
    voiceink: any;
  }
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  error: string | null;
}

// Encode raw PCM Float32 samples into a 16-bit mono WAV ArrayBuffer
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeStr(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);        // chunk size
  view.setUint16(20, 1, true);         // PCM format
  view.setUint16(22, 1, true);         // mono
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate (16-bit mono)
  view.setUint16(32, 2, true);         // block align
  view.setUint16(34, 16, true);        // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

// Trim silence from both ends of PCM data (RMS threshold over 100ms windows)
function trimSilence(samples: Float32Array, sampleRate: number): Float32Array {
  const windowSize = Math.floor(sampleRate * 0.1); // 100ms window
  const threshold = 0.01;

  // Find first non-silent window from start
  let start = 0;
  for (let i = 0; i <= samples.length - windowSize; i += windowSize) {
    let sumSq = 0;
    for (let j = i; j < i + windowSize; j++) {
      sumSq += samples[j] * samples[j];
    }
    const rms = Math.sqrt(sumSq / windowSize);
    if (rms > threshold) {
      start = Math.max(0, i - windowSize); // keep 100ms before speech
      break;
    }
  }

  // Find first non-silent window from end
  let end = samples.length;
  for (let i = samples.length - windowSize; i >= 0; i -= windowSize) {
    let sumSq = 0;
    for (let j = i; j < i + windowSize; j++) {
      sumSq += samples[j] * samples[j];
    }
    const rms = Math.sqrt(sumSq / windowSize);
    if (rms > threshold) {
      end = Math.min(samples.length, i + windowSize * 2); // keep 100ms after speech
      break;
    }
  }

  if (end <= start) return samples; // all silence, return as-is
  return samples.subarray(start, end);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // Process in 8KB chunks to avoid call stack overflow and speed up encoding
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    const slice = bytes.subarray(i, Math.min(i + 8192, bytes.length));
    chunks.push(String.fromCharCode.apply(null, slice as any));
  }
  return btoa(chunks.join(''));
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const samplesRef = useRef<Float32Array[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);
    }
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      samplesRef.current = [];

      const settings = useStore.getState().settings;
      const audioSettings = settings?.audio;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: audioSettings?.noiseReduction ?? true,
          autoGainControl: audioSettings?.autoGain ?? true,
        },
      });
      streamRef.current = stream;

      // AudioContext at 16kHz for whisper.cpp compatibility
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      // Analyser for level meter
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // ScriptProcessorNode to capture raw PCM samples
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        samplesRef.current.push(new Float32Array(input)); // must copy
      };
      source.connect(processor);

      // Connect through silent gain so the processor actually fires
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);
      processorRef.current = processor;

      setIsRecording(true);
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    } catch (err: any) {
      setError(err.message || "Impossible d'accéder au microphone");
      console.error('Recording error:', err);
    }
  }, [updateAudioLevel]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    const t0 = performance.now();

    // Disconnect & close everything
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const sampleRate = audioContextRef.current?.sampleRate || 16000;

    if (audioContextRef.current) {
      try { await audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsRecording(false);
    setAudioLevel(0);

    // Concatenate all captured PCM chunks
    const chunks = samplesRef.current;
    samplesRef.current = [];
    if (chunks.length === 0) return null;

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    if (totalLen === 0) return null;

    const pcm = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      pcm.set(chunk, offset);
      offset += chunk.length;
    }
    const tConcat = performance.now();

    // Trim silence from both ends to reduce audio sent to whisper
    const trimmed = trimSilence(pcm, sampleRate);
    const tTrim = performance.now();

    // Encode as 16-bit mono WAV
    const wavBuf = encodeWav(trimmed, sampleRate);
    const tEncode = performance.now();

    const b64 = arrayBufferToBase64(wavBuf);
    const tB64 = performance.now();

    console.log(`[Audio] stop=${Math.round(tConcat - t0)}ms trim=${Math.round(tTrim - tConcat)}ms wav=${Math.round(tEncode - tTrim)}ms b64=${Math.round(tB64 - tEncode)}ms | ${trimmed.length} samples ${Math.round(wavBuf.byteLength / 1024)}KB`);
    return `data:audio/wav;base64,${b64}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processorRef.current) processorRef.current.disconnect();
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch {}
      }
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return { isRecording, audioLevel, startRecording, stopRecording, error };
}
