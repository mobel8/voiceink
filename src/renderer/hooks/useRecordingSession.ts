import { useCallback, useState, useEffect, useRef } from 'react';
import { useStore } from '../stores/useStore';
import { useAudioRecorder } from './useAudioRecorder';

export interface RecordingSession {
  toggleRecording: () => Promise<void>;
  isRecording: boolean;
  audioLevel: number;
  recordingState: string;
  error: string | null;
}

export function useRecordingSession(): RecordingSession {
  const {
    recordingState, setRecordingState,
    currentText, setCurrentText,
    processedText, setProcessedText,
    selectedMode, setSelectedMode,
    selectedLanguage, setSelectedLanguage,
    targetLanguage, setTargetLanguage,
    addToast,
    llmStreamText, setLlmStreamText, isLlmStreaming,
    setRecordingStartTime, setLastTranscriptionMs,
    setResultBubble,
  } = useStore();

  const { isRecording, audioLevel, startRecording, stopRecording, error: recorderError } = useAudioRecorder();
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const toggleRef = useRef<(() => void) | null>(null);

  const handleToggleRecording = useCallback(async () => {
    if (recordingState === 'processing') return;
    try {
      if (isRecording) {
        setRecordingState('processing');
        const t0 = Date.now();
        const audioData = await stopRecording();
        if (audioData && window.voiceink) {
          try {
            const result = await window.voiceink.transcribe(audioData, selectedLanguage);
            setLastTranscriptionMs(Date.now() - t0);
            if (result?.text) {
              setCurrentText(result.text);
              const needsTranslation = targetLanguage && targetLanguage !== '' && targetLanguage !== selectedLanguage;
              const needsLLM = selectedMode !== 'raw';
              if (!needsTranslation && !needsLLM) {
                window.voiceink.injectText(result.text).catch(() => {});
                setResultBubble({ text: result.text, mode: 'Brut' });
              } else {
                setLlmStreamText('');
                const tLang = needsTranslation ? targetLanguage : undefined;
                window.voiceink.processText(result.text, selectedMode, tLang).then((p: any) => {
                  if (p?.processed) {
                    setProcessedText(p.processed);
                    window.voiceink.injectText(p.processed).catch(() => {});
                    const modeLabels: Record<string, string> = {
                      raw: 'Brut', email: 'Email', short_message: 'Message',
                      meeting_notes: 'Notes', summary: 'Résumé', formal: 'Formel',
                      simplified: 'Simple', custom: 'Custom',
                    };
                    setResultBubble({ text: p.processed, mode: modeLabels[selectedMode] || selectedMode });
                  }
                }).catch(() => {
                  window.voiceink.injectText(result.text).catch(() => {});
                  setResultBubble({ text: result.text, mode: 'Brut' });
                });
              }
            } else {
              setTranscriptionError('Aucune parole détectée.');
            }
          } catch (err: any) {
            setTranscriptionError(err?.message || 'Erreur de transcription');
          }
        }
        setRecordingState('idle');
        setRecordingStartTime(null);
      } else {
        setCurrentText(''); setProcessedText(''); setLlmStreamText('');
        setTranscriptionError(null);
        setResultBubble(null);
        setRecordingState('recording');
        setRecordingStartTime(Date.now());
        await startRecording();
      }
    } catch (err: any) {
      setTranscriptionError(err?.message || "Erreur d'enregistrement");
      setRecordingState('idle');
      setRecordingStartTime(null);
    }
  }, [
    isRecording, recordingState, startRecording, stopRecording,
    setRecordingState, setCurrentText, setProcessedText, selectedMode,
    setLlmStreamText, setRecordingStartTime, setLastTranscriptionMs,
    selectedLanguage, targetLanguage, setResultBubble,
  ]);

  toggleRef.current = handleToggleRecording;

  // Global shortcut listener
  useEffect(() => {
    if (!window.voiceink?.onToggleRecording) return;
    return window.voiceink.onToggleRecording(() => toggleRef.current?.());
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault(); e.stopPropagation();
        toggleRef.current?.();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);

  return {
    toggleRecording: handleToggleRecording,
    isRecording,
    audioLevel,
    recordingState,
    error: recorderError || transcriptionError,
  };
}
