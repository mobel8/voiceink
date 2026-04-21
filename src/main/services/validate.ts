/**
 * Tiny runtime validators for the IPC boundary.
 *
 * The renderer is already trusted (contextIsolation + sandbox + strict CSP)
 * but these guards are a defense-in-depth layer: if the renderer is ever
 * compromised (e.g. via a supply-chain vulnerability), these prevent the
 * most obvious abuses — oversized strings that OOM the main process,
 * malformed identifiers used to read/delete arbitrary history entries,
 * accidental injection of unexpected settings fields etc.
 *
 * Kept intentionally minimal: we sanitize the few values that actually
 * matter for safety or persistence, and drop everything else. We do NOT
 * try to exhaustively validate every Settings field — that's what the
 * TypeScript types (and electron-store's merge) are for.
 */

import { Settings, TranscribeRequest } from '../../shared/types';

/** Upper bound on how big an audio payload we accept in a single IPC call. */
const MAX_AUDIO_BASE64_LEN = 32 * 1024 * 1024; // ~24 MB decoded, enough for long dictations
/** Upper bound on an arbitrary text payload (e.g. clipboard text). */
const MAX_TEXT_LEN = 256 * 1024; // 256 kB
/** Upper bound on API keys / free-form settings strings. */
const MAX_KEY_LEN = 2048;

export function isString(x: unknown): x is string {
  return typeof x === 'string';
}
export function isBoolean(x: unknown): x is boolean {
  return typeof x === 'boolean';
}
export function isNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}
export function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Narrow a string to a finite set of literals. */
export function isOneOf<T extends string>(x: unknown, allowed: readonly T[]): x is T {
  return typeof x === 'string' && (allowed as readonly string[]).includes(x);
}

/** Truncate a string to an upper bound. Returns undefined if not a string. */
export function clampString(x: unknown, max: number): string | undefined {
  return isString(x) ? x.slice(0, max) : undefined;
}

/**
 * Validate a history-entry ID. We generate UUIDs via `crypto.randomUUID`
 * but accept any reasonably short printable string to avoid false rejects
 * for legacy entries. Path-separator characters are forbidden to stop any
 * attempt to reuse the id as a filesystem path.
 */
export function validateHistoryId(x: unknown): string | null {
  if (!isString(x)) return null;
  const s = x.trim();
  if (s.length === 0 || s.length > 128) return null;
  if (/[\\/\0\r\n]/.test(s)) return null;
  return s;
}

/** Validate an export format. */
export function validateExportFormat(x: unknown): 'json' | 'markdown' | 'txt' | 'csv' | null {
  return isOneOf(x, ['json', 'markdown', 'txt', 'csv'] as const) ? x : null;
}

/** Validate a transcribe request coming from the renderer. */
export function validateTranscribeRequest(x: unknown): TranscribeRequest | null {
  if (!isObject(x)) return null;
  const audioBase64 = x.audioBase64;
  if (!isString(audioBase64) || audioBase64.length === 0) return null;
  if (audioBase64.length > MAX_AUDIO_BASE64_LEN) return null;
  // Rough sanity check: base64 alphabet only.
  if (!/^[A-Za-z0-9+/=\s]+$/.test(audioBase64)) return null;
  const mimeType = isString(x.mimeType) ? x.mimeType.slice(0, 64) : 'audio/webm';
  const mode = isOneOf(
    x.mode,
    ['raw', 'natural', 'formal', 'message'] as const,
  )
    ? (x.mode as TranscribeRequest['mode'])
    : 'raw';
  const language = clampString(x.language, 16);
  const translateTo = clampString(x.translateTo, 16);
  return { audioBase64, mimeType, mode, language, translateTo };
}

/** Clamp an arbitrary text string (clipboard / injection). */
export function validateText(x: unknown): string | null {
  if (!isString(x)) return null;
  return x.slice(0, MAX_TEXT_LEN);
}

/**
 * Sanitize an untrusted settings patch. We pick only known-safe primitive
 * fields and drop everything else. Large strings are truncated to protect
 * the store file from being blown up.
 */
export function sanitizeSettingsPatch(raw: unknown): Partial<Settings> {
  if (!isObject(raw)) return {};
  const p = raw as Record<string, unknown>;
  const out: Partial<Settings> = {};

  // Strings (API keys, model names, language codes, etc.)
  const stringFields: Array<[keyof Settings, number]> = [
    ['groqApiKey', MAX_KEY_LEN],
    ['sttModel', 256],
    ['llmProvider', 32],
    ['llmApiKey', MAX_KEY_LEN],
    ['llmModel', 256],
    ['mode', 16],
    ['language', 16],
    ['translateTo', 16],
    ['translateModel', 256],
    ['shortcutToggle', 128],
    ['shortcutPTT', 128],
    ['themeId', 64],
    ['density', 16],
  ];
  for (const [k, max] of stringFields) {
    const v = clampString(p[k as string], max);
    if (v !== undefined) (out as any)[k] = v;
  }

  // Booleans
  const boolFields: Array<keyof Settings> = [
    'llmEnabled',
    'autoCopy',
    'autoInject',
    'pttEnabled',
    'autoStart',
    'alwaysOnTop',
    'replacementsEnabled',
    'startMinimized',
    'soundsEnabled',
  ];
  for (const k of boolFields) {
    if (isBoolean(p[k as string])) (out as any)[k] = p[k as string];
  }

  // Structured fields — pass through as-is if shape looks plausible.
  // We rely on the downstream code to be defensive about unexpected shapes
  // rather than re-validating every sub-field here.
  if (Array.isArray(p.replacements)) out.replacements = p.replacements as any;
  if (isObject(p.themeEffects)) out.themeEffects = p.themeEffects as any;
  if (isObject(p.widgetBounds)) out.widgetBounds = p.widgetBounds as any;
  else if (p.widgetBounds === null) out.widgetBounds = null;

  // Enforce the density enum explicitly (several code paths branch on it).
  if (out.density && out.density !== 'compact' && out.density !== 'comfortable') {
    delete out.density;
  }

  return out;
}
