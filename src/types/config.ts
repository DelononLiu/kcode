export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface LogConfig {
  acpLogEnabled: boolean;
  acpLogMaxGlobal: number;
  acpLogMaxTask: number;
}

export interface GitHubConfig {
  token?: string;
}

export interface UIConfig {
  language?: string;
  layout?: 'auto' | 'stretch';
}

export interface SavedDevice {
  name: string;
  type: 'ssh' | 'telnet' | 'adb' | 'local';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface KCodeConfig {
  agentName?: string;
  agentArgs?: string[];
  agentPath?: string;
  provider?: Record<string, ProviderConfig>;
  log?: LogConfig;
  github?: GitHubConfig;
  ui?: UIConfig;
  devices?: SavedDevice[];
}

export function getDefaultConfig(): KCodeConfig {
  return {
    agentName: '',
    agentArgs: [],
    agentPath: '',
    provider: {
      openai: {
        apiKey: '',
        model: 'deepseek-v4-flash',
        baseUrl: 'https://api.deepseek.com',
      },
    },
    log: {
      acpLogEnabled: false,
      acpLogMaxGlobal: 5000,
      acpLogMaxTask: 2000,
    },
    github: {
      token: '',
    },
    ui: {
      layout: 'auto',
    },
  };
}

export const CONFIG_FILENAME = 'kcode.jsonc';

export const CONFIG_FILE_PATHS = {
  global: ['.config', 'kcode', CONFIG_FILENAME],
  project: ['.kcode', CONFIG_FILENAME],
};

// 项目作用域的 key（白名单），其余 key 归全局文件
export const KNOWN_KEYS = [
  'agentName', 'agentArgs', 'agentPath',
  'provider.openai.apiKey', 'provider.openai.model', 'provider.openai.baseUrl',
  'log.acpLogEnabled', 'log.acpLogMaxGlobal', 'log.acpLogMaxTask',
  'github.token',
  'ui.language', 'ui.layout',
  'devices',
] as const;

export type KnownKey = typeof KNOWN_KEYS[number];

export const PROJECT_SCOPED_KEYS: ReadonlySet<KnownKey> = new Set([
  'agentName',
  'agentArgs',
  'agentPath',
  'provider.openai.apiKey',
  'provider.openai.model',
  'provider.openai.baseUrl',
]);

export function getNested(obj: Record<string, any>, parts: string[]): any {
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setNested(obj: Record<string, any>, parts: string[], value: any): void {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// 把完整配置按 scope 拆成 global / project 两份
export function splitConfigByScope(full: KCodeConfig): { global: KCodeConfig; project: KCodeConfig } {
  const globalConfig: KCodeConfig = {};
  const projectConfig: KCodeConfig = {};

  for (const keyPath of KNOWN_KEYS) {
    const parts = keyPath.split('.');
    const value = getNested(full as Record<string, any>, parts);
    if (value === undefined) continue;
    if (PROJECT_SCOPED_KEYS.has(keyPath)) {
      setNested(projectConfig as Record<string, any>, parts, value);
    } else {
      setNested(globalConfig as Record<string, any>, parts, value);
    }
  }

  return { global: globalConfig, project: projectConfig };
}
