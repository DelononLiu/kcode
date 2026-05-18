export interface KCodeCommand {
  name: string;
  description: string;
  type: 'kilo' | 'opencode' | 'builtin';
  body?: string;
}

export type SlashHandler = (args: string, taskId?: string) => Promise<void> | void;
