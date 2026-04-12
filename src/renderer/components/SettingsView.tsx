import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Download, Check, Loader2, Eye, EyeOff } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { useTranslation } from '../i18n/useTranslation';
import type { AppSettings, STTModel, STTProvider, LLMProvider, PrivacyMode } from '@shared/types';
import type { TranslationKey } from '../i18n/translations';

const STT_MODELS: { value: STTModel; label: string; size: string }[] = [
  { value: 'tiny',   label: 'Tiny',   size: '75 MB'  },
  { value: 'base',   label: 'Base',   size: '142 MB' },
  { value: 'small',  label: 'Small',  size: '466 MB' },
  { value: 'medium', label: 'Medium', size: '1.5 GB' },
  { value: 'large',  label: 'Large',  size: '3.1 GB' },
];

type SettingsTab = 'audio' | 'stt' | 'llm' | 'shortcuts' | 'privacy' | 'ui';

/* ─── Shared field wrapper ─── */
const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
      {label}
    </label>
    {children}
    {hint && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</p>}
  </div>
);

/* ─── Toggle ─── */
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={value} aria-label={label}
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: value ? 'var(--accent)' : 'var(--bg-tertiary)',
        transition: 'background 0.2s ease', position: 'relative', flexShrink: 0,
        outline: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute', top: 2, left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: 'white', transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
}

/* ─── Password input ─── */
function ApiKeyInput({
  value, onChange, placeholder, keyId, showKeys, toggleKey,
}: {
  value: string; onChange: (v: string) => void;
  placeholder: string; keyId: string;
  showKeys: Record<string, boolean>;
  toggleKey: (k: string) => void;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={showKeys[keyId] ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-base"
        style={{ paddingRight: 36 }}
      />
      <button
        onClick={() => toggleKey(keyId)}
        style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
        }}
      >
        {showKeys[keyId] ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

/* ─── Section header ─── */
const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
    marginBottom: 10, marginTop: 4,
  }}>
    {children}
  </p>
);

/* ─── Row with label + control ─── */
const Row = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</p>
      {desc && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{desc}</p>}
    </div>
    {children}
  </div>
);

