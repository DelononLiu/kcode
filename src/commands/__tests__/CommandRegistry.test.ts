import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandRegistry } from '../CommandRegistry';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('registerSlashCommand', () => {
    it('注册和路由斜杠命令', async () => {
      const handler = vi.fn();
      registry.registerSlashCommand('/test', '测试命令', handler);

      const ok = await registry.handleSlash('/test arg1');
      expect(ok).toBe(true);
      expect(handler).toHaveBeenCalledWith('arg1', undefined);
    });

    it('命令名不区分大小写', async () => {
      const handler = vi.fn();
      registry.registerSlashCommand('/Test', '测试', handler);

      await registry.handleSlash('/test');
      await registry.handleSlash('/TEST');
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('未注册的命令返回 false', async () => {
      const ok = await registry.handleSlash('/unknown');
      expect(ok).toBe(false);
    });

    it('传递 taskId 到 handler', async () => {
      const handler = vi.fn();
      registry.registerSlashCommand('/tasks', '查看任务', handler);

      await registry.handleSlash('/tasks', 'task-123');
      expect(handler).toHaveBeenCalledWith('', 'task-123');
    });

    it('多参数正确拆分', async () => {
      const handler = vi.fn();
      registry.registerSlashCommand('/reject', '驳回', handler);

      await registry.handleSlash('/reject 代码不够简洁');
      expect(handler).toHaveBeenCalledWith('代码不够简洁', undefined);
    });
  });

  describe('getPromptInjection', () => {
    it('无命令时返回空字符串', () => {
      expect(registry.getPromptInjection()).toBe('');
    });

    it('有命令时生成格式化的提示词片段', async () => {
      await registry.load('/root');
      const result = registry.getPromptInjection();
      expect(result).toBe('');
    });
  });

  describe('getSlashHelp', () => {
    it('空注册返回仅标题', () => {
      const help = registry.getSlashHelp();
      expect(help).toBe('可用命令：');
    });

    it('列出已注册命令', () => {
      registry.registerSlashCommand('/test', '测试命令', vi.fn());
      registry.registerSlashCommand('/tasks', '查看任务', vi.fn(), '/tasks [filter]');

      const help = registry.getSlashHelp();
      expect(help).toContain('/test');
      expect(help).toContain('/tasks [filter]');
      expect(help).toContain('测试命令');
    });
  });

  describe('load kilo commands', () => {
    it('load 调用后填充 kiloCommands', async () => {
      await registry.load(undefined);
      expect(registry.getKiloCommands()).toEqual([]);
    });
  });
});
