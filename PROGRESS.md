# VoiceInk — Suivi de Progression

> **INSTRUCTION:** Ce fichier doit être mis à jour à chaque session de développement.
> Il sert de mémoire persistante pour que tout assistant IA (Cascade, Claude Code, etc.)
> puisse reprendre le travail là où il s'est arrêté.
> **Toujours lire ce fichier en premier avant de commencer à travailler.**

---

## État actuel : 🟢 UI fonctionnelle — Pipeline testable via zone texte

**Dernière mise à jour:** 2026-02-20 16:35 UTC+1

---

## Dernier fix appliqué (session 2 — 20 fév 16h35)

### Web Speech API ne fonctionne PAS dans Electron
**Cause :** Chromium nécessite une clé API Google baked dans Chrome. Electron ne l'a pas.
**Résultat :** Erreur "network" systématique. **Impossible à résoudre.**

### Approche actuelle : IPC audio pipeline
- L'enregistrement audio fonctionne (MediaRecorder + Web Audio API pour visualisation)
- L'audio est envoyé au main process via IPC en base64
- Le Whisper engine confirme la capture audio (taille en Ko) en mode simulé
- **Pour la transcription réelle :** configurer une clé OpenAI API dans Paramètres
  ou intégrer le binaire whisper.cpp
- **Zone de test texte** intégrée dans MainView pour tester le pipeline manuellement

### Raccourcis globaux
- `onToggleRecording` ajouté dans `preload.ts`
- `MainView.tsx` écoute via useEffect + useRef

### Fixes session 1
- TS6059 rootDir fix → `tsconfig.main.json` rootDir=src, outDir=dist
- sql.js types → `src/main/types/sql.js.d.ts`
- nativeImage type → `Electron.NativeImage` dans tray.ts
- Vite root → `.` (projet root) + `index.html` à la racine
- Imports renderer → `src/renderer/lib/constants.ts` (local, pas cross-directory)
- CSP retirée de index.html (gérée côté Electron main process en prod)

---

## Architecture du projet

```
D:\projet1/
├── index.html                    # HTML Vite (racine du projet)
├── vite.config.ts                # Vite config (root: ".")
├── tsconfig.json                 # TS config renderer (ESNext)
├── tsconfig.main.json            # TS config main process (CommonJS)
├── package.json                  # Dépendances & scripts
├── src/
│   ├── main/                     # Electron main process
│   │   ├── index.ts              # Entry point, fenêtre, tray, shortcuts
│   │   ├── preload.ts            # Bridge IPC (contextBridge)
│   │   ├── tray.ts               # System tray
│   │   ├── shortcuts.ts          # Raccourcis globaux
│   │   ├── ipc.ts                # Pipeline: audio → STT → LLM → injection
│   │   ├── engines/
│   │   │   ├── whisper.ts        # Whisper STT (local + OpenAI cloud)
│   │   │   └── llm.ts           # LLM (Ollama, OpenAI, Anthropic)
│   │   ├── services/
│   │   │   ├── config.ts         # Settings persistants JSON
│   │   │   ├── history.ts        # SQLite via sql.js (pur JS)
│   │   │   ├── injection.ts      # Injection texte (clipboard+paste)
│   │   │   └── export.ts         # Export TXT, SRT, JSON, DOCX
│   │   └── types/
│   │       └── sql.js.d.ts       # Type declarations pour sql.js
│   ├── renderer/                 # React UI (Vite)
│   │   ├── main.tsx              # React entry point
│   │   ├── App.tsx               # Layout principal + navigation
│   │   ├── index.css             # TailwindCSS + animations
│   │   ├── components/
│   │   │   ├── MainView.tsx      # Dictée, bouton record, visualiseur
│   │   │   ├── SettingsView.tsx  # Paramètres complets
│   │   │   ├── HistoryView.tsx   # Historique + recherche + tags
│   │   │   ├── FileView.tsx      # Transcription fichiers audio
│   │   │   ├── Sidebar.tsx       # Navigation latérale
│   │   │   ├── TitleBar.tsx      # Barre de titre custom
│   │   │   └── StatusBar.tsx     # Barre de statut
│   │   ├── hooks/
│   │   │   └── useAudioRecorder.ts # Capture audio Web Audio API
│   │   ├── lib/
│   │   │   └── constants.ts      # MODE_LABELS, SUPPORTED_LANGUAGES (local)
│   │   └── stores/
│   │       └── useStore.ts       # État global Zustand
│   └── shared/
│       └── types.ts              # Types, IPC channels, mode prompts
├── dist/                         # Output compilé
│   ├── main/                     # Electron main (CommonJS)
│   └── shared/                   # Shared types compilé
├── OBJECTIVES.md                 # Spec complète & architecture
├── README.md                     # Documentation utilisateur
└── PROGRESS.md                   # CE FICHIER
```

