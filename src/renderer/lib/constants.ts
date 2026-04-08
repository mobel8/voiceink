// Runtime constants for the renderer process
// These are duplicated from src/shared/types.ts to avoid cross-directory
// module resolution issues with Vite's dev server.

type ProcessingMode =
  | 'raw'
  | 'email'
  | 'short_message'
  | 'meeting_notes'
  | 'summary'
  | 'formal'
  | 'simplified'
  | 'custom';

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
] as const;

export const MODE_LABELS: Record<ProcessingMode, string> = {
  raw: 'Texte brut',
  email: 'Email professionnel',
  short_message: 'Message court',
  meeting_notes: 'Notes de réunion',
  summary: 'Résumé',
  formal: 'Reformulation formelle',
  simplified: 'Reformulation simplifiée',
  custom: 'Mode personnalisé',
};
