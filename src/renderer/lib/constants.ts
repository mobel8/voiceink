import { FileText, Feather, Scroll, MessageSquare, type LucideIcon } from 'lucide-react';
import { Mode } from '../../shared/types';

/**
 * Per-mode presentation data.
 *
 *   - label : short French name shown in dropdowns.
 *   - desc  : one-line description for settings / tooltips.
 *   - icon  : emoji string. Kept because <option> elements and the
 *             history-badge can't render React components, so those two
 *             call sites inline the emoji directly. Persisted history
 *             entries also still reference this field shape.
 *   - Icon  : Lucide React component. Used by <ModePicker> in MainView
 *             so the chip swaps its leading icon when the user changes
 *             mode, matching the rest of the picker chips (language,
 *             translate) which all use Lucide line icons.
 */
export const MODE_LABELS: Record<Mode, {
  label: string;
  desc: string;
  icon: string;
  Icon: LucideIcon;
}> = {
  raw:     { label: 'Brut',    desc: 'Transcription exacte, aucun post-traitement',            icon: '📝', Icon: FileText },
  natural: { label: 'Naturel', desc: 'Ponctuation + retrait des hésitations, voix intacte',    icon: '🪶', Icon: Feather },
  formal:  { label: 'Formel',  desc: 'Registre soutenu, vocabulaire élevé, phrases complètes', icon: '📜', Icon: Scroll },
  message: { label: 'Message', desc: 'Compression courte, conversationnel, 1 à 3 phrases',    icon: '💬', Icon: MessageSquare },
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
