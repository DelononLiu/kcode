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

export interface KCodeConfig {
  agentName?: string;
  agentArgs?: string[];
  agentPath?: string;
  provider?: Record<string, ProviderConfig>;
  log?: LogConfig;
  github?: GitHubConfig;
  ui?: UIConfig;
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
  project: ['.kilo', CONFIG_FILENAME],
};
