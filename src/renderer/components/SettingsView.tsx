import React, { useState } from 'react';
import { Eye, EyeOff, ExternalLink, Check, Layout, Languages, Pin, Keyboard, Power, Volume2, Zap } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { GROQ_STT_MODELS, SUPPORTED_LANGUAGES, TRANSLATE_TARGETS, TTS_PROVIDERS, INTERPRETER_LANGUAGES } from '../lib/constants';
import { Settings, TTSProvider } from '../../shared/types';
import { AppearanceSection } from './AppearanceSection';
import { ReplacementsSection } from './ReplacementsSection';

export function SettingsView() {
  const { settings, updateSettings } = useStore();
  const [showKey, setShowKey] = useState(false);
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);

  const api = (window as any).voiceink;

  const save = async (patch: Partial<Settings>) => {
    await updateSettings(patch);
    setSavedPulse(true);
    setTimeout(() => setSavedPulse(false), 1200);
  };

  const setDensity = async (next: 'comfortable' | 'compact') => {
    if (settings.density === next) return;
    // Don't save via store first — the main process will persist the density
    // and recreate the window (required for transparency toggling). Saving
    // locally before recreation would cause a visible UI flash in the
    // current window.
    await api?.windowResizeForDensity?.(next);
  };

  const setAlwaysOnTop = async (next: boolean) => {
    await save({ alwaysOnTop: next });
    await api?.windowSetAlwaysOnTop?.(next);
  };

  const setAutoStart = async (next: boolean) => {
    // Round-trips to main so it can also call app.setLoginItemSettings().
    const res = await api?.setAutoStart?.(next);
    if (res?.ok) {
      await updateSettings({ autoStart: next });
      setSavedPulse(true);
      setTimeout(() => setSavedPulse(false), 1200);
    } else if (res?.error) {
      alert('Impossible d\'activer le démarrage automatique : ' + res.error);
    }
  };

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight"><span className="gradient-text">Paramètres</span></h1>
          <p className="text-white/50 text-sm mt-1">Configurez votre moteur et votre expérience.</p>
        </div>
        {savedPulse && (
          <span className="badge badge-green fade-in"><Check size={10} /> Sauvegardé</span>
        )}
      </div>

      {/* Appearance (theme + effects) */}
      <AppearanceSection />

      {/* Interface */}
      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Layout size={16} className="accent-text" />
          <h2 className="font-semibold text-lg">Interface</h2>
        </div>

        <div>
          <div className="label mb-2">Densité</div>
          <div className="seg">
            <button
              className={settings.density === 'comfortable' ? 'active' : ''}
              onClick={() => setDensity('comfortable')}
            >
              Confortable
            </button>
            <button
              className={settings.density === 'compact' ? 'active' : ''}
              onClick={() => setDensity('compact')}
            >
              Compact / minimaliste
            </button>
          </div>
          <p className="text-[11px] text-white/40 mt-2">
            Le mode compact transforme l'app en une petite pilule flottante
            (176×52 px) transparente, toujours au premier plan et déplaçable
            partout à l'écran — idéale pour dicter en surimpression.
          </p>
        </div>

        <ToggleRow
          label="Toujours au premier plan"
          desc="Garde la fenêtre VoiceInk visible au-dessus de vos autres applications."
          icon={<Pin size={14} />}
          value={settings.alwaysOnTop}
          onChange={setAlwaysOnTop}
        />
      </section>

      {/* Replacements / custom dictionary */}
      <ReplacementsSection />

      {/* Voice Interpreter */}
      <InterpreterSection />

      {/* Translation */}
      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Languages size={16} className="text-fuchsia-300" />
          <h2 className="font-semibold text-lg">Traduction automatique</h2>
        </div>
        <p className="text-white/50 text-sm">
          Traduisez votre dictée à la volée vers la langue de votre choix.
          La traduction s'applique après la transcription et avant l'injection
          dans l'application cible.
        </p>

        <div>
          <div className="label mb-2">Traduire vers</div>
          <select
            className="select"
            value={settings.translateTo}
            onChange={(e) => save({ translateTo: e.target.value })}
          >
            {TRANSLATE_TARGETS.map((t) => (
              <option key={t.code || 'none'} value={t.code}>
                {t.code ? `→ ${t.native}` : 'Aucune (garder la langue d\'origine)'}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-white/40 mt-2">
            Utilise le modèle Groq llama-3.3-70b (≈300-600 ms). Nécessite la clé Groq.
          </p>
        </div>

        {settings.translateTo && (
          <div className="slide-up">
            <div className="label mb-2">Modèle de traduction</div>
            <select
              className="select"
              value={settings.translateModel}
              onChange={(e) => save({ translateModel: e.target.value })}
            >
              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (recommandé)</option>
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (plus rapide)</option>
              <option value="llama-3.3-70b-specdec">llama-3.3-70b-specdec (speculative decoding)</option>
            </select>
          </div>
        )}
      </section>

      {/* Groq API */}
      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Moteur de transcription</h2>
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-xs text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
            Obtenir une clé <ExternalLink size={12} />
          </a>
        </div>

        <div>
          <div className="label mb-2">Clé API Groq</div>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              className="input font-mono"
              placeholder="gsk_..."
              value={settings.groqApiKey}
              onChange={(e) => save({ groqApiKey: e.target.value.trim() })}
            />
            <button className="btn btn-ghost" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-white/40 mt-2">Stockée localement. Jamais envoyée ailleurs que vers l'API Groq.</p>
        </div>

        <div>
          <div className="label mb-2">Modèle Whisper</div>
          <select className="select" value={settings.sttModel} onChange={(e) => save({ sttModel: e.target.value })}>
            {GROQ_STT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>

        <div>
          <div className="label mb-2">Langue par défaut</div>
          <select className="select" value={settings.language} onChange={(e) => save({ language: e.target.value })}>
            {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </section>

      {/* Workflow */}
      <section className="glass rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Workflow</h2>
        <ToggleRow
          label="Copie automatique"
          desc="Copier la transcription dans le presse-papier."
          value={settings.autoCopy}
          onChange={(v) => save({ autoCopy: v })}
        />
        <ToggleRow
          label="Injection automatique"
          desc="Coller automatiquement dans l'application active (Ctrl+V)."
          value={settings.autoInject}
          onChange={(v) => save({ autoInject: v })}
        />
      </section>

      {/* LLM */}
      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Post-traitement LLM</h2>
          <Switch value={settings.llmEnabled} onChange={(v) => save({ llmEnabled: v })} />
        </div>
        <p className="text-white/50 text-sm">Nettoie / reformule automatiquement selon le mode choisi. Désactivé en mode "Brut".</p>

        {settings.llmEnabled && (
          <div className="space-y-4 slide-up">
            <div>
              <div className="label mb-2">Fournisseur</div>
              <select className="select" value={settings.llmProvider} onChange={(e) => save({ llmProvider: e.target.value as Settings['llmProvider'] })}>
                <option value="groq">Groq (rapide, utilise la même clé)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="ollama">Ollama (local)</option>
              </select>
            </div>
            <div>
              <div className="label mb-2">Modèle</div>
              <input className="input font-mono" value={settings.llmModel} onChange={(e) => save({ llmModel: e.target.value })} />
            </div>
            {(settings.llmProvider === 'openai' || settings.llmProvider === 'anthropic') && (
              <div>
                <div className="label mb-2">Clé API</div>
                <div className="flex gap-2">
                  <input
                    type={showLlmKey ? 'text' : 'password'}
                    className="input font-mono"
                    value={settings.llmApiKey}
                    onChange={(e) => save({ llmApiKey: e.target.value.trim() })}
                  />
                  <button className="btn btn-ghost" onClick={() => setShowLlmKey(!showLlmKey)}>
                    {showLlmKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Shortcuts */}
      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Keyboard size={16} className="accent-text" />
          <h2 className="font-semibold text-lg">Raccourcis globaux</h2>
        </div>
        <div>
          <div className="label mb-2">Démarrer / Arrêter (toggle)</div>
          <input className="input font-mono" value={settings.shortcutToggle} onChange={(e) => save({ shortcutToggle: e.target.value })} />
          <p className="text-[11px] text-white/40 mt-1">Format Electron, ex: <code>CommandOrControl+Shift+Space</code>. Nécessite un redémarrage de l'app.</p>
        </div>

        <div className="pt-2 border-t border-white/5">
          <ToggleRow
            label="Push-to-Talk"
            desc="Maintenir un raccourci pour parler, relâcher pour arrêter. Plus rapide que le toggle pour de courtes dictées."
            icon={<Keyboard size={14} />}
            value={!!settings.pttEnabled}
            onChange={(v) => save({ pttEnabled: v })}
          />
          {settings.pttEnabled && (
            <div className="mt-3 slide-up">
              <div className="label mb-2">Raccourci Push-to-Talk</div>
              <input className="input font-mono" value={settings.shortcutPTT} onChange={(e) => save({ shortcutPTT: e.target.value })} />
              <p className="text-[11px] text-white/40 mt-1">
                Le mode Push-to-Talk démarre l'enregistrement à la première pression et le stoppe à la suivante.
                Les raccourcis globaux Electron ne reçoivent pas les événements de relâchement sous Windows.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* System */}
      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Power size={16} className="accent-text" />
          <h2 className="font-semibold text-lg">Système</h2>
        </div>
        <ToggleRow
          label="Lancer VoiceInk au démarrage de Windows"
          desc="L'app se lancera automatiquement à chaque ouverture de session."
          icon={<Power size={14} />}
          value={!!settings.autoStart}
          onChange={setAutoStart}
        />
        <ToggleRow
          label="Démarrer en arrière-plan"
          desc="Au lancement, ne pas afficher la fenêtre principale — rester dans le tray / en pilule."
          icon={<Layout size={14} />}
          value={!!settings.startMinimized}
          onChange={(v) => save({ startMinimized: v })}
        />
        <ToggleRow
          label="Sons de notification"
          desc="Joue un bip subtil au début et à la fin de l'enregistrement."
          icon={<Volume2 size={14} />}
          value={!!settings.soundsEnabled}
          onChange={(v) => save({ soundsEnabled: v })}
        />
      </section>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange, icon }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex items-start gap-2 min-w-0">
        {icon && <span className="text-white/60 mt-0.5">{icon}</span>}
        <div className="min-w-0">
          <div className="font-medium">{label}</div>
          <div className="text-white/50 text-xs">{desc}</div>
        </div>
      </div>
      <Switch value={value} onChange={onChange} />
    </div>
  );
}

function Switch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`switch ${value ? 'on' : ''}`} onClick={() => onChange(!value)} role="switch" aria-checked={value} />
  );
}

/**
 * Voice interpreter configuration — provider + per-provider voice
 * + per-provider API key + target language + continuous mode toggle.
 *
 * Design notes:
 *   - The per-provider voice/key state lets the user flip between
 *     providers without losing their previously-pasted keys. Switching
 *     ttsProvider just changes what the two inputs below address.
 *   - The voice picker is a <select> pre-populated with our curated
 *     shortlist + a "Custom ID…" option that reveals a free-form
 *     input for advanced users (voice cloning, lab voices, etc.).
 *   - The continuous toggle is wired but gated behind a "Beta" badge
 *     because the VAD pipeline ships in the same release and hasn't
 *     had weeks of field-testing yet.
 */
function InterpreterSection() {
  const { settings, updateSettings } = useStore();
  const [showTtsKey, setShowTtsKey] = useState(false);

  const providerId = settings.ttsProvider || 'cartesia';
  const provider = TTS_PROVIDERS.find((p) => p.id === providerId) || TTS_PROVIDERS[0];
  const currentVoiceId = settings.ttsVoiceId?.[providerId] || provider.voices[0]?.id || '';
  const currentApiKey = settings.ttsApiKey?.[providerId] || '';
  const isCurated = provider.voices.some((v) => v.id === currentVoiceId);

  const save = (patch: Partial<Settings>) => updateSettings(patch);
  const setProvider = (id: TTSProvider) => save({ ttsProvider: id });
  const setVoice = (voiceId: string) => save({
    ttsVoiceId: { ...(settings.ttsVoiceId || {}), [providerId]: voiceId },
  });
  const setApiKey = (key: string) => save({
    ttsApiKey: { ...(settings.ttsApiKey || {}), [providerId]: key.trim() },
  });

  return (
    <section className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 size={16} className="text-emerald-300" />
          <h2 className="font-semibold text-lg">Traducteur vocal (interprète)</h2>
          <span className="badge" style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#6ee7b7' }}>
            Nouveau
          </span>
        </div>
        <Switch
          value={!!settings.interpreterEnabled}
          onChange={(v) => save({ interpreterEnabled: v })}
        />
      </div>
      <p className="text-white/50 text-sm">
        Parlez dans votre langue — VoiceInk traduit instantanément et prononce le résultat
        avec une voix IA réaliste. Idéal pour réunions multilingues, appels visio, ou tester
        une tournure dans une autre langue. Indépendant des 4 modes de dictée classiques.
      </p>

      {settings.interpreterEnabled && (
        <div className="space-y-4 slide-up">
          {/* Target language */}
          <div>
            <div className="label mb-2">Langue parlée en sortie</div>
            <select
              className="select"
              value={settings.interpretTargetLang || 'en'}
              onChange={(e) => save({ interpretTargetLang: e.target.value })}
            >
              {INTERPRETER_LANGUAGES.map((t) => (
                <option key={t.code} value={t.code}>→ {t.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-white/40 mt-2">
              Si votre dictée est dans une autre langue, Whisper la détecte automatiquement
              avant traduction.
            </p>
          </div>

          {/* Provider picker */}
          <div>
            <div className="label mb-2">Moteur de voix</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {TTS_PROVIDERS.map((p) => {
                const active = p.id === providerId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className="glass rounded-xl p-3 text-left transition"
                    style={{
                      borderColor: active ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)',
                      background: active ? 'rgba(16,185,129,0.08)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Zap size={12} className={active ? 'text-emerald-300' : 'text-white/40'} />
                      <span className="font-medium text-sm">{p.label}</span>
                      {active && <Check size={12} className="text-emerald-300 ml-auto" />}
                    </div>
                    <p className="text-[11px] text-white/50 mt-1">{p.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice picker */}
          <div>
            <div className="label mb-2">Voix ({provider.label})</div>
            <select
              className="select"
              value={isCurated ? currentVoiceId : '__custom__'}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setVoice('');
                } else {
                  setVoice(e.target.value);
                }
              }}
            >
              {provider.voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {v.langs}
                </option>
              ))}
              <option value="__custom__">Voice ID personnalisé…</option>
            </select>
            {!isCurated && (
              <input
                className="input font-mono mt-2"
                placeholder={`${provider.id} voice id…`}
                value={currentVoiceId}
                onChange={(e) => setVoice(e.target.value.trim())}
              />
            )}
          </div>

          {/* API key for the selected provider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label">Clé API {provider.label}</div>
              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
              >
                Obtenir une clé <ExternalLink size={12} />
              </a>
            </div>
            <div className="flex gap-2">
              <input
                type={showTtsKey ? 'text' : 'password'}
                className="input font-mono"
                placeholder={providerId === 'cartesia' ? 'sk_car_...' :
                             providerId === 'elevenlabs' ? 'xi-api-key (sk_...)' :
                             'sk-...'}
                value={currentApiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button className="btn btn-ghost" onClick={() => setShowTtsKey(!showTtsKey)}>
                {showTtsKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-white/40 mt-2">
              Stockée localement, une clé par fournisseur. Basculer de moteur
              conserve les clés déjà saisies.
            </p>
          </div>

          {/* Speed */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label">Vitesse de parole</div>
              <span className="text-xs text-white/60 font-mono">
                {(settings.ttsSpeed ?? 1.0).toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.05}
              value={settings.ttsSpeed ?? 1.0}
              onChange={(e) => save({ ttsSpeed: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-white/30 mt-1">
              <span>0.5× (lent)</span>
              <span>1.0× (naturel)</span>
              <span>2.0× (rapide)</span>
            </div>
          </div>

          {/* Continuous / simultaneous interpretation */}
          <div className="pt-2 border-t border-white/5">
            <ToggleRow
              label="Mode interprète simultané (beta)"
              desc="Découpe l'audio par phrases (VAD) : la voix traduite commence à parler pendant que vous êtes encore en train de dicter. Augmente légèrement la consommation d'API."
              icon={<Zap size={14} />}
              value={!!settings.interpreterContinuous}
              onChange={(v) => save({ interpreterContinuous: v })}
            />
          </div>
        </div>
      )}
    </section>
  );
}