export function SettingsView() {
  const { settings, setSettings, modelDownloadProgress, addToast, theme, setTheme } = useStore();
  const { t } = useTranslation();
  const [local, setLocal]      = useState<AppSettings | null>(null);
  const [downloading, setDl]   = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [tab, setTab]          = useState<SettingsTab>('audio');

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: 'audio',    label: t('settings.tab.audio') },
    { id: 'stt',      label: t('settings.tab.stt') },
    { id: 'llm',      label: t('settings.tab.llm') },
    { id: 'shortcuts',label: t('settings.tab.shortcuts') },
    { id: 'privacy',  label: t('settings.tab.privacy') },
    { id: 'ui',       label: t('settings.tab.ui') },
  ];

  const STT_PROVIDERS: { value: STTProvider; label: string; desc: string }[] = [
    { value: 'groq',   label: t('stt.groq'),    desc: t('stt.groqDesc') },
    { value: 'local',  label: t('stt.local'),   desc: t('stt.localDesc') },
    { value: 'openai', label: t('stt.openai'),  desc: t('stt.openaiDesc') },
    { value: 'glm',    label: t('stt.glm'),     desc: t('stt.glmDesc') },
  ];

  const LLM_PROVIDERS: { value: LLMProvider; label: string; desc: string }[] = [
    { value: 'none',      label: t('settings.llm.none'),    desc: t('settings.llm.noneDesc') },
    { value: 'ollama',    label: 'Ollama',                   desc: t('settings.llm.ollamaDesc') },
    { value: 'openai',    label: 'OpenAI',                   desc: t('llm.openaiDesc') },
    { value: 'anthropic', label: 'Anthropic',                desc: t('llm.anthropicDesc') },
    { value: 'glm',       label: 'GLM Flash',                desc: t('llm.glmDesc') },
  ];

  useEffect(() => {
    if (settings) setLocal({ ...settings });
  }, [settings]);

  if (!local) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader2 size={22} style={{ color: 'var(--accent)' }} className="spin-smooth" />
      </div>
    );
  }

  const set = (section: string, field: string, value: any) =>
    setLocal((prev) => prev ? { ...prev, [section]: { ...(prev as any)[section], [field]: value } } : prev);

  const handleSave = async () => {
    if (local && window.voiceink) {
      const updated = await window.voiceink.setSettings(local);
      setSettings(updated);
      addToast({ type: 'success', message: t('settings.saved') });
    }
  };

  const handleReset = async () => {
    if (window.voiceink) {
      const d = await window.voiceink.resetSettings();
      setLocal(d); setSettings(d);
      addToast({ type: 'info', message: t('settings.resetDone') });
    }
  };

  const handleDownload = async (model: STTModel) => {
    if (!window.voiceink) return;
    setDl(true);
    try {
      await window.voiceink.downloadModel(model);
      addToast({ type: 'success', message: t('settings.modelDownloaded').replace('{model}', model) });
    } catch {
      addToast({ type: 'error', message: t('settings.downloadError') });
    }
    setDl(false);
  };

  const toggleKey = (k: string) => setShowKeys((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div
      className="flex flex-col h-full animate-fade-in"
      style={{ background: 'var(--gradient-surface)' }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {t('settings.title')}
        </h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleReset} className="btn-ghost">
            <RotateCcw size={11} /> {t('common.reset')}
          </button>
          <button onClick={handleSave} className="btn-accent">
            <Save size={11} /> {t('common.save')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="scrollbar-hide"
        style={{
          display: 'flex', gap: 2, padding: '0 12px',
          borderBottom: '1px solid var(--border-subtle)',
          overflowX: 'auto', flexShrink: 0,
        }}
        role="tablist"
      >
        {TABS.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            style={{
              padding: '8px 10px',
              fontSize: 11, fontWeight: tab === tb.id ? 600 : 500,
              whiteSpace: 'nowrap',
              color: tab === tb.id ? 'var(--accent)' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === tb.id ? 'var(--accent)' : 'transparent'}`,
              cursor: 'pointer', transition: 'all 0.15s ease',
              marginBottom: -1,
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '16px', minHeight: 0 }}
        role="tabpanel"
      >

        {/* ── Audio ── */}
        {tab === 'audio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader>{t('settings.audio.capture')}</SectionHeader>
            <Field label={t('settings.audio.sensitivity')}>
              <input
                type="range" min="0" max="1" step="0.05"
                value={local.audio.sensitivity}
                onChange={(e) => set('audio', 'sensitivity', parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {Math.round(local.audio.sensitivity * 100)}%
              </span>
            </Field>
            <SectionHeader>{t('settings.audio.processing')}</SectionHeader>
            <Row label={t('settings.audio.noiseReduction')} desc={t('settings.audio.noiseReductionDesc')}>
              <Toggle value={local.audio.noiseReduction} onChange={(v) => set('audio', 'noiseReduction', v)} label={t('settings.audio.noiseReduction')} />
            </Row>
            <Row label={t('settings.audio.autoGain')} desc={t('settings.audio.autoGainDesc')}>
              <Toggle value={local.audio.autoGain} onChange={(v) => set('audio', 'autoGain', v)} label={t('settings.audio.autoGain')} />
            </Row>
          </div>
        )}

        {/* ── STT ── */}
        {tab === 'stt' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionHeader>{t('settings.stt.provider')}</SectionHeader>

            {/* Provider cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STT_PROVIDERS.map((p) => {
                const active = local.stt.provider === p.value;
                return (
                  <div
                    key={p.value}
                    onClick={() => set('stt', 'provider', p.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--pill-active-border)' : 'var(--border)'}`,
                      background: active ? 'var(--accent-subtle)' : 'var(--bg-input)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${active ? 'var(--accent)' : 'var(--text-muted)'}`,
                        background: active ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'white' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{p.label}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{p.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Groq key */}
            {local.stt.provider === 'groq' && (
              <Field label={t('settings.stt.groqKey')} hint={t('settings.stt.groqKeyHint')}>
                <ApiKeyInput
                  value={local.stt.groqApiKey || ''} onChange={(v) => set('stt', 'groqApiKey', v)}
                  placeholder="gsk_..." keyId="groq" showKeys={showKeys} toggleKey={toggleKey}
                />
              </Field>
            )}

            {/* OpenAI STT key */}
            {local.stt.provider === 'openai' && (
              <Field label={t('settings.stt.openaiKey')}>
                <ApiKeyInput
                  value={local.stt.openaiApiKey || ''} onChange={(v) => set('stt', 'openaiApiKey', v)}
                  placeholder="sk-..." keyId="stt_openai" showKeys={showKeys} toggleKey={toggleKey}
                />
              </Field>
            )}

            {/* Local models */}
            {local.stt.provider === 'local' && (
              <>
                <SectionHeader>{t('settings.stt.whisperModel')}</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {STT_MODELS.map((m) => {
                    const active = local.stt.localModel === m.value;
                    return (
                      <div
                        key={m.value}
                        onClick={() => set('stt', 'localModel', m.value)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                          border: `1px solid ${active ? 'var(--pill-active-border)' : 'var(--border)'}`,
                          background: active ? 'var(--accent-subtle)' : 'var(--bg-input)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {active && <Check size={11} style={{ color: 'var(--accent)' }} />}
                          <span style={{ fontSize: 12, fontWeight: 500, color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{m.label}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.size}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(m.value); }}
                          disabled={downloading}
                          className="btn-ghost"
                          style={{ padding: '3px 8px', fontSize: 10 }}
                        >
                          {downloading
                            ? <><Loader2 size={9} className="spin-smooth" />{modelDownloadProgress > 0 ? `${modelDownloadProgress}%` : '…'}</>
                            : <><Download size={9} />{t('common.download')}</>
                          }
                        </button>
                      </div>
                    );
                  })}
                </div>
                <Row label={t('settings.stt.gpuAccel')}>
                  <Toggle value={local.stt.gpuEnabled} onChange={(v) => set('stt', 'gpuEnabled', v)} label="GPU" />
                </Row>
                <Row label={t('settings.stt.autoDetect')} desc={t('settings.stt.autoDetectDesc')}>
                  <Toggle value={local.stt.autoDetectLanguage} onChange={(v) => set('stt', 'autoDetectLanguage', v)} label="Auto" />
                </Row>
              </>
            )}
          </div>
        )}

        {/* ── LLM ── */}
        {tab === 'llm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionHeader>{t('settings.llm.provider')}</SectionHeader>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {LLM_PROVIDERS.map((p) => {
                const active = local.llm.provider === p.value;
                return (
                  <div
                    key={p.value}
                    onClick={() => set('llm', 'provider', p.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--pill-active-border)' : 'var(--border)'}`,
                      background: active ? 'var(--accent-subtle)' : 'var(--bg-input)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${active ? 'var(--accent)' : 'var(--text-muted)'}`,
                      background: active ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'white' }} />}
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{p.label}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{p.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {local.llm.provider === 'ollama' && (
              <>
                <Field label={t('settings.llm.ollamaUrl')}>
                  <input type="text" className="input-base" value={local.llm.ollamaUrl} onChange={(e) => set('llm', 'ollamaUrl', e.target.value)} />
                </Field>
                <Field label={t('settings.llm.ollamaModel')}>
                  <input type="text" className="input-base" value={local.llm.ollamaModel} onChange={(e) => set('llm', 'ollamaModel', e.target.value)} placeholder="mistral, llama3, gemma2…" />
                </Field>
              </>
            )}
            {local.llm.provider === 'openai' && (
              <>
                <Field label={t('settings.llm.openaiKey')}>
                  <ApiKeyInput value={local.llm.openaiApiKey} onChange={(v) => set('llm', 'openaiApiKey', v)} placeholder="sk-..." keyId="openai" showKeys={showKeys} toggleKey={toggleKey} />
                </Field>
                <Field label={t('settings.llm.model')}>
                  <input type="text" className="input-base" value={local.llm.openaiModel} onChange={(e) => set('llm', 'openaiModel', e.target.value)} />
                </Field>
              </>
            )}
            {local.llm.provider === 'anthropic' && (
              <>
                <Field label={t('settings.llm.anthropicKey')}>
                  <ApiKeyInput value={local.llm.anthropicApiKey} onChange={(v) => set('llm', 'anthropicApiKey', v)} placeholder="sk-ant-..." keyId="anthropic" showKeys={showKeys} toggleKey={toggleKey} />
                </Field>
                <Field label={t('settings.llm.model')}>
                  <input type="text" className="input-base" value={local.llm.anthropicModel} onChange={(e) => set('llm', 'anthropicModel', e.target.value)} />
                </Field>
              </>
            )}
            {local.llm.provider === 'glm' && (
              <>
                <Field label={t('settings.llm.glmKey')}>
                  <ApiKeyInput value={local.llm.glmApiKey} onChange={(v) => set('llm', 'glmApiKey', v)} placeholder="votre-clé-api…" keyId="glm" showKeys={showKeys} toggleKey={toggleKey} />
                </Field>
                <Field label={t('settings.llm.model')}>
                  <input type="text" className="input-base" value={local.llm.glmModel} onChange={(e) => set('llm', 'glmModel', e.target.value)} placeholder="glm-4-flash" />
                </Field>
              </>
            )}

            {local.llm.provider !== 'none' && (
              <>
                <Field label={`${t('settings.llm.temperature')} — ${local.llm.temperature.toFixed(2)}`}>
                  <input type="range" min="0" max="1" step="0.05" value={local.llm.temperature} onChange={(e) => set('llm', 'temperature', parseFloat(e.target.value))} style={{ width: '100%' }} />
                </Field>
                <Field label={t('settings.llm.customPrompt')} hint={t('settings.llm.customPromptHint')}>
                  <textarea
                    value={local.llm.customPrompt}
                    onChange={(e) => set('llm', 'customPrompt', e.target.value)}
                    className="input-base"
                    style={{ resize: 'none', height: 72 }}
                    placeholder={t('settings.llm.customPromptPlaceholder')}
                  />
                </Field>
              </>
            )}
          </div>
        )}

        {/* ── Shortcuts ── */}
        {tab === 'shortcuts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionHeader>{t('settings.shortcuts.global')}</SectionHeader>
            <Field label={t('settings.shortcuts.toggleRecord')}>
              <input type="text" className="input-base" value={local.shortcuts.toggleRecording} onChange={(e) => set('shortcuts', 'toggleRecording', e.target.value)} style={{ fontFamily: 'ui-monospace, monospace' }} />
            </Field>
          </div>
        )}

        {/* ── Privacy ── */}
        {tab === 'privacy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SectionHeader>{t('settings.privacy.mode')}</SectionHeader>
            {(
              [
                { mode: 'local'  as PrivacyMode, labelKey: 'settings.privacy.local' as TranslationKey,    descKey: 'settings.privacy.localDesc' as TranslationKey,    color: '#34d399' },
                { mode: 'hybrid' as PrivacyMode, labelKey: 'settings.privacy.hybrid' as TranslationKey,    descKey: 'settings.privacy.hybridDesc' as TranslationKey,   color: '#fbbf24' },
                { mode: 'cloud'  as PrivacyMode, labelKey: 'settings.privacy.cloud' as TranslationKey,     descKey: 'settings.privacy.cloudDesc' as TranslationKey,    color: '#f87171' },
              ] as const
            ).map(({ mode, labelKey, descKey, color }) => {
              const active = local.privacy === mode;
              return (
                <div
                  key={mode}
                  onClick={() => setLocal((p) => p ? { ...p, privacy: mode } : p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 11, cursor: 'pointer',
                    border: `1px solid ${active ? color + '44' : 'var(--border)'}`,
                    background: active ? color + '10' : 'var(--bg-input)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: active ? color : 'var(--text-muted)',
                    boxShadow: active ? `0 0 8px ${color}` : 'none',
                  }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: active ? color : 'var(--text-primary)' }}>{t(labelKey)}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{t(descKey)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── UI ── */}
        {tab === 'ui' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader>{t('settings.ui.language')}</SectionHeader>
            <Row label={t('settings.ui.language')} desc={t('settings.ui.languageDesc')}>
              <select
                className="input-base"
                value={local.ui.language || 'fr'}
                onChange={(e) => set('ui', 'language', e.target.value)}
                style={{ width: 120 }}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </Row>

            <SectionHeader>{t('settings.ui.appearance')}</SectionHeader>
            <div style={{ display: 'flex', gap: 8 }}>
              {([{ id: 'dark', label: t('settings.ui.dark') }, { id: 'light', label: t('settings.ui.light') }] as const).map((tb) => (
                <button
                  key={tb.id}
                  onClick={async () => {
                    setTheme(tb.id);
                    set('ui', 'theme', tb.id);
                    if (local && window.voiceink) {
                      const updated = { ...local, ui: { ...local.ui, theme: tb.id } };
                      await window.voiceink.setSettings(updated);
                    }
                  }}
                  style={{
                    flex: 1, padding: '9px', borderRadius: 9, fontSize: 11, fontWeight: 600,
                    border: `1px solid ${theme === tb.id ? 'var(--pill-active-border)' : 'var(--border)'}`,
                    background: theme === tb.id ? 'var(--accent-subtle)' : 'var(--bg-input)',
                    color: theme === tb.id ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            <SectionHeader>{t('settings.ui.behavior')}</SectionHeader>
            <Row label={t('settings.ui.minimizeToTray')} desc={t('settings.ui.minimizeToTrayDesc')}>
              <Toggle value={local.ui.minimizeToTray} onChange={(v) => set('ui', 'minimizeToTray', v)} label="Tray" />
            </Row>
            <Row label={t('settings.ui.startMinimized')}>
              <Toggle value={local.ui.startMinimized} onChange={(v) => set('ui', 'startMinimized', v)} label={t('settings.ui.startMinimized')} />
            </Row>
            <Row label={t('settings.ui.showOverlay')}>
              <Toggle value={local.ui.showOverlay} onChange={(v) => set('ui', 'showOverlay', v)} label="Overlay" />
            </Row>
          </div>
        )}
      </div>
    </div>
  );
}
