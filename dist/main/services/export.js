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
exports.ExportService = void 0;
const fs = __importStar(require("fs"));
class ExportService {
    async exportEntry(entry, format, outputPath) {
        switch (format) {
            case 'txt':
                return this.exportTxt(entry, outputPath);
            case 'srt':
                return this.exportSrt(entry, outputPath);
            case 'json':
                return this.exportJson(entry, outputPath);
            case 'docx':
                return this.exportDocx(entry, outputPath);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }
    async exportTxt(entry, outputPath) {
        const content = [
            `VoiceInk Transcription`,
            `Date: ${new Date(entry.timestamp).toLocaleString()}`,
            `Mode: ${entry.mode}`,
            `Language: ${entry.language}`,
            `Duration: ${entry.duration.toFixed(1)}s`,
            `---`,
            ``,
            entry.processedText,
            ``,
            `--- Original ---`,
            entry.originalText,
        ].join('\n');
        const filePath = outputPath.endsWith('.txt') ? outputPath : outputPath + '.txt';
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    async exportSrt(entry, outputPath) {
        // Generate SRT from text (split by sentences)
        const sentences = entry.processedText.split(/(?<=[.!?])\s+/);
        const lines = [];
        let index = 1;
        let currentTime = 0;
        const avgDuration = entry.duration / Math.max(sentences.length, 1);
        for (const sentence of sentences) {
            if (!sentence.trim())
                continue;
            const startTime = currentTime;
            const endTime = currentTime + avgDuration;
            lines.push(String(index));
            lines.push(`${this.formatSrtTime(startTime)} --> ${this.formatSrtTime(endTime)}`);
            lines.push(sentence.trim());
            lines.push('');
            currentTime = endTime;
            index++;
        }
        const filePath = outputPath.endsWith('.srt') ? outputPath : outputPath + '.srt';
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
        return filePath;
    }
    formatSrtTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }
    async exportJson(entry, outputPath) {
        const data = {
            id: entry.id,
            timestamp: entry.timestamp,
            date: new Date(entry.timestamp).toISOString(),
            originalText: entry.originalText,
            processedText: entry.processedText,
            mode: entry.mode,
            language: entry.language,
            duration: entry.duration,
            tags: entry.tags,
            source: entry.source,
            fileName: entry.fileName,
        };
        const filePath = outputPath.endsWith('.json') ? outputPath : outputPath + '.json';
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return filePath;
    }
    async exportDocx(entry, outputPath) {
        // Simple DOCX export using XML (no external dependency)
        // For a production app, use docx library
        const filePath = outputPath.endsWith('.docx') ? outputPath : outputPath + '.txt';
        // Fallback to txt for now - in production use officegen or docx npm package
        const content = [
            `VoiceInk Transcription`,
            ``,
            `Date: ${new Date(entry.timestamp).toLocaleString()}`,
            `Mode: ${entry.mode}`,
            `Language: ${entry.language}`,
            `Duration: ${entry.duration.toFixed(1)}s`,
            ``,
            `---`,
            ``,
            entry.processedText,
        ].join('\n');
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
}
exports.ExportService = ExportService;
