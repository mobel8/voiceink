import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AppSettings } from '../../shared/types';

const DEFAULT_SETTINGS: AppSettings = {
  audio: {
    deviceId: 'default',
    sampleRate: 16000,
    channels: 1,
    sensitivity: 0.5,
    noiseReduction: true,
    autoGain: true,
  },
  stt: {
    provider: 'groq',
    localModel: 'base',
    language: 'fr',
    autoDetectLanguage: false,
    gpuEnabled: true,
    groqApiKey: '',
  },
  llm: {
    provider: 'glm',
    ollamaModel: 'mistral',
    ollamaUrl: 'http://localhost:11434',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    anthropicApiKey: '',
    anthropicModel: 'claude-3-haiku-20240307',
    glmApiKey: '5dd625c79ee44dd48449987797200c81.3BLXID2z3II45C11',
    glmModel: 'glm-4-flash',
    temperature: 0.3,
    mode: 'formal',
    customPrompt: '',
  },
  privacy: 'local',
  shortcuts: {
    toggleRecording: 'CommandOrControl+Shift+Space',
    pushToTalk: 'CommandOrControl+Shift+V',
    cancelRecording: 'Escape',
  },
  ui: {
    theme: 'dark',
    overlayPosition: 'top-right',
    showOverlay: true,
    minimizeToTray: true,
    startMinimized: false,
    launchAtStartup: false,
  },
};

export class ConfigService {
  private configPath: string;
  private settings: AppSettings;

  constructor() {
    const userDataPath = app?.getPath?.('userData') || path.join(process.env.APPDATA || process.env.HOME || '.', 'VoiceInk');
    this.configPath = path.join(userDataPath, 'settings.json');
    this.settings = this.load();
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data);
        return this.merge(DEFAULT_SETTINGS, parsed);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private merge(defaults: any, overrides: any): any {
    const result = { ...defaults };
    for (const key of Object.keys(overrides)) {
      if (
        key in defaults &&
        typeof defaults[key] === 'object' &&
        !Array.isArray(defaults[key]) &&
        defaults[key] !== null
      ) {
        result[key] = this.merge(defaults[key], overrides[key]);
      } else {
        result[key] = overrides[key];
      }
    }
    return result;
  }

  private save(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.settings = this.merge(this.settings, partial);
    this.save();
    return this.getSettings();
  }

  resetSettings(): AppSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    return this.getSettings();
  }

  getModelsPath(): string {
    const userDataPath = app?.getPath?.('userData') || path.join(process.env.APPDATA || process.env.HOME || '.', 'VoiceInk');
    const modelsPath = path.join(userDataPath, 'models');
    if (!fs.existsSync(modelsPath)) {
      fs.mkdirSync(modelsPath, { recursive: true });
    }
    return modelsPath;
  }
}
