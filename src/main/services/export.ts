import * as fs from 'fs';
import * as path from 'path';
import { HistoryEntry, TranscriptionSegment, ExportFormat } from '../../shared/types';

export class ExportService {
  async exportEntry(entry: HistoryEntry, format: ExportFormat, outputPath: string): Promise<string> {
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

  private async exportTxt(entry: HistoryEntry, outputPath: string): Promise<string> {
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

  private async exportSrt(entry: HistoryEntry, outputPath: string): Promise<string> {
    // Generate SRT from text (split by sentences)
    const sentences = entry.processedText.split(/(?<=[.!?])\s+/);
    const lines: string[] = [];
    let index = 1;
    let currentTime = 0;
    const avgDuration = entry.duration / Math.max(sentences.length, 1);

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
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

  private formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  private async exportJson(entry: HistoryEntry, outputPath: string): Promise<string> {
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

  private async exportDocx(entry: HistoryEntry, outputPath: string): Promise<string> {
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
