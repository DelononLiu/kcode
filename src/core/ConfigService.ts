import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import {
  parse,
  modify,
  applyEdits,
  findNodeAtLocation,
  JSONPath,
  ModificationOptions,
} from 'jsonc-parser';
import {
  KCodeConfig,
  getDefaultConfig,
  CONFIG_FILENAME,
  CONFIG_FILE_PATHS,
} from '../types/config';

const MIGRATED_MARKER_KEY = 'kcode.configMigrated';

type ConfigListener = (config: KCodeConfig) => void;

export class ConfigService {
  private static _instance: ConfigService | undefined;

  static getInstance(): ConfigService {
    if (!ConfigService._instance) {
      ConfigService._instance = new ConfigService();
    }
    return ConfigService._instance;
  }

  static setInstance(instance: ConfigService): void {
    ConfigService._instance = instance;
  }

  private _config: KCodeConfig = getDefaultConfig();
  private _draft: KCodeConfig = {};
  private _isDirty = false;
  private _globalPath: string;
  private _projectPath: string | undefined;
  private _watcher: vscode.FileSystemWatcher | undefined;
  private _disposables: vscode.Disposable[] = [];
  private _listeners: ConfigListener[] = [];

  constructor(workspaceRoot?: string) {
    const xdg = process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
    this._globalPath = path.join(xdg, 'kcode', CONFIG_FILENAME);
    if (workspaceRoot) {
      this._projectPath = path.join(workspaceRoot, '.kilo', CONFIG_FILENAME);
    }
  }

  get config(): KCodeConfig {
    return { ...this._config };
  }

  get draft(): KCodeConfig {
    return { ...this._draft };
  }

  get isDirty(): boolean {
    return this._isDirty;
  }

  get globalPath(): string {
    return this._globalPath;
  }

  get projectPath(): string | undefined {
    return this._projectPath;
  }

  onDidChange(listener: ConfigListener): vscode.Disposable {
    this._listeners.push(listener);
    return { dispose: () => {
      const i = this._listeners.indexOf(listener);
      if (i >= 0) this._listeners.splice(i, 1);
    }};
  }

  async load(): Promise<KCodeConfig> {
    let globalConfig = await this._readFile(this._globalPath);
    let projectConfig: KCodeConfig = {};
    if (this._projectPath) {
      projectConfig = await this._readFile(this._projectPath);
    }
    if (!globalConfig || Object.keys(globalConfig).length === 0) {
      globalConfig = await this._migrateFromVSCode();
    }
    this._config = this._merge(getDefaultConfig(), globalConfig, projectConfig);
    this._draft = { ...this._config };
    this._isDirty = false;
    this._notify();
    return this._config;
  }

  private async _migrateFromVSCode(): Promise<KCodeConfig> {
    try {
      const vscCfg = vscode.workspace.getConfiguration('kcode');
      const hasAny = vscCfg.keys?.()?.length > 0;
      if (!hasAny) return {};

      const migrated: KCodeConfig = {
        agentName: vscCfg.get<string>('agentName') || undefined,
        agentArgs: vscCfg.get<string[]>('agentArgs') || undefined,
        agentPath: vscCfg.get<string>('agentPath') || undefined,
        provider: {
          openai: {
            apiKey: vscCfg.get<string>('openaiApiKey') || undefined,
            model: vscCfg.get<string>('openaiModel') || undefined,
            baseUrl: vscCfg.get<string>('openaiBaseUrl') || undefined,
          },
        },
        log: {
          acpLogEnabled: vscCfg.get<boolean>('acpLogEnabled', false),
          acpLogMaxGlobal: vscCfg.get<number>('acpLogMaxGlobal', 5000),
          acpLogMaxTask: vscCfg.get<number>('acpLogMaxTask', 2000),
        },
        github: {
          token: vscCfg.get<string>('githubToken') || undefined,
        },
      };

      const hasValues = Object.values(migrated).some(v => v !== undefined && v !== null && !(typeof v === 'object' && Object.keys(v).length === 0));
      if (!hasValues) return {};

      await this._writeFile(this._globalPath, migrated);
      return migrated;
    } catch (e) {
      console.warn('[ConfigService] Migration failed:', e);
      return {};
    }
  }

  get<T>(key: string, defaultValue?: T): T {
    const parts = key.split('.');
    let obj: any = this._draft;
    for (const part of parts) {
      if (obj == null || typeof obj !== 'object') return defaultValue as T;
      obj = obj[part];
    }
    return (obj !== undefined ? obj : defaultValue) as T;
  }

