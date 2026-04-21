# Changelog

Toutes les modifications notables de VoiceInk sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet adhère au [Versionnement Sémantique](https://semver.org/lang/fr/).

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
