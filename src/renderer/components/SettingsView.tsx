import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Download, Check, Loader2, Eye, EyeOff } from 'lucide-react';
import { useStore } from '../stores/useStore';
import type { AppSettings, STTModel, STTProvider, LLMProvider, PrivacyMode } from '@shared/types';

const STT_MODELS: { value: STTModel; label: string; size: string }[] = [
  { value: 'tiny', label: 'Tiny', size: '~75 MB' },
  { value: 'base', label: 'Base', size: '~142 MB' },
  { value: 'small', label: 'Small', size: '~466 MB' },
  { value: 'medium', label: 'Medium', size: '~1.5 GB' },
  { value: 'large', label: 'Large', size: '~3.1 GB' },
];

const STT_PROVIDERS: { value: STTProvider; label: string }[] = [
  { value: 'groq', label: 'Groq Whisper (instant, gratuit)' },
  { value: 'local', label: 'Whisper local' },
  { value: 'openai', label: 'OpenAI Whisper (cloud)' },
  { value: 'glm', label: 'GLM Flash Cloud' },
];

const LLM_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: 'none', label: 'Aucun (texte brut)' },
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'glm', label: 'GLM Flash (Zhipu AI)' },
];

type SettingsTab = 'audio' | 'stt' | 'llm' | 'shortcuts' | 'privacy' | 'ui';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'audio', label: 'Audio' },
  { id: 'stt', label: 'STT' },
  { id: 'llm', label: 'LLM' },
  { id: 'shortcuts', label: 'Raccourcis' },
  { id: 'privacy', label: 'Confidentialité' },
  { id: 'ui', label: 'Interface' },
];

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className="w-10 h-5 rounded-full transition-colors"
      style={{ background: value ? 'var(--accent)' : 'var(--border)' }}
    >
      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function SettingsView() {
  const { settings, setSettings, modelDownloadProgress, addToast, theme, setTheme } = useStore();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');

  useEffect(() => {
    if (settings) {
      setLocalSettings({ ...settings });
    }
  }, [settings]);

  if (!localSettings) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[var(--accent)]" size={24} />
      </div>
    );
  }

  const updateField = (section: string, field: string, value: any) => {
    setLocalSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: {
          ...(prev as any)[section],
          [field]: value,
        },
      };
    });
  };

  const handleSave = async () => {
    if (localSettings && window.voiceink) {
      const updated = await window.voiceink.setSettings(localSettings);
      setSettings(updated);
      addToast({ type: 'success', message: 'Paramètres sauvegardés' });
    }
  };

  const handleReset = async () => {
    if (window.voiceink) {
      const defaults = await window.voiceink.resetSettings();
      setLocalSettings(defaults);
      setSettings(defaults);
      addToast({ type: 'info', message: 'Paramètres réinitialisés' });
    }
  };

  const handleDownloadModel = async (model: STTModel) => {
    if (window.voiceink) {
      setDownloading(true);
      try {
        await window.voiceink.downloadModel(model);
        addToast({ type: 'success', message: `Modèle ${model} téléchargé` });
      } catch (err) {
        addToast({ type: 'error', message: 'Erreur de téléchargement' });
      }
      setDownloading(false);
    }
  };

  const toggleApiKeyVisibility = (key: string) => {
    setShowApiKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--bg-secondary)]">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Paramètres</h1>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <RotateCcw size={12} />
            Réinitialiser
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Save size={12} />
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-6 border-b border-[var(--bg-secondary)] gap-0.5 overflow-x-auto" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-[var(--accent)] border-[var(--accent)]'
                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4" role="tabpanel">

        {/* === Audio === */}
        {activeTab === 'audio' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">Sensibilité du micro</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={localSettings.audio.sensitivity}
                onChange={(e) => updateField('audio', 'sensitivity', parseFloat(e.target.value))}
                className="w-full accent-[#6c5ce7]"
              />
              <span className="text-xs text-[var(--text-muted)]">{Math.round(localSettings.audio.sensitivity * 100)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-[var(--text-secondary)]">Réduction de bruit</label>
              <Toggle value={localSettings.audio.noiseReduction} onChange={(v) => updateField('audio', 'noiseReduction', v)} label="Réduction de bruit" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-[var(--text-secondary)]">Gain automatique</label>
              <Toggle value={localSettings.audio.autoGain} onChange={(v) => updateField('audio', 'autoGain', v)} label="Gain automatique" />
            </div>
          </div>
        )}

        {/* === STT Model === */}
        {activeTab === 'stt' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">Fournisseur STT</label>
              <select
                value={localSettings.stt.provider}
                onChange={(e) => updateField('stt', 'provider', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
              >
                {STT_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              {localSettings.stt.provider === 'groq' && (
                <div className="mt-2">
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Cle API Groq (gratuite sur console.groq.com)</label>
                  <div className="relative">
                    <input
                      type={showApiKeys.groq ? 'text' : 'password'}
                      value={localSettings.stt.groqApiKey || ''}
                      onChange={(e) => updateField('stt', 'groqApiKey', e.target.value)}
                      className="w-full px-3 py-2 pr-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                      placeholder="gsk_..."
                    />
                    <button
                      onClick={() => toggleApiKeyVisibility('groq')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      {showApiKeys.groq ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--accent)] mt-1">Whisper large-v3-turbo — transcription en &lt;1 seconde</p>
                </div>
              )}
              {localSettings.stt.provider === 'glm' && (
                <p className="text-xs text-[var(--text-muted)] mt-1">Utilise la cle API GLM configuree dans l'onglet LLM</p>
              )}
            </div>
            {localSettings.stt.provider === 'local' && STT_MODELS.map((model) => (
              <div
                key={model.value}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer
                  ${localSettings.stt.localModel === model.value
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--hover-bg)]'}`}
                onClick={() => updateField('stt', 'localModel', model.value)}
              >
                <div>
                  <span className="text-sm text-[var(--text-primary)]">{model.label}</span>
                  <span className="text-xs text-[var(--text-muted)] ml-2">{model.size}</span>
                </div>
                <div className="flex items-center gap-2">
                  {localSettings.stt.localModel === model.value && (
                    <Check size={14} className="text-[var(--accent)]" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownloadModel(model.value); }}
                    disabled={downloading}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
                  >
                    {downloading ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                    {downloading && modelDownloadProgress > 0 ? `${modelDownloadProgress}%` : 'Télécharger'}
                  </button>
                </div>
              </div>
            ))}
            {localSettings.stt.provider === 'local' && (
              <div className="flex items-center justify-between mt-3">
                <label className="text-xs text-[var(--text-secondary)]">Utiliser GPU</label>
                <Toggle value={localSettings.stt.gpuEnabled} onChange={(v) => updateField('stt', 'gpuEnabled', v)} label="Utiliser GPU" />
              </div>
            )}
          </div>
        )}

        {/* === LLM === */}
        {activeTab === 'llm' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">Fournisseur</label>
              <select
                value={localSettings.llm.provider}
                onChange={(e) => updateField('llm', 'provider', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
              >
                {LLM_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {localSettings.llm.provider === 'ollama' && (
              <>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">URL Ollama</label>
                  <input
                    type="text"
                    value={localSettings.llm.ollamaUrl}
                    onChange={(e) => updateField('llm', 'ollamaUrl', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Modèle Ollama</label>
                  <input
                    type="text"
                    value={localSettings.llm.ollamaModel}
                    onChange={(e) => updateField('llm', 'ollamaModel', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                    placeholder="mistral, llama3, etc."
                  />
                </div>
              </>
            )}

            {localSettings.llm.provider === 'openai' && (
              <>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Clé API OpenAI</label>
                  <div className="relative">
                    <input
                      type={showApiKeys.openai ? 'text' : 'password'}
                      value={localSettings.llm.openaiApiKey}
                      onChange={(e) => updateField('llm', 'openaiApiKey', e.target.value)}
                      className="w-full px-3 py-2 pr-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                      placeholder="sk-..."
                    />
                    <button
                      onClick={() => toggleApiKeyVisibility('openai')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      {showApiKeys.openai ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Modèle</label>
                  <input
                    type="text"
                    value={localSettings.llm.openaiModel}
                    onChange={(e) => updateField('llm', 'openaiModel', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                  />
                </div>
              </>
            )}

            {localSettings.llm.provider === 'anthropic' && (
              <>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Clé API Anthropic</label>
                  <div className="relative">
                    <input
                      type={showApiKeys.anthropic ? 'text' : 'password'}
                      value={localSettings.llm.anthropicApiKey}
                      onChange={(e) => updateField('llm', 'anthropicApiKey', e.target.value)}
                      className="w-full px-3 py-2 pr-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                      placeholder="sk-ant-..."
                    />
                    <button
                      onClick={() => toggleApiKeyVisibility('anthropic')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      {showApiKeys.anthropic ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Modèle</label>
                  <input
                    type="text"
                    value={localSettings.llm.anthropicModel}
                    onChange={(e) => updateField('llm', 'anthropicModel', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                  />
                </div>
              </>
            )}

            {localSettings.llm.provider === 'glm' && (
              <>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Clé API GLM (Zhipu AI)</label>
                  <div className="relative">
                    <input
                      type={showApiKeys.glm ? 'text' : 'password'}
                      value={localSettings.llm.glmApiKey}
                      onChange={(e) => updateField('llm', 'glmApiKey', e.target.value)}
                      className="w-full px-3 py-2 pr-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                      placeholder="votre-clé-api..."
                    />
                    <button
                      onClick={() => toggleApiKeyVisibility('glm')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      {showApiKeys.glm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Modèle</label>
                  <input
                    type="text"
                    value={localSettings.llm.glmModel}
                    onChange={(e) => updateField('llm', 'glmModel', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                    placeholder="glm-4-flash"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">Température</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={localSettings.llm.temperature}
                onChange={(e) => updateField('llm', 'temperature', parseFloat(e.target.value))}
                className="w-full accent-[#6c5ce7]"
              />
              <span className="text-xs text-[var(--text-muted)]">{localSettings.llm.temperature.toFixed(2)}</span>
            </div>

            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">Prompt personnalisé</label>
              <textarea
                value={localSettings.llm.customPrompt}
                onChange={(e) => updateField('llm', 'customPrompt', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none resize-none h-20"
                placeholder="Entrez un prompt système personnalisé..."
              />
            </div>
          </div>
        )}

        {/* === Shortcuts === */}
        {activeTab === 'shortcuts' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">Démarrer/Arrêter la dictée</label>
              <input
                type="text"
                value={localSettings.shortcuts.toggleRecording}
                onChange={(e) => updateField('shortcuts', 'toggleRecording', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">Push-to-talk</label>
              <input
                type="text"
                value={localSettings.shortcuts.pushToTalk}
                onChange={(e) => updateField('shortcuts', 'pushToTalk', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none font-mono"
              />
            </div>
          </div>
        )}

        {/* === Privacy === */}
        {activeTab === 'privacy' && (
          <div className="space-y-2">
            {(['local', 'hybrid', 'cloud'] as PrivacyMode[]).map((mode) => (
              <div
                key={mode}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${localSettings.privacy === mode
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--hover-bg)]'}`}
                onClick={() => setLocalSettings((prev) => prev ? { ...prev, privacy: mode } : prev)}
              >
                <div className={`w-3 h-3 rounded-full border-2 ${localSettings.privacy === mode ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[#55556a]'}`} />
                <div>
                  <span className="text-sm text-[var(--text-primary)] capitalize">{mode === 'local' ? '100% Local' : mode === 'hybrid' ? 'Hybride' : 'Cloud'}</span>
                  <p className="text-xs text-[var(--text-muted)]">
                    {mode === 'local' && 'Aucune donnée envoyée en ligne'}
                    {mode === 'hybrid' && 'STT local, LLM cloud si configuré'}
                    {mode === 'cloud' && 'STT et LLM cloud pour la meilleure qualité'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === UI === */}
        {activeTab === 'ui' && (
          <div className="space-y-4">
            {/* Theme selector */}
            <div>
              <label className="text-xs mb-2 block" style={{ color: 'var(--text-secondary)' }}>Theme</label>
              <div className="flex gap-2">
                {([{ id: 'dark', label: 'Sombre' }, { id: 'light', label: 'Clair' }] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={async () => {
                      setTheme(t.id);
                      updateField('ui', 'theme', t.id);
                      // Auto-save theme immediately so it persists without clicking Save
                      if (localSettings && window.voiceink) {
                        const updated = { ...localSettings, ui: { ...localSettings.ui, theme: t.id } };
                        await window.voiceink.setSettings(updated);
                      }
                    }}
                    className="flex-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all"
                    style={{
                      borderColor: theme === t.id ? 'var(--accent)' : 'var(--border)',
                      background: theme === t.id ? 'var(--pill-active-bg)' : 'var(--bg-secondary)',
                      color: theme === t.id ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {t.id === 'dark' ? '🌙 ' : '☀️ '}{t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Minimiser dans le tray</label>
              <Toggle value={localSettings.ui.minimizeToTray} onChange={(v) => updateField('ui', 'minimizeToTray', v)} label="Minimiser dans le tray" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Démarrer minimisé</label>
              <Toggle value={localSettings.ui.startMinimized} onChange={(v) => updateField('ui', 'startMinimized', v)} label="Démarrer minimisé" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Afficher l'overlay</label>
              <Toggle value={localSettings.ui.showOverlay} onChange={(v) => updateField('ui', 'showOverlay', v)} label="Afficher l'overlay" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
