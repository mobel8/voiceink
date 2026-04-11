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
exports.LLMEngine = void 0;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const types_1 = require("../../shared/types");
class LLMEngine {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    async process(text, mode) {
        const settings = this.configService.getSettings();
        const activeMode = mode || settings.llm.mode;
        if (activeMode === 'raw' || settings.llm.provider === 'none') {
            return { original: text, processed: text, mode: activeMode };
        }
        const systemPrompt = this.getSystemPrompt(activeMode, settings.llm.customPrompt || undefined);
        const processed = await this.callLLM(systemPrompt, text);
        return { original: text, processed, mode: activeMode };
    }
    getSystemPrompt(mode, customPrompt) {
        if (mode === 'custom') {
            return customPrompt || 'Corrige la grammaire et la ponctuation du texte suivant. Réponds uniquement avec le texte corrigé.';
        }
        if (mode === 'raw') {
            return 'Corrige la grammaire et la ponctuation du texte suivant. Réponds uniquement avec le texte corrigé, sans explication.';
        }
        return types_1.MODE_PROMPTS[mode] || types_1.MODE_PROMPTS.email;
    }
    async callLLM(systemPrompt, userText) {
        const settings = this.configService.getSettings();
        switch (settings.llm.provider) {
            case 'ollama':
                return this.callOllama(systemPrompt, userText);
            case 'openai':
                return this.callOpenAI(systemPrompt, userText);
            case 'anthropic':
                return this.callAnthropic(systemPrompt, userText);
            case 'glm':
                return this.callGLM(systemPrompt, userText);
            default:
                return userText;
        }
    }
    async callOllama(systemPrompt, userText) {
        const settings = this.configService.getSettings();
        const url = new URL(settings.llm.ollamaUrl + '/api/generate');
        const body = JSON.stringify({
            model: settings.llm.ollamaModel,
            system: systemPrompt,
            prompt: userText,
            stream: false,
            options: {
                temperature: settings.llm.temperature,
            },
        });
        return new Promise((resolve, reject) => {
            const protocol = url.protocol === 'https:' ? https : http;
            const req = protocol.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(result.response || userText);
                    }
                    catch {
                        reject(new Error(`Failed to parse Ollama response: ${data}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
    async callOpenAI(systemPrompt, userText) {
        const settings = this.configService.getSettings();
        const apiKey = settings.llm.openaiApiKey;
        if (!apiKey) {
            throw new Error('OpenAI API key required.');
        }
        const body = JSON.stringify({
            model: settings.llm.openaiModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userText },
            ],
            temperature: settings.llm.temperature,
        });
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.openai.com',
                path: '/v1/chat/completions',
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
                    try {
                        const result = JSON.parse(data);
                        if (result.choices?.[0]?.message?.content) {
                            resolve(result.choices[0].message.content);
                        }
                        else {
                            reject(new Error(`Unexpected OpenAI response: ${data}`));
                        }
                    }
                    catch {
                        reject(new Error(`Failed to parse OpenAI response: ${data}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
    async callAnthropic(systemPrompt, userText) {
        const settings = this.configService.getSettings();
        const apiKey = settings.llm.anthropicApiKey;
        if (!apiKey) {
            throw new Error('Anthropic API key required.');
        }
        const body = JSON.stringify({
            model: settings.llm.anthropicModel,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userText }],
            temperature: settings.llm.temperature,
        });
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.anthropic.com',
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (result.content?.[0]?.text) {
                            resolve(result.content[0].text);
                        }
                        else {
                            reject(new Error(`Unexpected Anthropic response: ${data}`));
                        }
                    }
                    catch {
                        reject(new Error(`Failed to parse Anthropic response: ${data}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
    async callGLM(systemPrompt, userText) {
        const settings = this.configService.getSettings();
        const apiKey = settings.llm.glmApiKey;
        if (!apiKey) {
            throw new Error('GLM API key required.');
        }
        const body = JSON.stringify({
            model: settings.llm.glmModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userText },
            ],
            temperature: settings.llm.temperature,
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
                    try {
                        const result = JSON.parse(data);
                        if (result.choices?.[0]?.message?.content) {
                            resolve(result.choices[0].message.content);
                        }
                        else {
                            reject(new Error(`Unexpected GLM response: ${data}`));
                        }
                    }
                    catch {
                        reject(new Error(`Failed to parse GLM response: ${data}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
    async chatStream(messages, onToken) {
        const settings = this.configService.getSettings();
        const provider = settings.llm.provider === 'none' ? 'anthropic' : settings.llm.provider;
        switch (provider) {
            case 'glm':
                return this.streamGLM(messages, onToken);
            case 'openai':
                return this.streamOpenAI(messages, onToken);
            case 'anthropic':
                return this.streamAnthropic(messages, onToken);
            case 'ollama':
                return this.streamOllama(messages, onToken);
            default:
                return this.streamAnthropic(messages, onToken);
        }
    }
    async streamGLM(messages, onToken) {
        const settings = this.configService.getSettings();
        const apiKey = settings.llm.glmApiKey;
        if (!apiKey)
            throw new Error('GLM API key required.');
        const body = JSON.stringify({
            model: settings.llm.glmModel,
            messages,
            temperature: settings.llm.temperature,
            stream: true,
        });
        return new Promise((resolve, reject) => {
            let fullText = '';
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
                let buffer = '';
                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data:'))
                            continue;
                        const jsonStr = trimmed.slice(5).trim();
                        if (jsonStr === '[DONE]')
                            continue;
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const delta = parsed.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullText += delta;
                                onToken(delta);
                            }
                        }
                        catch { }
                    }
                });
                res.on('end', () => resolve(fullText));
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
    async streamOpenAI(messages, onToken) {
        const settings = this.configService.getSettings();
        const apiKey = settings.llm.openaiApiKey;
        if (!apiKey)
            throw new Error('OpenAI API key required.');
        const body = JSON.stringify({
            model: settings.llm.openaiModel,
            messages,
            temperature: settings.llm.temperature,
            stream: true,
        });
        return new Promise((resolve, reject) => {
            let fullText = '';
            const req = https.request({
                hostname: 'api.openai.com',
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            }, (res) => {
                let buffer = '';
                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data:'))
                            continue;
                        const jsonStr = trimmed.slice(5).trim();
                        if (jsonStr === '[DONE]')
                            continue;
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const delta = parsed.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullText += delta;
                                onToken(delta);
                            }
                        }
                        catch { }
                    }
                });
                res.on('end', () => resolve(fullText));
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
    async streamAnthropic(messages, onToken) {
        const settings = this.configService.getSettings();
        const apiKey = settings.llm.anthropicApiKey;
        if (!apiKey)
            throw new Error('Anthropic API key required.');
        const systemMsg = messages.find(m => m.role === 'system');
        const userMessages = messages.filter(m => m.role !== 'system');
        const body = JSON.stringify({
            model: settings.llm.anthropicModel,
            max_tokens: 4096,
            system: systemMsg?.content || '',
            messages: userMessages,
            temperature: settings.llm.temperature,
            stream: true,
        });
        return new Promise((resolve, reject) => {
            let fullText = '';
            const req = https.request({
                hostname: 'api.anthropic.com',
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            }, (res) => {
                let buffer = '';
                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data:'))
                            continue;
                        const jsonStr = trimmed.slice(5).trim();
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const delta = parsed.delta?.text;
                            if (delta) {
                                fullText += delta;
                                onToken(delta);
                            }
                        }
                        catch { }
                    }
                });
                res.on('end', () => resolve(fullText));
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
    async streamOllama(messages, onToken) {
        const settings = this.configService.getSettings();
        const url = new URL(settings.llm.ollamaUrl + '/api/chat');
        const body = JSON.stringify({
            model: settings.llm.ollamaModel,
            messages,
            stream: true,
            options: { temperature: settings.llm.temperature },
        });
        return new Promise((resolve, reject) => {
            let fullText = '';
            const protocol = url.protocol === 'https:' ? https : http;
            const req = protocol.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            }, (res) => {
                let buffer = '';
                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.trim())
                            continue;
                        try {
                            const parsed = JSON.parse(line);
                            const content = parsed.message?.content;
                            if (content) {
                                fullText += content;
                                onToken(content);
                            }
                        }
                        catch { }
                    }
                });
                res.on('end', () => resolve(fullText));
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
}
exports.LLMEngine = LLMEngine;
