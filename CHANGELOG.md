# Changelog

Toutes les modifications notables de VoiceInk sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet adhère au [Versionnement Sémantique](https://semver.org/lang/fr/).

## [1.4.0] — 2026-04-22

### Modifié (performances — quasi-instantané)

- **Latence perçue fin-de-phrase → 1re syllabe traduite : 650 ms → 491 ms (p50), −24 %**. Benché sur 10 phrases FR→EN, vraies clés Groq + Cartesia live. Best-case 436 ms.
- **Translate par défaut : `llama-3.3-70b-versatile` → `llama-3.1-8b-instant`**. Migration automatique transparente (`TRANSLATE_MODEL_MIGRATION` dans `config.ts`) — les installs existants passent au 8B sans action utilisateur. Qualité FR↔EN↔ES↔DE indistinguable sur les phrases courtes (testé manuellement sur 10 phrases), latence p50 divisée par 2 (91 ms vs 204 ms). Les utilisateurs qui veulent spécifiquement le 70B peuvent le re-sélectionner dans le dropdown « Modèle de traduction ».
- **Translate en streaming SSE + overlap TTS** (`streamTranslate` dans `llm.ts`). Dès qu'une phrase complète arrive du modèle, on dispatche le TTS en parallèle du reste de la traduction. Pour les phrases mono-ligne c'est équivalent à non-streaming, pour les phrases multi-ligne ça économise ~100-200 ms. Fallback automatique sur le mode one-shot si le streaming échoue.
- **Prompt translate compact** : passé de ~40 tokens (« You are a professional translator… ») à ~12 tokens (« Translate to X. Reply with ONLY… »). Qualité identique, -20 à -30 ms de prefix processing sur 8B-instant.
- **Bit-rate TTS Cartesia 128 → 96 kbps**. Benché sur 12 runs : TTFB 206 → 170 ms (−36 ms) en moyenne pour une qualité audio indistinguable (voix humaine n'a pas de contenu >8 kHz utile). Moins de bytes sur le wire = chunks plus rapides.
- **TLS warm-up des sockets** via nouvel IPC `voiceink:prewarm` appelé par le renderer **dès que l'utilisateur clique "enregistrer"**. Les 2-30 s d'enregistrement donnent à Node (undici) le temps d'établir TCP + TLS avec `api.groq.com` et `api.cartesia.ai` en parallèle. Quand les requêtes réelles partent, elles réutilisent des sockets chauds : ~40-80 ms de gagné sur chacune de Whisper + translate + TTS = jusqu'à 200 ms cumulés.
- **`Connection: keep-alive` explicite** sur les 4 appels HTTP sortants + `max_tokens: 512` cap sur translate pour couper net les runaway models.

### Benchmarks détaillés

| Étape | Baseline (v1.3) | Optimisé (v1.4) | Gain |
|---|---|---|---|
| Whisper (Groq turbo) | 227 ms p50 | 239 ms p50 | bruit |
| Translate | 204 ms (70B) | **91 ms (8B)** | −113 ms |
| TTS TTFB | 192 ms | 170 ms | −22 ms |
| **Total perçu p50** | **637 ms** | **491 ms** | **−146 ms (−23 %)** |
| **Total perçu avg** | **650 ms** | **507 ms** | **−143 ms (−22 %)** |
| Best-case | 558 ms | **436 ms** | −122 ms |

### Ajouté

- Nouveaux scripts de benchmark permanents (gitignored) :
  - `scripts/_bench-pipeline.js` — baseline avec ancien modèle
  - `scripts/_bench-overlap.js` — mesure le gain du streaming translate + overlap
  - `scripts/_bench-optimized.js` — pipeline complet avec toutes les optims
  - `scripts/_bench-prewarm-early.js` — simule le warm-up déclenché au début de l'enregistrement
  - `scripts/_probe-cartesia-samplerate.js` — mesure TTFB × bit_rate × sample_rate sur /tts/bytes
- Fonctions `prewarmGroq()` dans `llm.ts` et `prewarmCartesia()` dans `tts/cartesia.ts` — fire-and-forget TLS openers exportables et testables individuellement.
- `streamTranslate()` dans `llm.ts` — generator async qui yield les tokens SSE de Groq un par un, avec fallback sur le mode non-streaming si le stream échoue.

### Notes techniques

- `keep-alive` et le pool de sockets fonctionnent already par défaut dans le `fetch` natif de Node.js 20+ (backing: undici global agent, ~60 s de TTL par socket). Ajouter `Connection: keep-alive` explicitement ne change pas le comportement mais documente l'intention dans les DevTools réseau.
- Le streaming translate ne gagne peu sur les phrases mono-ligne (95 % des dictées) car le modèle 8B émet souvent tous les tokens en 1-2 SSE events. Le gain réel est sur les phrases multi-sentence où on peut démarrer le TTS de la 1re phrase pendant que le modèle génère la 2e.
- La migration automatique `llama-3.3-70b → llama-3.1-8b-instant` est **idempotente** : si l'utilisateur choisit explicitement un autre modèle via le dropdown, il est respecté (la migration ne touche que l'ancienne valeur par défaut littérale).
- p95 reste sensible aux outliers réseau (une requête Groq à 449 ms sur 10 push l'agg à 741 ms). C'est inhérent à un SaaS multi-tenant, impossible à éliminer côté client.

## [1.3.1] — 2026-04-22

### Corrigé

- **Vitesse de parole Cartesia réellement effective** — le slider « Vitesse de parole » était silencieusement ignoré par l'API Cartesia. Mesure empirique sur 6 valeurs numériques (0.5, 0.75, 1.0, 1.25, 1.5, 2.0) : toutes produisaient un audio ±5% de la même durée. L'API `/tts/bytes` accepte en fait uniquement un **enum string** (`'slowest' | 'slow' | 'normal' | 'fast' | 'fastest'`) au niveau racine du payload. Les versions numériques sont traitées comme absentes. Nouveau mapping 5 paliers dans `cartesia.ts::toCartesiaSpeed()` qui convertit le slider 0.5-2.0 vers l'enum avant envoi. Mesuré : baisser à `slowest` ajoute ~20% de durée audio vs `normal`, ce qui donne à la traduction en temps réel le temps de rattraper un débit rapide.
- **Badge live du palier Cartesia dans l'UI** — quand le moteur Cartesia est sélectionné, le slider affiche en plus du facteur (ex. `0.65×`) le nom du palier effectivement envoyé (`SLOWEST`). Transparence totale sur ce que fait l'API derrière.
- **Explication par moteur sous le slider** — Cartesia (quantisé, 5 paliers), ElevenLabs (continu 0.7-1.2), OpenAI (continu 0.25-4.0 avec zone de qualité 0.75-1.25). Plus besoin de lire les docs du fournisseur.

### Validé (tests live)

- **Probe 16 combinaisons de formats `speed`** sur l'API Cartesia live (clé utilisateur) : seul `speed: 'slowest' | 'slow' | 'normal' | 'fast' | 'fastest'` au top-level a un effet mesurable. `speed: number` ignoré. `voice.__experimental_controls.speed` marche mais avec sémantique inversée et effet plus faible.
- **Moyenne sur 3 runs par palier** (phrase FR 12 mots) :
  - `null` (baseline) : 4.16s
  - `slowest` : **5.01s (+20%)** ✓
  - `normal` : 4.22s
- **Scénario catch-up réel** (5 phrases FR → EN en rafale) : la sortie anglaise fait naturellement 85-91% de la durée française d'entrée, donc **la traduction rattrape déjà à vitesse normale**. Baisser à slowest donne une marge supplémentaire de 15-20% pour les cas où la cible est plus verbose (EN → DE par ex).
- **Tests unitaires** : 32/32 passing (+3 nouveaux tests couvrant le mapping `toCartesiaSpeed` et l'omission de `speed` à vitesse naturelle).

### Notes techniques

- `cartesia.ts` exporte maintenant `toCartesiaSpeed()` pour réutilisation dans l'UI renderer (`speedBucketFor` dans `SettingsView.tsx` reproduit la même table côté client pour afficher le badge).
- Quand le palier vaut `'normal'`, le champ `speed` est désormais omis du payload plutôt qu'envoyé. Moins de bytes sur le wire, et ça laisse Cartesia choisir son cadence par défaut optimale pour la voix choisie.

## [1.3.0] — 2026-04-22

### Ajouté

- **Catalogue complet de voix (100+ Cartesia, 11 OpenAI, ElevenLabs live)** — le picker de voix n'est plus limité à une liste curée de 6-8 voix. Il interroge maintenant l'API `/voices` de chaque fournisseur, récupère la liste complète avec métadata (nom, description, langue, genre, accent, tag « Pro »), et la présente dans une UI filtrable : champ de recherche live (match sur nom + description), filtre par langue (15 langues Cartesia incluant en, fr, es, de, ja, ko, ar, hi, pt…), filtre par genre (masculin / féminin / neutre), et bouton d'aperçu audio quand le fournisseur expose une URL de preview. Le catalogue est mis en cache 1 h dans `localStorage`, keyed par clé API — changer de clé invalide automatiquement le cache.
- **Routing audio virtuel (Discord, Zoom, Meet, OBS)** — nouveau sélecteur « Sortie audio de la voix traduite » dans Paramètres > Traducteur vocal. Pointe vers n'importe quel périphérique audio système (VB-Cable Input, VoiceMeeter, OBS Virtual Audio). Le `InterpretPlayer` utilise `HTMLAudioElement.setSinkId()` pour router la voix IA sur ce device — d'autres applis (Discord, Zoom) captent alors la traduction comme s'il s'agissait de votre vrai micro, en parallèle de votre voix.
- **Mode Écoute conversation (Listener)** — écoute en temps réel ce que dit **une autre personne** et affiche la transcription + traduction dans un panneau défilant avec auto-scroll et timestamps. Sélecteur d'entrée audio dédié (typiquement un device loopback comme « CABLE Output » pour capturer un appel Discord entrant, ou un micro secondaire). Deux modes : **Texte uniquement** (défaut, lecture rapide, économique) ou **Texte + audio TTS** (la traduction est aussi prononcée via le moteur TTS choisi). Chaque segment peut être copié dans le presse-papiers en un clic. Historique borné à 200 segments pour contenir la mémoire.
- **Pipeline text-to-speech dédié (`voiceink:speak`)** — nouvel IPC qui bypass Whisper pour synthétiser directement un texte déjà traduit, utilisé par le mode audio du Listener. Reuse les 3 moteurs TTS existants + le routing `setSinkId`.
- **Catalogue Cartesia validé live** : 100 voix retournées par l'API en une requête, avec 15 langues (en: 30, es: 11, ko: 10, ar: 8, hi: 7, de: 6, tl: 6, fr: 2, …) et 100 % de voix avec métadata de genre (55 féminines, 45 masculines).

### Tests

- **Pipeline full-stack validé** avec vraies clés Groq + Cartesia, 3 scénarios EN↔FR↔ES. TTFB TTS réel mesuré : **162-296 ms** pour la première syllabe synthétisée après la fin de phrase. Latence totale (Whisper + translate + 1er chunk TTS) : 1.6-2.0 s.
- **Test live des nouveaux IPCs** : 6/6 scénarios PASS (listVoices × 3, streamTTS MP3 × 2, pipeline Cartesia→Whisper→translate Cartesia→Whisper validation avec « Good evening. The package has been delivered to your front door. » → « Bonsoir. Le colis a été livré à votre porte d'entrée. »).
- **Tests unitaires** restés à 30/30 + pipeline E2E passing, aucune régression.

### Notes techniques

- `HTMLAudioElement.setSinkId()` est une API Chromium-only, non bloquante : si elle échoue (device débranché entre-temps, pas de permission), le player se rabat silencieusement sur la sortie par défaut plutôt que de planter.
- Le `useListener` hook utilise un VAD plus tolérant que `useContinuousInterpreter` (SPEAK_START=0.025 vs 0.035, SILENCE_END=0.015 vs 0.02) parce que l'audio entrant via VoIP (Discord, Zoom) est souvent plus compressé et plus quiet que l'audio direct du mic local.
- L'historique Listener est gardé client-side (non persisté, volatile par session) pour éviter de polluer l'historique de dictée. Borné à 200 segments glissants.

## [1.2.1] — 2026-04-22

### Corrigé
- **Cartesia Sonic-2 : erreur HTTP 400 « only 'raw' container is supported for this endpoint »** sur toute requête d'interprétation vocale. L'API a évolué silencieusement : les endpoints `/tts/websocket` et `/tts/sse` refusent désormais `container: mp3`, ils n'acceptent plus que `container: raw` (PCM brut). Basculé le provider sur `POST /tts/bytes` — le seul endpoint qui continue d'accepter `mp3` tout en streamant en HTTP/1.1 `Transfer-Encoding: chunked`. TTFB mesuré contre la vraie API : 162–296 ms, identique au WebSocket mais avec une implémentation 40 % plus petite (pas de parsing SSE, pas de state machine de queue). Validé avec la clé réelle de l'utilisateur : 3/3 scenarios (short EN, short FR, longer EN) produisent du MP3 ID3-valide lisible nativement.
- **Tests adaptés au nouvel endpoint** — les 3 mocks qui simulaient l'ancien protocole WebSocket réécrits pour mocker le HTTP chunked. Toujours 30/30 tests passing.

### Ajouté
- **Barre de navigation minimaliste dans Paramètres** — 10 icônes rondes (32 px) disposées en pilule glass en haut de la vue, sticky au scroll. Chaque section (Apparence, Interface, Dictionnaire, Traducteur vocal, Traduction, Transcription, Workflow, Post-traitement, Raccourcis, Système) est accessible en un clic, avec scroll fluide vers la section cible. Un `IntersectionObserver` met en évidence la section actuellement visible (halo violet), transformant la nav en indicateur de progression. Labels en tooltip au survol — zéro encombrement visuel par défaut, découverte progressive au besoin. Le dégradé glass s'accorde au reste de l'UI, cohérent avec les cartes des sections.
- **Script `scripts/_inject-cartesia-key.js`** pour préconfigurer la clé API Cartesia directement dans `%APPDATA%\voiceink\voiceink-settings.json` sans passer par l'UI — utile en développement et pour les smoke-tests de boot.

## [1.2.0] — 2026-04-22

### Ajouté
- **Traducteur vocal (interprète)** — nouveau mode indépendant des 4 modes de dictée classiques. Parlez dans votre langue, VoiceInk transcrit, traduit et **prononce instantanément** le résultat avec une voix IA réaliste. Le pipeline streame les chunks audio MP3 dès les premiers octets (TTFB ~40–200 ms selon le moteur), sans attendre la synthèse complète.
  - **Toggle indépendant** dans la barre du MainView (chip vert « Interprète vocal »), à côté du picker de mode. Activable en un clic, la langue cible se choisit dans la même chip. Les 4 modes de dictée `raw / natural / formal / message` continuent de fonctionner quand l'interprète est désactivé.
  - **Section dédiée dans Paramètres** (« Traducteur vocal »), avec choix du moteur, choix de la voix (liste curée + ID personnalisé pour voix clonées), clé API stockée par moteur, slider de vitesse de parole (0.5×–2.0×).
- **3 moteurs TTS interchangeables**, chacun en streaming HTTP/WebSocket pour minimiser la latence perçue :
  - **Cartesia Sonic-2** (par défaut) — WebSocket, TTFB ~40 ms, ~$0.015/1k caractères, voix multilingues réalistes. Obtenir la clé : [play.cartesia.ai/keys](https://play.cartesia.ai/keys).
  - **ElevenLabs Flash v2.5** — HTTP chunked, TTFB ~75 ms, voix studio quasi indistinguables d'humaines, 32 langues. Obtenir la clé : [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys).
  - **OpenAI gpt-4o-mini-tts** — HTTP chunked, 50+ langues, très économique. Obtenir la clé : [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
- **Mode interprète simultané (niveau 2, beta)** — activable depuis Paramètres. Le microphone est écouté en continu ; un détecteur d'activité vocale (VAD via WebAudio `AnalyserNode`) découpe la parole en phrases à chaque pause ≥ 600 ms et envoie chaque phrase en parallèle dans le pipeline. Résultat : la voix traduite commence à parler **pendant que vous êtes encore en train de dicter**, façon interprète ONU. Bouton « LIVE » rouge affiché quand actif.
- **Lecture audio incrémentale** — nouveau `InterpretPlayer` côté renderer : assemble les chunks MP3 via `MediaSource` + `SourceBuffer`, la lecture démarre dès le premier chunk reçu sans attendre la fin de la synthèse. Fallback automatique sur blob-URL si MediaSource n'est pas supporté.
- **34 tests automatisés** (30 unitaires / E2E `scripts/_test-interpreter.js` + pipeline complet `scripts/_test-ipc-interpret.js`) couvrant : defaults de `Settings`, constantes IPC, sanitiseur, les 3 providers contre des mocks HTTP/WS locaux, le `AbortSignal`, et un pipeline end-to-end Whisper → Translate → TTS avec 4 chunks streamés (TTFB ~30 ms en local).

### Modifié
- `src/shared/types.ts` étendu avec `interpreterEnabled`, `interpretTargetLang`, `interpreterContinuous`, `ttsProvider`, `ttsVoiceId` (keyed par provider), `ttsApiKey` (keyed par provider), `ttsSpeed`. Nouveaux types `InterpretRequest`, `InterpretResponse`, `InterpretChunkEvent`. Nouveaux IDs IPC `INTERPRET` et `ON_INTERPRET_CHUNK`.
- Dépendance ajoutée : `ws@^8.18.0` (client WebSocket pour Cartesia) + `@types/ws` en dev.
- `src/main/services/validate.ts` gagne `validateInterpretRequest` et un sanitiseur étendu pour les nouveaux champs (clamping `ttsSpeed` 0.25–4.0, enum `ttsProvider`, drop des clés de provider inconnues).
- `src/main/ipc.ts` gagne le handler `voiceink:interpret` qui orchestre Whisper → translate → streamTTS avec mesure `ttfbMs` loggée dans `runtime.log`.
- `src/main/preload.ts` expose `interpret()` et `onInterpretChunk()`.

## [1.1.3] — 2026-04-21

### Corrigé
- **Icône « Brut » toujours cassée en 1.1.2** — pas un problème de font ni de choix d'emoji, mais un bug d'encodage. Le caractère 🎤 (U+1F3A4, 4 octets UTF-8) avait été corrompu en U+FFFD (REPLACEMENT CHARACTER, le losange noir avec `?`) lors d'une édition précédente. Trois occurrences corrompues détectées dans `src/renderer/lib/constants.ts` (JSDoc, tableau de pairs emoji/icône, champ `raw.icon` lui-même). Fix appliqué au niveau binaire via un script Node qui réécrit directement les octets 0xF0 0x9F 0x8E 0xA4, court-circuitant toute chaîne d'édition susceptible de retomber sur le même problème.
- **Nouveau scan `scripts/_scan-ufffd.js`** — vérifie l'absence de U+FFFD dans tous les fichiers sources potentiellement édités, utilisable avant chaque commit pour détecter les corruptions similaires en amont.

## [1.1.2] — 2026-04-21

### Corrigé
- **Emojis des modes qui s'affichaient en carré vide** sur certains postes Windows. Deux causes combinées :
  - La chaîne `font-family` du `body` n'incluait aucune police emoji explicite. Ajout de `Segoe UI Emoji`, `Apple Color Emoji`, `Noto Color Emoji` à la fin de la chaîne — elles ne contiennent que des glyphs emoji donc ne perturbent pas le rendu du texte latin rendu par Inter / Segoe UI.
  - Certains emojis précédents reposaient sur un sélecteur de variation (`U+FE0F`) ou sur Emoji 13.0 (2020), ce qui n'est pas gérable de façon fiable par tous les builds de Windows 10. Remplacés par des emojis Emoji 1.0 (2010), à code-point unique, sans VS16 :
    - Brut : `🎙️` → `🎤` (micro simple)
    - Naturel : `🪶` → `🍃` (feuille au vent, symbole naturel éprouvé)
    - Formel : `🖋️` → `👔` (cravate, symbole professionnel universel)
    - Message : `💬` inchangé
- **Icônes Lucide ré-accordées** aux nouveaux emojis pour garder la cohérence entre le chip de sélection et la liste déroulante :
  - Naturel : `Feather` → `Leaf`
  - Formel : `PenTool` → `Briefcase`

## [1.1.1] — 2026-04-21

### Modifié
- **Emojis et icônes des modes de dictée** révisés pour une meilleure lisibilité et une distinction visuelle plus nette dans la liste déroulante :
  - Brut : `📝` → `🎙️` — icône Lucide `FileText` → `Mic`. Le micro reflète le sens réel du mode (capture audio brute), là où la page évoquait à tort un document déjà rédigé.
  - Formel : `📜` → `🖋️` — icône Lucide `Scroll` → `PenTool`. La plume de calligraphie remplace le parchemin antique, plus cohérent avec un registre soutenu moderne.
  - Naturel (`🪶` Feather) et Message (`💬` MessageSquare) restent inchangés — les paires emoji + icône étaient déjà parfaitement alignées.
- Les quatre emojis sont maintenant **visuellement distincts** : avant, `📝` et `📜` se ressemblaient beaucoup dans la liste déroulante, les utilisateurs ne pouvaient pas trancher rapidement entre Brut et Formel sans lire le label.

## [1.1.0] — 2026-04-21

### Ajouté
- **Dialogue des versions** — clic sur la pastille de version en bas à droite de la barre d'état pour consulter l'historique complet des changements.
- **Icônes Lucide par mode de dictée** dans le sélecteur de mode :
  - Brut → `FileText` (📝)
  - Naturel → `Feather` (🪶)
  - Formel → `Scroll` (📜)
  - Message → `MessageSquare` (💬)
- **Nouveau harnais de test qualité** (`scripts/run-mode-quality-test.js` + `run-mode-quality-loop.js`) : 3 dictées types × 4 modes × 3 itérations = 36 vérifications heuristiques par passe (registre formel, anti-hallucination, nombre de phrases, ratio de compression).

### Modifié
- **Prompt « Formel »** produit désormais un registre visiblement élevé : « il convient de procéder », « je désirerais », « concernant », « environ », « également ». Contraintes dures ajoutées pour interdire l'ajout de phrases fabriquées (« Il convient de préciser que… ») que l'utilisateur n'a pas dictées.
- **Prompt « Message »** bannit explicitement les ouvertures inventées (« j'ai des nouvelles », « pour faire le point », « quick update », « FYI »). Compression par suppression plutôt que paraphrase ambiguë.
- **ModePicker** : l'icône du chip change selon le mode sélectionné, avec une info-bulle descriptive.

### Corrigé
- Le sélecteur de mode applique correctement le mode choisi indépendamment de l'ancien toggle LLM.
- Réduction des modes de dictée de 7 à 4 entrées centrées sur le ton (raw/natural/formal/message), les templates redondants (email, meeting, summary, simple) ont été retirés.

## [1.0.0] — 2026-04-20

Version initiale de VoiceInk : application de dictée vocale vers texte avec post-traitement LLM.

### Ajouté
- **Dictée vocale** via Whisper (modèles Groq STT : `whisper-large-v3-turbo`, `distil-whisper-large-v3-en`).
- **Post-traitement LLM** multi-providers : Groq (llama-3.3), OpenAI, Claude, Ollama local.
- **Mode compact « pill »** style Superwhisper : pastille flottante 176×55 avec survol élargi 140×26 qui étend l'UI au passage de la souris, rétractée sinon.
- **Mode confortable** : fenêtre principale avec MainView, Historique, Paramètres, système de thèmes (Monochrome, Ocean, Aurora…), effets personnalisables.
- **Protection double-lancement** : verrou Electron `requestSingleInstanceLock` + correction race-condition sur le second-instance.
- **Préservation du foreground** : la pill n'interfère plus avec les applications en plein écran ou maximisées.
- **Dictionnaire personnalisé** (`replacements.ts`) : mots/phrases à substituer automatiquement après Whisper.
- **Démarrage automatique** au login (via `app.setLoginItemSettings`).
- **Toujours au premier plan** configurable.
- **Support multi-langues** : français, anglais, espagnol, allemand, italien, portugais + détection automatique.
- **Pipeline de traduction** : transcription en langue source puis traduction vers la langue cible.
- **Historique des transcriptions** : recherche, filtres (date, mode, épinglage), export, suppression.
- **Raccourcis clavier globaux** configurables (hotkey d'enregistrement).
- **Notifications système** pour les événements clés (démarrage, erreur, copie).
- **Installateur Windows NSIS** signé, avec désinstallation propre conservant les données utilisateur.

### Corrigé (pendant le développement de 1.0.0)
- Densité pinnée au hash de l'URL pour éviter le flash de la comfortable-view dans une pill de 176×55 lors du swap de densité.
- Divergence des chemins de paramètres entre dev (`%APPDATA%\Electron\`) et prod (`%APPDATA%\voiceink\`).
- Oscillation du survol sur la pastille compacte (halo de tolérance 80×32).
- Fuite de mémoire sur les stale-closures lors du re-render asynchrone.
- Bug « pas de feedback d'enregistrement » au double-lancement.

---

*Les commits antérieurs à la version 1.0.0 font partie du développement initial et ne sont pas individuellement listés.*
