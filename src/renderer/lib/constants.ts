import { Mode } from '../../shared/types';

export const MODE_LABELS: Record<Mode, { label: string; desc: string; icon: string }> = {
  raw:     { label: 'Brut',    desc: 'Transcription exacte, aucun post-traitement',     icon: '✒️' },
  natural: { label: 'Naturel', desc: 'Ponctuation + retrait des hésitations, voix intacte', icon: '🪶' },
  formal:  { label: 'Formel',  desc: 'Registre soutenu, courtois, phrases complètes',    icon: '🎩' },
  message: { label: 'Message', desc: 'Court, conversationnel, 1 à 3 phrases',             icon: '💬' },
};

export const SUPPORTED_LANGUAGES = [
  { code: 'auto', label: 'Détection auto' },
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'ru', label: 'Русский' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
  { code: 'ar', label: 'العربية' },
];

export const GROQ_STT_MODELS = [
  { id: 'whisper-large-v3-turbo', label: 'Whisper Large v3 Turbo (rapide, recommandé)' },
  { id: 'whisper-large-v3', label: 'Whisper Large v3 (précis)' },
  { id: 'distil-whisper-large-v3-en', label: 'Distil Whisper (anglais only)' },
];

/**
 * Targets available for automatic translation. Empty code = no translation.
 * Uses native language names so the user recognises them instantly.
 */
export const TRANSLATE_TARGETS = [
  { code: '',   label: 'Aucune (garder la langue d\'origine)', native: '' },
  { code: 'fr', label: 'Français',  native: 'Français' },
  { code: 'en', label: 'English',   native: 'English' },
  { code: 'es', label: 'Español',   native: 'Español' },
  { code: 'de', label: 'Deutsch',   native: 'Deutsch' },
  { code: 'it', label: 'Italiano',  native: 'Italiano' },
  { code: 'pt', label: 'Português', native: 'Português' },
  { code: 'nl', label: 'Nederlands',native: 'Nederlands' },
  { code: 'pl', label: 'Polski',    native: 'Polski' },
  { code: 'ru', label: 'Русский',   native: 'Русский' },
  { code: 'ja', label: '日本語',      native: '日本語' },
  { code: 'zh', label: '中文',       native: '中文' },
  { code: 'ko', label: '한국어',       native: '한국어' },
  { code: 'ar', label: 'العربية',     native: 'العربية' },
];

export const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'French', en: 'English', es: 'Spanish', de: 'German',
  it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish',
  ru: 'Russian', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
  ar: 'Arabic',
};
