"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhisperEngine = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const os = __importStar(require("os"));
const MODEL_URLS = {
    tiny: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    base: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    small: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    medium: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    large: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
};
// whisper.cpp pre-built binary URL (platform-dependent)
const WHISPER_BINARY_URL = process.platform === 'win32'
    ? 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip'
    : 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip'; // Linux users should build from source
const CLI_BINARY_NAMES = process.platform === 'win32'
    ? ['main.exe', 'whisper-cli.exe', 'whisper.exe']
    : ['main', 'whisper-cli', 'whisper'];
const SERVER_BINARY_NAMES = process.platform === 'win32'
    ? ['server.exe', 'whisper-server.exe']
    : ['server', 'whisper-server'];
const SERVER_PORT = 8178;
// Persistent keep-alive agent for Groq API — avoids TCP+TLS handshake on every request
const groqAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 60000,
    maxSockets: 2,
    timeout: 15000,
});
class WhisperEngine {
    configService;
    modelPath = null;
    cliBinaryPath = null;
    serverBinaryPath = null;
    serverProcess = null;
    serverReady = false;
    isReady = false;
    // Persistent Python server (Linux faster-whisper)
    pythonServerProcess = null;
    pythonServerReady = false;
    pythonServerPendingResolve = null;
    pythonServerPendingReject = null;
    pythonBin = 'python3';
    constructor(configService) {
        this.configService = configService;
    }
    async initialize() {
        const settings = this.configService.getSettings();
        const modelsDir = this.configService.getModelsPath();
        // Scan for any available model, preferring tiny (fastest) then base, etc.
        const modelPriority = ['base', 'tiny', 'small', 'medium', 'large'];
        let foundModel = null;
        for (const model of modelPriority) {
            const p = path.join(modelsDir, `ggml-${model}.bin`);
            if (fs.existsSync(p)) {
                this.modelPath = p;
                this.isReady = true;
                foundModel = model;
                console.log(`Whisper model: ggml-${model}.bin${model === 'tiny' ? ' (fast)' : ''}`);
                break;
            }
        }
        if (!foundModel) {
            console.log('No whisper model found. Will download tiny on first use.');
            this.isReady = false;
        }
        else if (foundModel === 'tiny') {
            // Tiny found but base is better — download base in background
            console.log('Downloading base model in background for better quality...');
            this.downloadModel('base', (p) => {
                if (p % 25 === 0)
                    console.log(`Base model download: ${p}%`);
            }).then(() => {
                const bp = path.join(modelsDir, 'ggml-base.bin');
                if (fs.existsSync(bp)) {
                    this.modelPath = bp;
                    console.log('Switched to base model (better quality). Restarting server...');
                    this.stopServer();
                    this.startServer().catch(() => { });
                }
            }).catch((err) => {
                console.log('Base model download failed (will use current model):', err.message);
            });
        }
        // Find binaries - auto-download only on Windows (Linux uses faster-whisper Python)
        this.cliBinaryPath = this.findBinaryByNames(CLI_BINARY_NAMES);
        this.serverBinaryPath = this.findBinaryByNames(SERVER_BINARY_NAMES);
        if (!this.cliBinaryPath && !this.serverBinaryPath) {
            if (process.platform === 'win32') {
                console.log('Whisper binaries not found. Downloading...');
                try {
                    await this.downloadBinary((msg) => console.log(msg));
                }
                catch (err) {
                    console.error('Binary download failed:', err.message);
                }
            }
            else {
                console.log('[STT] Linux: using faster-whisper (Python) for transcription.');
            }
        }
        if (this.cliBinaryPath)
            console.log(`Whisper CLI: ${this.cliBinaryPath}`);
        if (this.serverBinaryPath)
            console.log(`Whisper server: ${this.serverBinaryPath}`);
        // Start persistent server if possible
        if (this.isReady && this.serverBinaryPath) {
            await this.startServer();
        }
        // On Linux: start persistent Python server for sub-second transcription
        if (process.platform !== 'win32') {
            this.startPythonServer().catch((err) => console.warn('[Python Server] Failed to start:', err.message));
        }
    }
    // ===== Binary management =====
    getBinDir() {
        const binDir = path.join(this.configService.getModelsPath(), 'bin');
        if (!fs.existsSync(binDir)) {
            fs.mkdirSync(binDir, { recursive: true });
        }
        return binDir;
    }
    findBinaryByNames(names) {
        const binDir = this.getBinDir();
        for (const name of names) {
            const p = path.join(binDir, name);
            if (fs.existsSync(p))
                return p;
        }
        // Check subdirectories (zip might extract into a folder)
        try {
            const items = fs.readdirSync(binDir, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory()) {
                    for (const name of names) {
                        const p = path.join(binDir, item.name, name);
                        if (fs.existsSync(p))
                            return p;
                    }
                }
            }
        }
        catch { }
        return null;
    }
    async downloadBinary(onProgress) {
        if (this.findBinaryByNames(CLI_BINARY_NAMES)) {
            this.cliBinaryPath = this.findBinaryByNames(CLI_BINARY_NAMES);
            this.serverBinaryPath = this.findBinaryByNames(SERVER_BINARY_NAMES);
            return;
        }
        const binDir = this.getBinDir();
        const zipPath = path.join(binDir, 'whisper-bin.zip');
        onProgress?.('Downloading whisper.cpp binary...');
        console.log(`Downloading whisper.cpp from ${WHISPER_BINARY_URL}`);
        await this.downloadFile(WHISPER_BINARY_URL, zipPath);
        onProgress?.('Extracting whisper.cpp...');
        console.log('Extracting whisper binary zip...');
        try {
            if (process.platform === 'win32') {
                (0, child_process_1.execSync)(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}' -Force"`, { timeout: 60000, windowsHide: true });
            }
            else {
                (0, child_process_1.execSync)(`unzip -o "${zipPath}" -d "${binDir}"`, { timeout: 60000 });
            }
        }
        catch (err) {
            throw new Error(`Failed to extract whisper.cpp binary: ${err.message}`);
        }
        try {
            fs.unlinkSync(zipPath);
        }
        catch { }
        this.cliBinaryPath = this.findBinaryByNames(CLI_BINARY_NAMES);
        this.serverBinaryPath = this.findBinaryByNames(SERVER_BINARY_NAMES);
        if (!this.cliBinaryPath) {
            throw new Error('whisper.cpp binary not found in archive. Download main.exe manually to: ' + binDir);
        }
        console.log(`Whisper CLI binary ready: ${this.cliBinaryPath}`);
        if (this.serverBinaryPath)
            console.log(`Whisper server binary ready: ${this.serverBinaryPath}`);
    }
    // ===== Server management (persistent process, fast transcription) =====
    async startServer() {
        if (this.serverReady && this.serverProcess)
            return;
        if (!this.serverBinaryPath || !this.modelPath)
            return;
        const threads = Math.max(2, os.cpus().length - 2);
        console.log(`Starting whisper server on port ${SERVER_PORT} with ${threads} threads...`);
        const lang = this.configService.getSettings().stt.language || 'fr';
        console.log(`Server language: ${lang}`);
        this.serverProcess = (0, child_process_1.spawn)(this.serverBinaryPath, [
            '-m', this.modelPath,
            '--host', '127.0.0.1',
            '--port', String(SERVER_PORT),
            '-t', String(threads),
            '-l', lang,
        ], { windowsHide: true });
        this.serverProcess.stderr?.on('data', (data) => {
            const msg = data.toString();
            // whisper.cpp server prints to stderr when ready
            if (msg.includes('listening') || msg.includes('running')) {
                this.serverReady = true;
            }
        });
        this.serverProcess.on('close', (code) => {
            console.log(`Whisper server exited (code ${code})`);
            this.serverReady = false;
            this.serverProcess = null;
        });
        this.serverProcess.on('error', (err) => {
            console.error('Whisper server error:', err.message);
            this.serverReady = false;
            this.serverProcess = null;
        });
        // Wait for server to be ready (model loading)
        await this.waitForServerReady(20000);
    }
    async waitForServerReady(timeout) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (this.serverReady) {
                console.log('Whisper server ready!');
                return;
            }
            // Also try HTTP probe
            try {
                await this.httpGet(`http://127.0.0.1:${SERVER_PORT}/`);
                this.serverReady = true;
                console.log('Whisper server ready (HTTP probe)!');
                return;
            }
            catch { }
            await new Promise(r => setTimeout(r, 500));
        }
        console.log('Whisper server did not start in time. Will use CLI fallback.');
    }
    stopServer() {
        if (this.serverProcess) {
            console.log('Stopping whisper server...');
            this.serverProcess.kill();
            this.serverProcess = null;
            this.serverReady = false;
        }
    }
    // ===== Model management =====
    async downloadModel(model, onProgress) {
        const modelsDir = this.configService.getModelsPath();
        const modelFile = `ggml-${model}.bin`;
        const fullPath = path.join(modelsDir, modelFile);
        if (fs.existsSync(fullPath)) {
            this.modelPath = fullPath;
            this.isReady = true;
            return fullPath;
        }
        const url = MODEL_URLS[model];
        console.log(`Downloading model ${model} from ${url}`);
        return new Promise((resolve, reject) => {
            const download = (downloadUrl) => {
                https.get(downloadUrl, (response) => {
                    if (response.statusCode === 301 || response.statusCode === 302) {
                        const redirectUrl = response.headers.location;
                        if (redirectUrl) {
                            download(redirectUrl);
                            return;
                        }
                    }
                    if (response.statusCode !== 200) {
                        reject(new Error(`Download failed with status ${response.statusCode}`));
                        return;
                    }
                    const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                    let downloadedSize = 0;
                    const file = fs.createWriteStream(fullPath);
                    response.on('data', (chunk) => {
                        downloadedSize += chunk.length;
                        if (totalSize > 0 && onProgress) {
                            onProgress(Math.round((downloadedSize / totalSize) * 100));
                        }
                    });
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        this.modelPath = fullPath;
                        this.isReady = true;
                        resolve(fullPath);
                    });
                    file.on('error', (err) => {
                        try {
                            fs.unlinkSync(fullPath);
                        }
                        catch { }
                        reject(err);
                    });
                }).on('error', reject);
            };
            download(url);
        });
    }
    // ===== Direct buffer transcription (no temp file) =====
    async transcribeFromBuffer(audioBuffer, language) {
        const settings = this.configService.getSettings();
        const autoDetect = settings.stt.autoDetectLanguage && !language;
        const lang = autoDetect ? '' : (language || settings.stt.language || 'fr');
        if (settings.stt.provider === 'groq') {
            const groqKey = settings.stt.groqApiKey;
            if (groqKey) {
                console.log(`[STT] Groq direct buffer (${audioBuffer.length} bytes, lang=${lang || 'auto'})`);
                return this.transcribeGroqBuffer(audioBuffer, groqKey, lang);
            }
        }
        // Fallback: write temp file and use normal path
        const tempPath = require('path').join(require('electron').app.getPath('temp'), `voiceink-${Date.now()}.wav`);
        await fs.promises.writeFile(tempPath, audioBuffer);
        try {
            return await this.transcribe(tempPath, language);
        }
        finally {
            fs.promises.unlink(tempPath).catch(() => { });
        }
    }
    // Groq with direct buffer — zero disk I/O, keep-alive connection
    async transcribeGroqBuffer(audioBuffer, apiKey, lang) {
        const t0 = Date.now();
        const boundary = '----VIGroq' + t0;
        const parts = [
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
            audioBuffer,
            Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3-turbo\r\n`),
        ];
        // Omit language parameter for auto-detection (lang === '')
        if (lang) {
            parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${lang}\r\n`));
        }
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`));
        parts.push(Buffer.from(`--${boundary}--\r\n`));
        const body = Buffer.concat(parts);
        console.log(`[STT] Groq body built: ${body.length} bytes (${Date.now() - t0}ms)`);
        return new Promise((resolve, reject) => {
            const tReq = Date.now();
            const req = https.request({
                hostname: 'api.groq.com',
                path: '/openai/v1/audio/transcriptions',
                method: 'POST',
                agent: groqAgent,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': body.length,
                },
            }, (res) => {
                const tFirstByte = Date.now();
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    const tEnd = Date.now();
                    console.log(`[STT] Groq timing: connect=${tFirstByte - tReq}ms, response=${tEnd - tFirstByte}ms, total=${tEnd - t0}ms`);
                    if (res.statusCode === 403) {
                        reject(new Error('Cle API Groq invalide ou expiree. Regenerez-la sur console.groq.com'));
                        return;
                    }
                    if (res.statusCode === 401) {
                        reject(new Error('Cle API Groq non autorisee. Verifiez-la dans Parametres > STT'));
                        return;
                    }
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(`Groq HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
                        return;
                    }
                    try {
                        const result = JSON.parse(data);
                        if (result.error) {
                            reject(new Error(`Groq: ${result.error.message || JSON.stringify(result.error)}`));
                            return;
                        }
                        const text = (result.text || '').trim();
                        const detectedLang = result.language || lang || 'unknown';
                        console.log(`[STT] Groq OK ${tEnd - t0}ms: "${text.substring(0, 80)}"${!lang ? ` (detected: ${detectedLang})` : ''}`);
                        resolve({ text, language: detectedLang, segments: [], duration: result.duration || 0 });
                    }
                    catch {
                        reject(new Error(`Groq parse error: ${data.slice(0, 200)}`));
                    }
                });
            });
            req.on('error', (err) => reject(new Error(`Erreur reseau Groq: ${err.message}`)));
            req.write(body);
            req.end();
        });
    }
    // ===== Transcription (file-based, for local whisper) =====
    async transcribe(audioPath, language) {
        const settings = this.configService.getSettings();
        const lang = language || settings.stt.language || 'fr';
        // Groq Whisper (instant, free, best quality)
        if (settings.stt.provider === 'groq') {
            const groqKey = settings.stt.groqApiKey;
            if (groqKey) {
                console.log(`[STT] Using Groq Whisper (instant cloud, lang=${lang})...`);
                try {
                    return await this.transcribeGroq(audioPath, groqKey, lang);
                }
                catch (err) {
                    console.error('[STT] Groq transcription failed:', err.message);
                    console.log('[STT] Falling back to local whisper...');
                }
            }
            else {
                console.log('[STT] Groq selected but no API key. Falling back to local whisper...');
            }
        }
        // GLM cloud STT
        if (settings.stt.provider === 'glm') {
            console.log('[STT] Using GLM Flash cloud transcription...');
            try {
                return await this.transcribeGLM(audioPath);
            }
            catch (err) {
                console.error('[STT] GLM transcription failed:', err.message);
                console.log('[STT] Falling back to local whisper...');
            }
        }
        // OpenAI Whisper cloud
        if (settings.stt.provider === 'openai') {
            return this.transcribeCloud(audioPath);
        }
        // On Linux (WSL2), use faster-whisper Python if available
        if (process.platform !== 'win32') {
            console.log('[STT] Linux detected, trying faster-whisper (Python)...');
            try {
                return await this.transcribeViaPython(audioPath, lang);
            }
            catch (err) {
                console.error('[STT] faster-whisper failed:', err.message);
                // Fall through to native whisper.cpp
            }
        }
        // Auto-download model if not ready
        if (!this.isReady) {
            console.log('[STT] Model not ready, attempting auto-download...');
            try {
                await this.downloadModel(settings.stt.localModel, (progress) => {
                    console.log(`[STT] Downloading model: ${progress}%`);
                });
            }
            catch (err) {
                throw new Error('Impossible de telecharger le modele Whisper.');
            }
        }
        // Auto-download binaries only on Windows (Linux uses faster-whisper Python)
        if (!this.cliBinaryPath && !this.serverBinaryPath && process.platform === 'win32') {
            console.log('[STT] Whisper binaries not found, downloading...');
            await this.downloadBinary((msg) => console.log(msg));
            // Try to start server now that we have binaries
            if (this.serverBinaryPath && !this.serverReady) {
                await this.startServer();
            }
        }
        // Prefer server (model in memory = fast) over CLI (reloads model each time)
        if (this.serverReady) {
            console.log('[STT] Using whisper server for transcription...');
            return this.transcribeViaServer(audioPath, lang);
        }
        console.log('[STT] Using whisper CLI for transcription (slower, model reloads each time)...');
        return this.transcribeViaCLI(audioPath, lang);
    }
    // ===== Groq Whisper (instant, free, large-v3-turbo) =====
    async transcribeGroq(audioPath, apiKey, lang) {
        if (!lang)
            lang = this.configService.getSettings().stt.language || 'fr';
        const audioData = await fs.promises.readFile(audioPath);
        const startTime = Date.now();
        const boundary = '----VoiceInkGroq' + Date.now();
        const formParts = [
            // file
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
            audioData,
            Buffer.from('\r\n'),
            // model
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3-turbo\r\n`),
            // language
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${lang}\r\n`),
            // response_format — json is faster than verbose_json
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`),
            // end
            Buffer.from(`--${boundary}--\r\n`),
        ];
        const body = Buffer.concat(formParts);
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.groq.com',
                path: '/openai/v1/audio/transcriptions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': body.length,
                },
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    const elapsed = Date.now() - startTime;
                    try {
                        const result = JSON.parse(data);
                        if (result.error) {
                            reject(new Error(`Groq API error: ${result.error.message || JSON.stringify(result.error)}`));
                            return;
                        }
                        const text = (result.text || '').trim();
                        console.log(`[STT] Groq transcription (${elapsed}ms): "${text.substring(0, 100)}"`);
                        resolve({
                            text,
                            language: result.language || lang,
                            segments: (result.segments || []).map((s) => ({
                                start: s.start, end: s.end, text: s.text,
                            })),
                            duration: result.duration || 0,
                        });
                    }
                    catch {
                        reject(new Error(`Failed to parse Groq response: ${data.slice(0, 300)}`));
                    }
                });
            });
            req.on('error', (err) => reject(new Error(`Groq request error: ${err.message}`)));
            req.write(body);
            req.end();
        });
    }
    // ===== GLM Flash Cloud Transcription =====
    async transcribeGLM(audioPath) {
        const settings = this.configService.getSettings();
        const apiKey = settings.llm.glmApiKey;
        const lang = settings.stt.language || 'fr';
        if (!apiKey) {
            throw new Error('GLM API key required for cloud transcription.');
        }
        const audioData = fs.readFileSync(audioPath);
        const base64Audio = audioData.toString('base64');
        const startTime = Date.now();
        // Use GLM-4-Flash with audio transcription prompt
        const body = JSON.stringify({
            model: settings.llm.glmModel || 'glm-4-flash',
            messages: [
                {
                    role: 'system',
                    content: `Tu es un systeme de transcription vocale. L'utilisateur t'envoie de l'audio encode en base64 au format WAV 16kHz mono 16-bit. Transcris fidelement le contenu audio en texte. La langue principale est "${lang === 'fr' ? 'francais' : lang}". Reponds UNIQUEMENT avec le texte transcrit, sans guillemets, sans explication, sans prefixe.`
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Transcris cet audio (WAV base64, ${audioData.length} octets, 16kHz mono):\n\n[AUDIO_BASE64_START]\n${base64Audio}\n[AUDIO_BASE64_END]`
                        }
                    ]
                }
            ],
            temperature: 0.1,
            max_tokens: 2048,
        });
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'open.bigmodel.cn',
                path: '/api/paas/v4/chat/completions',
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    const elapsed = Date.now() - startTime;
                    try {
                        const result = JSON.parse(data);
                        if (result.error) {
                            reject(new Error(`GLM API error: ${result.error.message || JSON.stringify(result.error)}`));
                            return;
                        }
                        const text = (result.choices?.[0]?.message?.content || '').trim();
                        console.log(`[STT] GLM transcription (${elapsed}ms): "${text.substring(0, 100)}"`);
                        if (!text) {
                            reject(new Error('GLM returned empty transcription'));
                            return;
                        }
                        resolve({
                            text,
                            language: lang,
                            segments: [],
                            duration: 0,
                        });
                    }
                    catch (err) {
                        reject(new Error(`Failed to parse GLM response: ${data.slice(0, 300)}`));
                    }
                });
            });
            req.on('error', (err) => {
                reject(new Error(`GLM request error: ${err.message}`));
            });
            req.write(body);
            req.end();
        });
    }
    // ===== Persistent Python Server (Linux, sub-second transcription) =====
    findPythonBin() {
        const projectRoot = path.resolve(__dirname, '..', '..', '..');
        const candidates = [
            path.join(projectRoot, '.venv', 'bin', 'python3'),
            path.join(projectRoot, '.venv', 'Scripts', 'python.exe'),
            'python3',
            'python',
        ];
        for (const p of candidates) {
            try {
                (0, child_process_1.execSync)(`"${p}" -c "import faster_whisper" 2>/dev/null`, { timeout: 5000 });
                return p;
            }
            catch { }
        }
        return 'python3';
    }
    async startPythonServer() {
        // Always use tiny for the persistent server — it's 4x faster than base
        // and keeps latency under 1 second. Base/larger models can be used via CLI fallback.
        const model = 'tiny';
        this.pythonBin = this.findPythonBin();
        const serverScript = path.resolve(__dirname, 'whisper_server.py');
        if (!fs.existsSync(serverScript)) {
            throw new Error(`whisper_server.py not found at ${serverScript}`);
        }
        console.log(`[Python Server] Starting with model=${model}, python=${this.pythonBin}`);
        this.pythonServerProcess = (0, child_process_1.spawn)(this.pythonBin, [serverScript, model], {
            env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });
        let buffer = '';
        this.pythonServerProcess.stdout?.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                try {
                    const msg = JSON.parse(trimmed);
                    if (msg.ready) {
                        this.pythonServerReady = true;
                        console.log('[Python Server] Model loaded, ready for sub-second transcription');
                        return;
                    }
                    // Resolve pending transcription
                    if (this.pythonServerPendingResolve) {
                        const resolve = this.pythonServerPendingResolve;
                        this.pythonServerPendingResolve = null;
                        this.pythonServerPendingReject = null;
                        if (msg.error) {
                            resolve(null); // will be handled by caller
                        }
                        else {
                            resolve(msg);
                        }
                    }
                }
                catch {
                    // ignore malformed lines
                }
            }
        });
        this.pythonServerProcess.stderr?.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg)
                console.log(`[Python Server] ${msg}`);
        });
        this.pythonServerProcess.on('close', (code) => {
            console.log(`[Python Server] Exited (code ${code})`);
            this.pythonServerReady = false;
            this.pythonServerProcess = null;
            if (this.pythonServerPendingReject) {
                this.pythonServerPendingReject(new Error(`Python server exited (code ${code})`));
                this.pythonServerPendingResolve = null;
                this.pythonServerPendingReject = null;
            }
        });
        this.pythonServerProcess.on('error', (err) => {
            console.error('[Python Server] Error:', err.message);
            this.pythonServerReady = false;
        });
    }
    stopPythonServer() {
        if (this.pythonServerProcess) {
            this.pythonServerProcess.kill();
            this.pythonServerProcess = null;
            this.pythonServerReady = false;
        }
    }
    async transcribeViaPythonServer(audioPath, lang) {
        return new Promise((resolve, reject) => {
            if (!this.pythonServerProcess || !this.pythonServerReady) {
                reject(new Error('Python server not ready'));
                return;
            }
            this.pythonServerPendingResolve = (result) => {
                if (!result) {
                    reject(new Error('Python server returned error'));
                    return;
                }
                resolve({
                    text: result.text || '',
                    language: result.language || lang,
                    segments: [],
                    duration: result.duration || 0,
                });
            };
            this.pythonServerPendingReject = reject;
            const req = JSON.stringify({ path: audioPath, lang }) + '\n';
            this.pythonServerProcess.stdin?.write(req);
        });
    }
    // ===== Python transcription (spawn fallback) =====
    async transcribeViaPython(audioPath, language) {
        const settings = this.configService.getSettings();
        const lang = language || settings.stt.language || 'fr';
        // Use persistent server if available (sub-second)
        if (this.pythonServerReady && this.pythonServerProcess) {
            return this.transcribeViaPythonServer(audioPath, lang);
        }
        // Fallback: spawn a new process (slower, model reloads each time)
        const model = settings.stt.localModel || 'base';
        const script = `
import sys, json
from faster_whisper import WhisperModel
model = WhisperModel("${model}", device="cpu", compute_type="int8")
segments, info = model.transcribe("${audioPath.replace(/\\/g, '\\\\')}", language="${lang}")
text = " ".join([s.text for s in segments]).strip()
duration = info.duration if hasattr(info, 'duration') else 0
print(json.dumps({"text": text, "language": info.language, "duration": duration}))
`;
        // Ensure pythonBin is resolved
        if (!this.pythonBin || this.pythonBin === 'python3') {
            this.pythonBin = this.findPythonBin();
        }
        return new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)(this.pythonBin, ['-c', script], {
                timeout: 60000,
                env: { ...process.env, PYTHONUNBUFFERED: '1' },
            });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });
            proc.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`faster-whisper failed (code ${code}): ${stderr.slice(0, 300)}`));
                    return;
                }
                try {
                    const result = JSON.parse(stdout.trim());
                    console.log(`Python transcription: "${(result.text || '').substring(0, 100)}"`);
                    resolve({
                        text: result.text || '',
                        language: result.language || lang,
                        segments: [],
                        duration: result.duration || 0,
                    });
                }
                catch {
                    reject(new Error(`Failed to parse Python output: ${stdout.slice(0, 200)}`));
                }
            });
            proc.on('error', (err) => {
                reject(new Error(`Python spawn error: ${err.message}`));
            });
        });
    }
    async transcribeViaServer(audioPath, lang) {
        const settings = this.configService.getSettings();
        const language = lang || settings.stt.language || 'fr';
        const audioData = await fs.promises.readFile(audioPath);
        const boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
        const formData = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
            audioData,
            Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="temperature"\r\n\r\n0.0\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`),
            Buffer.from(`--${boundary}--\r\n`),
        ]);
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: '127.0.0.1',
                port: SERVER_PORT,
                path: '/inference',
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': formData.length,
                },
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    const elapsed = Date.now() - startTime;
                    try {
                        const result = JSON.parse(data);
                        const text = (result.text || '').trim();
                        console.log(`Server transcription (${elapsed}ms): "${text.substring(0, 100)}"`);
                        resolve({
                            text,
                            language,
                            segments: [],
                            duration: 0,
                        });
                    }
                    catch {
                        reject(new Error(`Invalid server response: ${data.slice(0, 200)}`));
                    }
                });
            });
            req.on('error', (err) => {
                console.error('Server request error:', err.message);
                // Fall back to CLI if server fails
                this.serverReady = false;
                this.transcribeViaCLI(audioPath, lang).then(resolve).catch(reject);
            });
            req.write(formData);
            req.end();
        });
    }
    async transcribeViaCLI(audioPath, lang) {
        if (!this.isReady || !this.modelPath) {
            throw new Error('Modele Whisper non charge.');
        }
        if (!this.cliBinaryPath) {
            throw new Error('Binaire whisper.cpp non trouve.');
        }
        const settings = this.configService.getSettings();
        const language = lang || settings.stt.language || 'fr';
        const threads = Math.max(2, os.cpus().length - 2);
        const fileSize = fs.existsSync(audioPath) ? fs.statSync(audioPath).size : 0;
        const startTime = Date.now();
        console.log(`CLI transcribing: ${audioPath} (${fileSize} bytes), ${threads} threads, lang=${language}`);
        return new Promise((resolve, reject) => {
            const args = [
                '-m', this.modelPath,
                '-f', audioPath,
                '-l', language,
                '--no-timestamps',
                '-t', String(threads),
            ];
            let stdout = '';
            let stderr = '';
            const proc = (0, child_process_1.spawn)(this.cliBinaryPath, args, { windowsHide: true });
            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });
            proc.on('error', (err) => {
                reject(new Error(`Erreur whisper.cpp: ${err.message}`));
            });
            proc.on('close', (code) => {
                const elapsed = Date.now() - startTime;
                if (code !== 0) {
                    console.error('Whisper stderr:', stderr);
                    reject(new Error(`whisper.cpp failed (code ${code}): ${stderr.slice(0, 300)}`));
                    return;
                }
                const text = stdout.trim();
                console.log(`CLI transcription (${elapsed}ms): "${text.substring(0, 100)}"`);
                resolve({
                    text: text || '',
                    language: settings.stt.language,
                    segments: [],
                    duration: 0,
                });
            });
        });
    }
    async transcribeCloud(audioPath) {
        const settings = this.configService.getSettings();
        const apiKey = settings.llm.openaiApiKey;
        if (!apiKey) {
            throw new Error('Cle API OpenAI requise pour la transcription cloud. Ajoutez-la dans Parametres.');
        }
        const audioData = fs.readFileSync(audioPath);
        const ext = path.extname(audioPath).slice(1) || 'wav';
        const mimeType = ext === 'webm' ? 'audio/webm' : 'audio/wav';
        const boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
        const formData = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
            audioData,
            Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${settings.stt.language}\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n`),
            Buffer.from(`--${boundary}--\r\n`),
        ]);
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.openai.com',
                path: '/v1/audio/transcriptions',
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': formData.length,
                },
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (result.error) {
                            reject(new Error(`OpenAI API error: ${result.error.message || JSON.stringify(result.error)}`));
                            return;
                        }
                        resolve({
                            text: result.text,
                            language: result.language || settings.stt.language,
                            segments: (result.segments || []).map((s) => ({
                                start: s.start,
                                end: s.end,
                                text: s.text,
                            })),
                            duration: result.duration || 0,
                        });
                    }
                    catch (err) {
                        reject(new Error(`Failed to parse OpenAI response: ${data.slice(0, 200)}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(formData);
            req.end();
        });
    }
    // ===== Utilities =====
    httpGet(url) {
        return new Promise((resolve, reject) => {
            http.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }
    downloadFile(url, dest) {
        return new Promise((resolve, reject) => {
            const doDownload = (downloadUrl, redirects = 0) => {
                if (redirects > 10) {
                    reject(new Error('Too many redirects'));
                    return;
                }
                https.get(downloadUrl, (response) => {
                    if (response.statusCode === 301 || response.statusCode === 302) {
                        const location = response.headers.location;
                        if (location) {
                            doDownload(location, redirects + 1);
                            return;
                        }
                    }
                    if (response.statusCode !== 200) {
                        reject(new Error(`Download failed: HTTP ${response.statusCode}`));
                        return;
                    }
                    const file = fs.createWriteStream(dest);
                    response.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                    file.on('error', (err) => {
                        try {
                            fs.unlinkSync(dest);
                        }
                        catch { }
                        reject(err);
                    });
                }).on('error', reject);
            };
            doDownload(url);
        });
    }
    getModelStatus() {
        return {
            ready: this.isReady,
            model: this.modelPath,
            serverRunning: this.serverReady,
        };
    }
    cleanup() {
        this.stopServer();
        this.isReady = false;
        this.modelPath = null;
        this.cliBinaryPath = null;
        this.serverBinaryPath = null;
    }
}
exports.WhisperEngine = WhisperEngine;
