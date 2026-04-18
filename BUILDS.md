# VoiceInk — Installers

## What you get

| Platform | Artifact                                         | Shortcut |
|----------|--------------------------------------------------|----------|
| Windows  | `VoiceInk-Setup-<version>-x64.exe` (NSIS)        | Desktop + Start Menu auto-created by the installer |
| Linux    | `VoiceInk-<version>-x86_64.AppImage` (portable)  | Make executable (`chmod +x`), double-click to run; first launch registers the desktop entry via AppImageLauncher if installed |
| Linux    | `voiceink_<version>_amd64.deb` (APT)             | `sudo dpkg -i voiceink_*.deb` — a *VoiceInk* entry lands in your app menu automatically |
| macOS    | `VoiceInk-<version>-(x64\|arm64).dmg`            | Drag `VoiceInk.app` into `Applications`; it appears in Launchpad |

All installers produce a **shortcut/launcher** that looks and behaves like a native application (icon, menu entry, taskbar integration).

## Building locally

### Windows (works on Windows)
```powershell
npm ci
npm run dist:win
# → release\VoiceInk-Setup-1.0.0-x64.exe
```

> First run will fail if Developer Mode is off — electron-builder needs to extract macOS symlinks from its tool archive. Either enable Developer Mode in Windows Settings, or run `_extract-wincodesign.bat` once to pre-extract the archive without symlinks.

### Linux (works on Linux)
```bash
sudo apt-get install -y ruby ruby-dev rubygems build-essential rpm
sudo gem install --no-document fpm
npm ci
npm run dist:linux
# → release/VoiceInk-1.0.0-x86_64.AppImage
# → release/voiceink_1.0.0_amd64.deb
```

### macOS (works on macOS)
```bash
npm ci
npm run dist:mac
# → release/VoiceInk-1.0.0-x64.dmg
# → release/VoiceInk-1.0.0-arm64.dmg (Apple Silicon)
```

## Building everything at once — GitHub Actions

The repo ships with a ready-to-use workflow at `.github/release-workflow.yml.example`. It builds Windows, Linux and macOS installers on GitHub's native runners and attaches them to releases.

### Enabling it (one-off)

Because a Personal Access Token without the `workflow` scope can't push files to `.github/workflows/`, activate the workflow from the GitHub web UI:

1. Open the repo on GitHub → the file `.github/release-workflow.yml.example`.
2. Click ✏️ *Edit*, then rename the file to `.github/workflows/release.yml` (just change the path in the file-name field).
3. *Commit* directly to `main`.

Alternatively, push with a PAT that has the `workflow` scope, or use the GitHub CLI: `gh workflow create`.

### Triggering builds

1. **On a tag** — `git tag v1.0.0 && git push --tags` → builds run, artifacts are uploaded to a new GitHub Release.
2. **On demand** — Actions tab → `Build installers` workflow → *Run workflow*.

Artifacts are also posted under each run (retention 30 days) in case you don't want a tagged release.

## Why we can't cross-compile from Windows

- **Linux AppImage** needs `SeCreateSymbolicLinkPrivilege` on Windows (Developer Mode / Admin) to place icon files.
- **Linux .deb/.rpm** uses `fpm` (Ruby gem) which isn't available on stock Windows.
- **macOS .dmg** requires `hdiutil`, a macOS-only tool, and macOS-only code-signing tooling if you want Gatekeeper to accept the app without a right-click-Open dance.

The GitHub Actions workflow sidesteps all of this by running each platform's build on that platform's native runner.

## Code signing (optional)

Out of the box the Windows and macOS binaries are **unsigned**:

- **Windows** — the first launch will show a "Windows protected your PC" SmartScreen dialog. Click *More info* → *Run anyway*. To get rid of the dialog permanently, purchase a code-signing certificate and set `CSC_LINK` + `CSC_KEY_PASSWORD` in the build env.
- **macOS** — Gatekeeper will block the app. Right-click → *Open* once, or run `xattr -cr /Applications/VoiceInk.app`. To get rid of that dialog permanently you need an Apple Developer ID and an app-specific password set via `CSC_LINK` / `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD`.

## Uninstall

- **Windows** — *Paramètres → Applications* → VoiceInk → Désinstaller. User settings (in `%APPDATA%\voiceink`) are preserved unless you tick "delete user data".
- **Linux (.deb)** — `sudo apt remove voiceink`.
- **Linux (AppImage)** — delete the file; the AppImageLauncher will clean up its registration.
- **macOS** — drag `VoiceInk.app` out of Applications. Settings live in `~/Library/Application Support/voiceink`.