  set(key: string, value: any): void {
    this._setNested(this._draft, key.split('.'), value);
    this._isDirty = true;
  }

  updateDraft(patch: Partial<KCodeConfig>): void {
    this._draft = this._merge({}, this._draft, patch);
    this._isDirty = true;
  }

  discardDraft(): void {
    this._draft = { ...this._config };
    this._isDirty = false;
  }

  async save(): Promise<void> {
    const merged = this._merge({}, this._config, this._draft);
    await this._writeFile(this._projectPath || this._globalPath, merged);
    this._config = merged;
    this._draft = { ...merged };
    this._isDirty = false;
    this._notify();
  }

  async saveTo(filePath: string): Promise<void> {
    const merged = this._merge({}, this._config, this._draft);
    await this._writeFile(filePath, merged);
  }

  startWatch(context: vscode.ExtensionContext): void {
    const patterns = [
      new vscode.RelativePattern(path.dirname(this._globalPath), CONFIG_FILENAME),
    ];
    if (this._projectPath) {
      patterns.push(
        new vscode.RelativePattern(path.dirname(this._projectPath), CONFIG_FILENAME)
      );
    }
    for (const pattern of patterns) {
      const w = vscode.workspace.createFileSystemWatcher(pattern);
      w.onDidChange(() => this._onFileChanged());
      w.onDidCreate(() => this._onFileChanged());
      context.subscriptions.push(w);
    }
  }

  async exportConfig(): Promise<string> {
    const merged = this._merge({}, this._config, this._draft);
    const exportObj = {
      _meta: {
        version: 1,
        exportedAt: new Date().toISOString(),
        source: 'kcode',
      },
      ...merged,
    };
    return JSON.stringify(exportObj, null, 2);
  }

  async importConfig(json: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: '配置格式无效：期望一个 JSON 对象' };
      }
      const knownKeys = new Set([
        'agentName', 'agentArgs', 'agentPath', 'provider', 'log',
        'github', 'ui', '_meta',
      ]);
      for (const key of Object.keys(parsed)) {
        if (!knownKeys.has(key) && key !== '_meta') {
          return { ok: false, error: `未知配置项: ${key}` };
        }
      }
      const { _meta, ...config } = parsed;
      this.updateDraft(config as Partial<KCodeConfig>);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `JSON 解析失败: ${(e as Error).message}` };
    }
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener(this._config);
    }
  }

  private async _onFileChanged(): Promise<void> {
    if (!this._isDirty) {
      await this.load();
    }
  }

  private async _readFile(filePath: string): Promise<KCodeConfig> {
    try {
      const uri = vscode.Uri.file(filePath);
      const content = (await vscode.workspace.fs.readFile(uri)).toString();
      const errors: any[] = [];
      const parsed = parse(content, errors, { allowTrailingComma: true });
      if (errors.length > 0) {
        console.warn(`[ConfigService] JSONC parse errors in ${filePath}:`, errors);
      }
      return parsed || {};
    } catch {
      return {};
    }
  }

  private async _writeFile(filePath: string, config: KCodeConfig): Promise<void> {
    const dir = path.dirname(filePath);
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
    } catch {}
    let existing = '';
    try {
      existing = (await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))).toString();
    } catch {}

    const jsonPath = (key: string): JSONPath => key.split('.');
    const modOpts: ModificationOptions = { formattingOptions: { insertSpaces: true, tabSize: 2 } };

    const knownKeys = [
      'agentName', 'agentArgs', 'agentPath',
      'provider.openai.apiKey', 'provider.openai.model', 'provider.openai.baseUrl',
      'log.acpLogEnabled', 'log.acpLogMaxGlobal', 'log.acpLogMaxTask',
      'github.token',
      'ui.language', 'ui.layout',
    ];

    for (const key of knownKeys) {
      const value = this._getNested(config, key.split('.'));
      if (value !== undefined) {
        const edits = modify(existing, jsonPath(key), value, modOpts);
        existing = applyEdits(existing, edits);
      }
    }

    await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(existing));
  }

  private _getNested(obj: any, parts: string[]): any {
    let current = obj;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  }

  private _setNested(obj: any, parts: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  private _merge(...sources: KCodeConfig[]): KCodeConfig {
    const result: any = {};
    for (const source of sources) {
      if (!source) continue;
      for (const key of Object.keys(source)) {
        const val = (source as any)[key];
        if (val !== null && val !== undefined) {
          if (typeof val === 'object' && !Array.isArray(val)) {
            result[key] = this._merge(result[key] || {}, val);
          } else {
            result[key] = val;
          }
        }
      }
    }
    return result as KCodeConfig;
  }
}
