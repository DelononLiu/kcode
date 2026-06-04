import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { modify, applyEdits, ModificationOptions } from 'jsonc-parser';

/**
 * AgentConfigManager — 集中管理 Agent 子配置文件
 *
 * 职责：
 * - 当 kcode.jsonc 中的 model 变更时，同步到三个 Agent 各自的配置文件
 * - 提供各 Agent 配置文件的路径（供 AgentService 注入环境变量 / --settings 参数）
 *
 * 目录结构：
 *   ~/.kcode/agent/
 *   ├── kilo/kilo.jsonc         ← KILO_CONFIG 指向
 *   ├── claude/settings.json    ← --settings 指向
 *   └── opencode/opencode.json  ← OPENCODE_CONFIG 指向
 */
export class AgentConfigManager {
  private static readonly AGENT_DIR = path.join(os.homedir(), '.kcode', 'agent');

  // ── 路径 getter ──────────────────────────────────────

  static getKiloConfigPath(): string {
    return path.join(this.AGENT_DIR, 'kilo', 'kilo.jsonc');
  }

  static getClaudeSettingsPath(): string {
    return path.join(this.AGENT_DIR, 'claude', 'settings.json');
  }

  static getOpenCodeConfigPath(): string {
    return path.join(this.AGENT_DIR, 'opencode', 'opencode.json');
  }

  // ── 同步入口 ─────────────────────────────────────────

  /**
   * 将指定的 model 同步到三个 Agent 配置文件。
   * 文件不存在则自动创建；已存在则仅更新 model 字段，保留原格式和注释。
   * 所有错误静默捕获，不抛出。
   */
  static async syncAll(model: string): Promise<void> {
    await Promise.all([
      this.syncKiloConfig(model),
      this.syncClaudeSettings(model),
      this.syncOpenCodeConfig(model),
    ]);
  }

  // ── 各 Agent 同步 ────────────────────────────────────

  static async syncKiloConfig(model: string): Promise<void> {
    try {
      const filePath = this.getKiloConfigPath();
      await this.ensureDir(path.dirname(filePath));
      const content = await this.readOrInit(filePath, { model });
      const updated = this.setModelField(content, model, ['model']);
      await fs.promises.writeFile(filePath, updated, 'utf-8');
    } catch (e) {
      console.warn('[AgentConfigManager] Failed to sync Kilo config:', e);
    }
  }

  static async syncClaudeSettings(model: string): Promise<void> {
    try {
      const filePath = this.getClaudeSettingsPath();
      await this.ensureDir(path.dirname(filePath));
      const content = await this.readOrInit(filePath, { model });
      const updated = this.setModelField(content, model, ['model']);
      await fs.promises.writeFile(filePath, updated, 'utf-8');
    } catch (e) {
      console.warn('[AgentConfigManager] Failed to sync Claude settings:', e);
    }
  }

  static async syncOpenCodeConfig(model: string): Promise<void> {
    try {
      const filePath = this.getOpenCodeConfigPath();
      await this.ensureDir(path.dirname(filePath));
      const content = await this.readOrInit(filePath, { model });
      const updated = this.setModelField(content, model, ['model']);
      await fs.promises.writeFile(filePath, updated, 'utf-8');
    } catch (e) {
      console.warn('[AgentConfigManager] Failed to sync OpenCode config:', e);
    }
  }

  // ── 内部工具 ─────────────────────────────────────────

  /**
   * 读取已有文件，若不存在则返回初始 JSON 字符串。
   */
  private static async readOrInit(filePath: string, defaults: Record<string, string>): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch {
      return JSON.stringify(defaults, null, 2);
    }
  }

  /**
   * 使用 jsonc-parser 修改指定 JSON 路径的值，保留原格式。
   */
  private static setModelField(json: string, value: string, pathSegments: string[]): string {
    const modOpts: ModificationOptions = {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    };
    const edits = modify(json, pathSegments, value, modOpts);
    return applyEdits(json, edits);
  }

  /**
   * 确保目录存在。
   */
  private static async ensureDir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }
}
