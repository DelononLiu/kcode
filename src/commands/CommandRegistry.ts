import type { KCodeCommand, SlashHandler } from './types';
import { loadKiloCommands } from './CommandLoader';

export class CommandRegistry {
  private kiloCommands: KCodeCommand[] = [];
  private slashHandlers = new Map<string, { description: string; usage?: string; handler: SlashHandler }>();

  async load(workspaceRoot?: string): Promise<void> {
    this.kiloCommands = loadKiloCommands(workspaceRoot);
  }

  registerSlashCommand(name: string, description: string, handler: SlashHandler, usage?: string): void {
    this.slashHandlers.set(name.toLowerCase(), { description, usage, handler });
  }

  getKiloCommands(): KCodeCommand[] {
    return this.kiloCommands;
  }

  getPromptInjection(): string {
    if (this.kiloCommands.length === 0) return '';
    const lines = ['## 可用的命令流程', '', '系统支持以下预定义命令流程，你可以在适当时调用：'];
    for (const cmd of this.kiloCommands) {
      lines.push(`- \`${cmd.name}\` — ${cmd.description}`);
    }
    return lines.join('\n');
  }

  getSlashHelp(): string {
    const lines = ['可用命令：'];
    for (const [name, info] of this.slashHandlers) {
      const usage = info.usage || `/${name}`;
      lines.push(`- ${usage} — ${info.description}`);
    }
    return lines.join('\n');
  }

  async handleSlash(input: string, taskId?: string): Promise<boolean> {
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    const handler = this.slashHandlers.get(cmd);
    if (handler) {
      await handler.handler(args, taskId);
      return true;
    }
    return false;
  }
}
