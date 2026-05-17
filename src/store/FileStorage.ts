import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

let _logFileStorage: (msg: string) => void = () => {};

export function setFileStorageLogger(log: (msg: string) => void): void {
    _logFileStorage = log;
}

export class FileStorage {
    private data: Record<string, any> = {};
    private filePath: string;

    constructor(workspacePath?: string) {
        const homeDir = os.homedir();
        const kcodeDir = path.join(homeDir, '.local', 'share', 'kcode');
        const wsHash = workspacePath
            ? crypto.createHash('md5').update(workspacePath).digest('hex').slice(0, 12)
            : 'default';
        this.filePath = path.join(kcodeDir, `${wsHash}.json`);
        _logFileStorage(`[FileStorage] path=${this.filePath} workspacePath=${workspacePath}`);
        fs.mkdirSync(kcodeDir, { recursive: true });
        this.load();
    }

    private load(): void {
        try {
            if (fs.existsSync(this.filePath)) {
                const content = fs.readFileSync(this.filePath, 'utf-8');
                const parsed = JSON.parse(content);
                this.data = parsed.data || {};
                _logFileStorage(`[FileStorage] loaded ${Object.keys(this.data).length} keys from file`);
            } else {
                _logFileStorage(`[FileStorage] no file at ${this.filePath}, starting fresh`);
            }
        } catch (e) {
            _logFileStorage(`[FileStorage] Failed to load: ${e}`);
        }
    }

    private save(): void {
        try {
            const content = JSON.stringify({ data: this.data, meta: { lastModified: Date.now(), version: 1 } }, null, 2);
            fs.writeFileSync(this.filePath, content, 'utf-8');
            _logFileStorage(`[FileStorage] saved to ${this.filePath} (${content.length} bytes)`);
        } catch (e) {
            _logFileStorage(`[FileStorage] Failed to save: ${e}`);
        }
    }

    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    get<T>(key: string, defaultValue?: T): T | undefined {
        if (key in this.data) return this.data[key] as T;
        return defaultValue;
    }

    update(key: string, value: any): Thenable<void> {
        if (value === undefined) {
            delete this.data[key];
        } else {
            this.data[key] = value;
        }
        this.save();
        return Promise.resolve();
    }

    keys(): readonly string[] {
        return Object.keys(this.data);
    }

    setAll(data: Record<string, any>): void {
        this.data = { ...data };
        this.save();
    }

    getAll(): Record<string, any> {
        return { ...this.data };
    }

    migrateFromMemento(memento: { get: (key: string) => any; keys: () => readonly string[] }): void {
        if (Object.keys(this.data).length > 0) return;
        const keys = memento.keys();
        if (keys.length === 0) return;
        for (const key of keys) {
            const val = memento.get(key);
            if (val !== undefined) {
                this.data[key] = val;
            }
        }
        this.save();
        console.log(`[FileStorage] Migrated ${keys.length} keys from workspaceState`);
    }
}
