// VoiceInk i18n — FR / EN translations
// All UI strings organized by component/namespace

export type Locale = 'fr' | 'en';

const t = {
  // ── Common ──
  'common.copy':           { fr: 'Copier',       en: 'Copy' },
  'common.copied':         { fr: 'Copié',        en: 'Copied' },
  'common.injected':       { fr: 'Injecté',      en: 'Injected' },
  'common.settings':       { fr: 'Paramètres',   en: 'Settings' },
  'common.quit':           { fr: 'Quitter',      en: 'Quit' },
  'common.minimize':       { fr: 'Réduire',      en: 'Minimize' },
  'close':                 { fr: 'Fermer',       en: 'Close' },
  'common.cancel':         { fr: 'Annuler',      en: 'Cancel' },
  'common.save':           { fr: 'Sauvegarder',  en: 'Save' },
  'common.reset':          { fr: 'Réinitialiser',en: 'Reset' },
  'common.ready':          { fr: 'Prêt',         en: 'Ready' },
  'common.download':       { fr: 'Télécharger',  en: 'Download' },
  'common.details':        { fr: 'Détails',      en: 'Details' },
  'common.delete':         { fr: 'Supprimer',    en: 'Delete' },
  'common.export':         { fr: 'Exporter',     en: 'Export' },
  'common.original':       { fr: 'Original',     en: 'Original' },
  'common.result':         { fr: 'Résultat',     en: 'Result' },
  'common.transcription':  { fr: 'Transcription',en: 'Transcription' },
  'common.processing':     { fr: 'Traitement…',  en: 'Processing…' },

  // ── Navigation tabs ──
  'nav.diction':           { fr: 'Dictée',       en: 'Dictation' },
  'nav.chat':              { fr: 'Chat IA',      en: 'AI Chat' },
  'nav.file':              { fr: 'Fichier',      en: 'File' },
  'nav.history':           { fr: 'Historique',   en: 'History' },
  'nav.settings':          { fr: 'Paramètres',   en: 'Settings' },

  // ── Mode pills ──
  'mode.raw':              { fr: 'Brut',         en: 'Raw' },
  'mode.email':            { fr: 'Email',        en: 'Email' },
  'mode.short_message':    { fr: 'Message',      en: 'Message' },
  'mode.meeting_notes':    { fr: 'Notes',        en: 'Notes' },
  'mode.summary':          { fr: 'Résumé',       en: 'Summary' },
  'mode.formal':           { fr: 'Formel',       en: 'Formal' },
  'mode.simplified':       { fr: 'Simple',       en: 'Simple' },
  'mode.custom':           { fr: 'Custom',       en: 'Custom' },

  // ── Mode labels (full names) ──
  'modeLabel.raw':              { fr: 'Texte brut',               en: 'Raw text' },
  'modeLabel.email':            { fr: 'Email professionnel',      en: 'Professional email' },
  'modeLabel.short_message':    { fr: 'Message court',            en: 'Short message' },
  'modeLabel.meeting_notes':    { fr: 'Notes de réunion',         en: 'Meeting notes' },
  'modeLabel.summary':          { fr: 'Résumé',                   en: 'Summary' },
  'modeLabel.formal':           { fr: 'Reformulation formelle',   en: 'Formal rewording' },
  'modeLabel.simplified':       { fr: 'Reformulation simplifiée', en: 'Simplified rewording' },
  'modeLabel.custom':           { fr: 'Mode personnalisé',        en: 'Custom mode' },

  // ── Panel View ──
  'panel.orb':                { fr: 'Orbe',              en: 'Orb' },
  'panel.backToOrb':          { fr: "Retour à l'orbe",   en: 'Back to orb' },

  // ── Settings View ──
  'settings.title':           { fr: 'Paramètres',                      en: 'Settings' },
  'settings.saved':           { fr: 'Paramètres sauvegardés',           en: 'Settings saved' },
  'settings.resetDone':       { fr: 'Paramètres réinitialisés',         en: 'Settings reset' },
  'settings.modelDownloaded': { fr: 'Modèle {model} téléchargé',        en: 'Model {model} downloaded' },
  'settings.downloadError':   { fr: 'Erreur de téléchargement',         en: 'Download error' },

  // Settings tabs
  'settings.tab.audio':        { fr: 'Audio',            en: 'Audio' },
  'settings.tab.stt':          { fr: 'STT',              en: 'STT' },
  'settings.tab.llm':          { fr: 'LLM',              en: 'LLM' },
  'settings.tab.shortcuts':    { fr: 'Raccourcis',       en: 'Shortcuts' },
  'settings.tab.privacy':      { fr: 'Confidentialité',  en: 'Privacy' },
  'settings.tab.ui':           { fr: 'Interface',        en: 'Interface' },

  // Audio tab
  'settings.audio.capture':    { fr: 'Capture',                     en: 'Capture' },
  'settings.audio.sensitivity':{ fr: 'Sensibilité du microphone',   en: 'Microphone sensitivity' },
  'settings.audio.processing': { fr: 'Traitement',                  en: 'Processing' },
  'settings.audio.noiseReduction': { fr: 'Réduction de bruit',     en: 'Noise reduction' },
  'settings.audio.noiseReductionDesc': { fr: 'Filtre le bruit ambiant', en: 'Filters ambient noise' },
  'settings.audio.autoGain':   { fr: 'Gain automatique',            en: 'Auto gain' },
  'settings.audio.autoGainDesc':{ fr: 'Ajuste le volume automatiquement', en: 'Automatically adjusts volume' },

  // STT tab
  'settings.stt.provider':     { fr: 'Fournisseur STT',   en: 'STT Provider' },
  'settings.stt.groqKey':      { fr: 'Clé API Groq',      en: 'Groq API Key' },
  'settings.stt.groqKeyHint':  { fr: 'Gratuite sur console.groq.com', en: 'Free on console.groq.com' },
  'settings.stt.openaiKey':    { fr: 'Clé API OpenAI',    en: 'OpenAI API Key' },
  'settings.stt.whisperModel': { fr: 'Modèle Whisper',    en: 'Whisper Model' },
  'settings.stt.gpuAccel':     { fr: 'Accélération GPU',  en: 'GPU Acceleration' },
  'settings.stt.autoDetect':   { fr: 'Détection automatique de la langue', en: 'Automatic language detection' },
  'settings.stt.autoDetectDesc':{ fr: 'Détecte automatiquement la langue parlée', en: 'Automatically detects the spoken language' },

  // LLM tab
  'settings.llm.provider':     { fr: 'Fournisseur LLM',   en: 'LLM Provider' },
  'settings.llm.none':         { fr: 'Aucun',             en: 'None' },
  'settings.llm.noneDesc':     { fr: 'Texte brut sans post-traitement', en: 'Raw text without post-processing' },
  'settings.llm.ollamaDesc':   { fr: 'LLM local — llama, mistral, gemma…', en: 'Local LLM — llama, mistral, gemma…' },
  'settings.llm.ollamaUrl':    { fr: 'URL Ollama',        en: 'Ollama URL' },
  'settings.llm.ollamaModel':  { fr: 'Modèle Ollama',    en: 'Ollama Model' },
  'settings.llm.openaiKey':    { fr: 'Clé API OpenAI',    en: 'OpenAI API Key' },
  'settings.llm.model':        { fr: 'Modèle',            en: 'Model' },
  'settings.llm.anthropicKey': { fr: 'Clé API Anthropic', en: 'Anthropic API Key' },
  'settings.llm.glmKey':       { fr: 'Clé API GLM (Zhipu AI)', en: 'GLM API Key (Zhipu AI)' },
  'settings.llm.temperature':  { fr: 'Température',       en: 'Temperature' },
  'settings.llm.customPrompt': { fr: 'Prompt personnalisé (mode Custom)', en: 'Custom prompt (Custom mode)' },
  'settings.llm.customPromptHint': { fr: "Utilisé uniquement en mode 'Custom'", en: "Only used in 'Custom' mode" },
  'settings.llm.customPromptPlaceholder': { fr: 'Entrez un prompt système personnalisé…', en: 'Enter a custom system prompt…' },

  // Shortcuts tab
  'settings.shortcuts.global':        { fr: 'Raccourcis globaux',           en: 'Global Shortcuts' },
  'settings.shortcuts.toggleRecord':   { fr: 'Démarrer / Arrêter la dictée',en: 'Start / Stop dictation' },

  // Privacy tab
  'settings.privacy.mode':     { fr: 'Mode de confidentialité', en: 'Privacy mode' },
  'settings.privacy.local':    { fr: '100% Local',              en: '100% Local' },
  'settings.privacy.localDesc':{ fr: 'Aucune donnée envoyée en ligne', en: 'No data sent online' },
  'settings.privacy.hybrid':   { fr: 'Hybride',                 en: 'Hybrid' },
  'settings.privacy.hybridDesc':{ fr: 'STT local, LLM cloud si configuré', en: 'Local STT, cloud LLM if configured' },
  'settings.privacy.cloud':    { fr: 'Cloud',                   en: 'Cloud' },
  'settings.privacy.cloudDesc':{ fr: 'STT et LLM cloud pour la meilleure qualité', en: 'Cloud STT & LLM for best quality' },

  // UI tab
  'settings.ui.appearance':    { fr: 'Apparence',                en: 'Appearance' },
  'settings.ui.dark':          { fr: '🌙  Sombre',               en: '🌙  Dark' },
  'settings.ui.light':         { fr: '☀️  Clair',                en: '☀️  Light' },
  'settings.ui.behavior':      { fr: 'Comportement',             en: 'Behavior' },
  'settings.ui.language':      { fr: 'Langue',                   en: 'Language' },
  'settings.ui.languageDesc':  { fr: "Langue de l'interface",    en: 'Interface language' },
  'settings.ui.minimizeToTray':{ fr: 'Minimiser dans le tray',   en: 'Minimize to tray' },
  'settings.ui.minimizeToTrayDesc': { fr: "Garder l'app active en arrière-plan", en: 'Keep the app active in the background' },
  'settings.ui.startMinimized':{ fr: 'Démarrer minimisé',        en: 'Start minimized' },
  'settings.ui.showOverlay':   { fr: "Afficher l'overlay flottant", en: 'Show floating overlay' },

  // ── Chat View ──
  'chat.title':          { fr: 'Chat IA',                                  en: 'AI Chat' },
  'chat.clear':          { fr: 'Effacer',                                  en: 'Clear' },
  'chat.clearTooltip':   { fr: 'Effacer la conversation',                  en: 'Clear conversation' },
  'chat.empty':          { fr: 'Commencer une conversation',               en: 'Start a conversation' },
  'chat.emptyDesc':      { fr: 'Utilise le fournisseur LLM configuré',     en: 'Uses the configured LLM provider' },
  'chat.placeholder':    { fr: 'Écrire un message… (Entrée pour envoyer)', en: 'Type a message… (Enter to send)' },
  'chat.error':          { fr: 'Erreur chat',                              en: 'Chat error' },

  // ── File View ──
  'file.title':           { fr: 'Transcription de fichier',         en: 'File transcription' },
  'file.drop':            { fr: 'Glissez un fichier ou cliquez',    en: 'Drag a file or click' },
  'file.dropHere':        { fr: 'Déposez le fichier ici',           en: 'Drop file here' },
  'file.change':          { fr: 'Cliquer ou glisser pour changer',  en: 'Click or drag to change' },
  'file.transcribe':      { fr: 'Transcrire',                       en: 'Transcribe' },
  'file.transcribing':    { fr: 'Transcription en cours…',          en: 'Transcribing…' },
  'file.success':         { fr: 'Fichier transcrit avec succès',    en: 'File transcribed successfully' },
  'file.unsupported':     { fr: 'Format non supporté',              en: 'Unsupported format' },
  'file.showOriginal':    { fr: 'Afficher le texte original',       en: 'Show original text' },
  'file.error':           { fr: 'Erreur de transcription',          en: 'Transcription error' },

  // ── History View ──
  'history.title':       { fr: 'Historique',     en: 'History' },
  'history.search':      { fr: 'Rechercher…',    en: 'Search…' },
  'history.empty':       { fr: 'Aucun historique',en: 'No history' },
  'history.date':        { fr: 'Date',           en: 'Date' },
  'history.mode':        { fr: 'Mode',           en: 'Mode' },
  'history.language':    { fr: 'Langue',         en: 'Language' },
  'history.duration':    { fr: 'Durée',          en: 'Duration' },
  'history.tags':        { fr: 'Tags',           en: 'Tags' },
  'history.addTag':      { fr: 'Ajouter…',       en: 'Add…' },
  'history.processed':   { fr: 'Texte traité',   en: 'Processed text' },

  // ── Compact Overlay (context menu) ──
  'orb.stop':            { fr: 'Arrêter',        en: 'Stop' },
  'orb.record':          { fr: 'Enregistrer',    en: 'Record' },
  'orb.mode':            { fr: 'Mode',           en: 'Mode' },
  'orb.lang':            { fr: 'Langue',         en: 'Language' },
  'orb.openPanel':       { fr: 'Ouvrir le panel',en: 'Open panel' },
  'orb.openPanelTitle':  { fr: 'Ouvrir le panel',en: 'Open panel' },
  'orb.translate':       { fr: 'Traduction',      en: 'Translation' },
  'orb.translateNone':   { fr: 'Aucune',          en: 'None' },

  // ── Status Bar ──
  'status.ready':        { fr: 'Prêt',           en: 'Ready' },

  // ── STT Providers ──
  'stt.groq':            { fr: 'Groq',           en: 'Groq' },
  'stt.groqDesc':        { fr: 'Whisper large-v3 — ultra rapide, gratuit', en: 'Whisper large-v3 — ultra fast, free' },
  'stt.local':           { fr: 'Local',          en: 'Local' },
  'stt.localDesc':       { fr: 'Whisper.cpp — 100% offline, CPU/GPU',      en: 'Whisper.cpp — 100% offline, CPU/GPU' },
  'stt.openai':          { fr: 'OpenAI',         en: 'OpenAI' },
  'stt.openaiDesc':      { fr: 'Whisper API — haute qualité, cloud',       en: 'Whisper API — high quality, cloud' },
  'stt.glm':             { fr: 'GLM',            en: 'GLM' },
  'stt.glmDesc':         { fr: 'Zhipu AI — utilise la clé LLM',           en: 'Zhipu AI — uses LLM key' },

  // ── LLM Providers ──
  'llm.openaiDesc':      { fr: 'GPT-4o, GPT-4-turbo…',   en: 'GPT-4o, GPT-4-turbo…' },
  'llm.anthropicDesc':   { fr: 'Claude Sonnet, Haiku…',   en: 'Claude Sonnet, Haiku…' },
  'llm.glmDesc':         { fr: 'Zhipu AI — rapide et économique', en: 'Zhipu AI — fast and affordable' },
} as const;

export type TranslationKey = keyof typeof t;

export function getTranslation(key: TranslationKey, locale: Locale): string {
  return t[key]?.[locale] || t[key]?.fr || key;
}

export function getAllKeys(): TranslationKey[] {
  return Object.keys(t) as TranslationKey[];
}
