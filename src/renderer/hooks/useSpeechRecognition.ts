import { useState, useRef, useCallback } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: (lang?: string) => void;
  stopListening: () => Promise<string>;
  error: string | null;
  isSupported: boolean;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const resolveRef = useRef<((value: string) => void) | null>(null);
  const fullTranscriptRef = useRef('');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSupported = !!SpeechRecognition;

  const startListening = useCallback((lang: string = 'fr-FR') => {
    if (!SpeechRecognition) {
      setError('La reconnaissance vocale n\'est pas supportée dans ce navigateur.');
      return;
    }

    setError(null);
    setTranscript('');
    setInterimTranscript('');
    fullTranscriptRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        fullTranscriptRef.current = final.trim();
        setTranscript(final.trim());
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        setError('Aucune parole détectée. Parlez plus fort ou vérifiez votre micro.');
      } else if (event.error === 'audio-capture') {
        setError('Impossible d\'accéder au microphone.');
      } else if (event.error === 'not-allowed') {
        setError('Permission micro refusée.');
      } else {
        setError(`Erreur de reconnaissance: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (resolveRef.current) {
        resolveRef.current(fullTranscriptRef.current);
        resolveRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [SpeechRecognition]);

  const stopListening = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (!recognitionRef.current) {
        resolve(fullTranscriptRef.current);
        return;
      }
      resolveRef.current = resolve;
      recognitionRef.current.stop();
    });
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    error,
    isSupported,
  };
}