---

## Stack technique

- **Electron** 33 — App desktop
- **React** 18 + **TypeScript** 5.7 — UI
- **Vite** 6 — Bundler/dev server
- **TailwindCSS** 4 — Styling
- **Zustand** 5 — State management
- **sql.js** — SQLite pur JavaScript (pas de build natif)
- **Lucide React** — Icônes

---

## Fonctionnalités — État d'avancement

| Fonctionnalité | État | Notes |
|---|---|---|
| Structure projet & build | 🟡 | Build OK, renderer à vérifier |
| UI — Layout, navigation, sidebar | ✅ | Complet |
| UI — MainView (dictée) | ✅ | Bouton record, visualiseur audio, mode selector |
| UI — SettingsView | ✅ | Audio, STT, LLM, raccourcis, confidentialité |
| UI — HistoryView | ✅ | Recherche, tags, export |
| UI — FileView | ✅ | Transcription fichiers |
| Audio capture (Web Audio API) | ✅ | useAudioRecorder hook |
| Whisper STT engine | ✅ | Code prêt, besoin du binaire whisper.cpp |
| LLM post-processing | ✅ | Ollama, OpenAI, Anthropic |
| IPC pipeline | ✅ | audio → STT → LLM → injection |
| Text injection | ✅ | Clipboard + Ctrl+V |
| History (sql.js) | ✅ | CRUD, tags, recherche |
| Export (TXT, SRT, JSON, DOCX) | ✅ | Complet |
| Settings persistence | ✅ | JSON via electron-store |
| System tray | ✅ | Menu contextuel |
| Global shortcuts | ✅ | Configurable |

---

## Prochaines étapes (priorité)

1. **Vérifier que le renderer s'affiche** après le fix constants.ts
2. **Téléchargement modèle Whisper** — implémenter le download automatique
3. **Tests end-to-end** — vérifier le pipeline complet dictée → texte
4. **Packaging** — electron-builder pour distribution Windows
5. **Documentation** — guide d'installation pour l'utilisateur final

---

## Problèmes connus

- **Terminal WSL sans distribution** — L'IDE utilise WSL comme shell par défaut mais
  aucune distribution Linux n'est installée. Solution: changer le shell par défaut en
  PowerShell dans les paramètres de l'IDE (voir section ci-dessous).
- **Whisper model manquant** — `ggml-base.bin` non trouvé, le download automatique
  n'est pas encore implémenté (message affiché dans le terminal Electron).
- **Erreurs DevTools** — `Autofill.enable` et `language-mismatch` sont des erreurs
  internes de Chrome DevTools, ignorables.

---

## Configuration terminal IDE

Pour que l'assistant puisse exécuter des commandes directement:

1. Ouvrir les paramètres de l'IDE (Ctrl+,)
2. Chercher "terminal default profile windows"
3. Changer de "WSL" à "PowerShell" ou "Command Prompt"
4. Redémarrer l'IDE

Cela permettra aux assistants IA d'exécuter les commandes npm/node directement.
