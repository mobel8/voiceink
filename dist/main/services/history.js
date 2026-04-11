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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryService = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const sql_js_1 = __importDefault(require("sql.js"));
class HistoryService {
    db = null;
    dbPath = '';
    saveTimer = null;
    constructor() {
        this.initSync();
    }
    initSync() {
        try {
            const userDataPath = electron_1.app?.getPath?.('userData') || path.join(process.env.APPDATA || process.env.HOME || '.', 'VoiceInk');
            const dbDir = path.join(userDataPath, 'data');
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            this.dbPath = path.join(dbDir, 'history.db');
        }
        catch (err) {
            console.error('Failed to set db path:', err);
        }
    }
    async initialize() {
        try {
            const SQL = await (0, sql_js_1.default)();
            if (this.dbPath && fs.existsSync(this.dbPath)) {
                const fileBuffer = fs.readFileSync(this.dbPath);
                this.db = new SQL.Database(fileBuffer);
            }
            else {
                this.db = new SQL.Database();
            }
            this.createTables();
        }
        catch (err) {
            console.error('Failed to initialize database:', err);
        }
    }
    createTables() {
        if (!this.db)
            return;
        this.db.run(`
      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        original_text TEXT NOT NULL,
        processed_text TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'raw',
        language TEXT NOT NULL DEFAULT 'fr',
        duration REAL NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'dictation',
        file_name TEXT
      )
    `);
        this.db.run(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        history_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        FOREIGN KEY (history_id) REFERENCES history(id) ON DELETE CASCADE,
        UNIQUE(history_id, tag)
      )
    `);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_tags_history_id ON tags(history_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag)`);
    }
    saveToDisk() {
        if (this.saveTimer)
            clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveNow();
        }, 500);
    }
    saveNow() {
        if (!this.db || !this.dbPath)
            return;
        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(this.dbPath, buffer);
        }
        catch (err) {
            console.error('Failed to save database:', err);
        }
    }
    mapRow(row) {
        return {
            id: row.id,
            timestamp: row.timestamp,
            originalText: row.original_text,
            processedText: row.processed_text,
            mode: row.mode,
            language: row.language,
            duration: row.duration,
            tags: row.tags_str ? String(row.tags_str).split(',') : [],
            source: row.source,
            fileName: row.file_name,
        };
    }
    queryAll(sql, params = []) {
        if (!this.db)
            return [];
        try {
            const stmt = this.db.prepare(sql);
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push(row);
            }
            stmt.free();
            return results;
        }
        catch (err) {
            console.error('Query error:', err);
            return [];
        }
    }
    queryOne(sql, params = []) {
        const results = this.queryAll(sql, params);
        return results.length > 0 ? results[0] : null;
    }
    execute(sql, params = []) {
        if (!this.db)
            return;
        try {
            this.db.run(sql, params);
        }
        catch (err) {
            console.error('Execute error:', err);
        }
    }
    add(entry) {
        if (!this.db)
            return;
        this.execute(`INSERT INTO history (id, timestamp, original_text, processed_text, mode, language, duration, source, file_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [entry.id, entry.timestamp, entry.originalText, entry.processedText,
            entry.mode, entry.language, entry.duration, entry.source, entry.fileName || null]);
        for (const tag of entry.tags) {
            this.execute(`INSERT OR IGNORE INTO tags (history_id, tag) VALUES (?, ?)`, [entry.id, tag]);
        }
        this.saveToDisk();
    }
    get(filter) {
        if (!this.db)
            return [];
        let query = `SELECT h.*, GROUP_CONCAT(t.tag) as tags_str
      FROM history h
      LEFT JOIN tags t ON h.id = t.history_id
      WHERE 1=1`;
        const params = [];
        if (filter?.search) {
            query += ` AND (h.original_text LIKE ? OR h.processed_text LIKE ?)`;
            const searchTerm = `%${filter.search}%`;
            params.push(searchTerm, searchTerm);
        }
        if (filter?.mode) {
            query += ` AND h.mode = ?`;
            params.push(filter.mode);
        }
        if (filter?.source) {
            query += ` AND h.source = ?`;
            params.push(filter.source);
        }
        if (filter?.tag) {
            query += ` AND h.id IN (SELECT history_id FROM tags WHERE tag = ?)`;
            params.push(filter.tag);
        }
        if (filter?.dateFrom) {
            query += ` AND h.timestamp >= ?`;
            params.push(filter.dateFrom);
        }
        if (filter?.dateTo) {
            query += ` AND h.timestamp <= ?`;
            params.push(filter.dateTo);
        }
        query += ` GROUP BY h.id ORDER BY h.timestamp DESC LIMIT 500`;
        const rows = this.queryAll(query, params);
        return rows.map((row) => this.mapRow(row));
    }
    delete(id) {
        this.execute('DELETE FROM tags WHERE history_id = ?', [id]);
        this.execute('DELETE FROM history WHERE id = ?', [id]);
        this.saveToDisk();
    }
    addTag(id, tag) {
        this.execute('INSERT OR IGNORE INTO tags (history_id, tag) VALUES (?, ?)', [id, tag]);
        this.saveToDisk();
    }
    removeTag(id, tag) {
        this.execute('DELETE FROM tags WHERE history_id = ? AND tag = ?', [id, tag]);
        this.saveToDisk();
    }
    getById(id) {
        const row = this.queryOne(`
      SELECT h.*, GROUP_CONCAT(t.tag) as tags_str
      FROM history h
      LEFT JOIN tags t ON h.id = t.history_id
      WHERE h.id = ?
      GROUP BY h.id
    `, [id]);
        if (!row)
            return null;
        return this.mapRow(row);
    }
    close() {
        if (this.saveTimer)
            clearTimeout(this.saveTimer);
        this.saveNow();
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
exports.HistoryService = HistoryService;
