import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

const mockFiles: Record<string, string> = {};

vi.mock('fs', () => ({
  existsSync: vi.fn((p: string) => p in mockFiles || Object.keys(mockFiles).some(k => k.startsWith(p))),
  readdirSync: vi.fn((dir: string) => {
    return Object.keys(mockFiles)
      .filter(k => path.dirname(k) === dir)
      .map(k => path.basename(k));
  }),
  readFileSync: vi.fn((p: string) => {
    if (mockFiles[p] !== undefined) return mockFiles[p];
    throw new Error(`ENOENT: ${p}`);
  }),
}));

import { loadKiloCommands } from '../CommandLoader';

function addMock(root: string, name: string, content: string) {
  mockFiles[path.join(root, '.kilo', 'commands', name)] = content;
}

function addOpenCodeMock(root: string, name: string, content: string) {
  mockFiles[path.join(root, '.opencode', 'commands', name)] = content;
}

describe('CommandLoader', () => {
  beforeEach(() => {
    Object.keys(mockFiles).forEach(k => delete mockFiles[k]);
  });

  it('workspaceRoot 为空时返回空数组', () => {
    expect(loadKiloCommands()).toEqual([]);
    expect(loadKiloCommands('')).toEqual([]);
  });

  it('无命令目录时返回空数组', () => {
    expect(loadKiloCommands('/fake')).toEqual([]);
  });

  it('解析 .kilo/commands/ 中的 markdown 文件', () => {
    addMock('/root', 'gci.md', `---
description: 分析改动并提交 git commit
---

执行流程说明...`);
    addMock('/root', 'tasks.md', `---
description: 查看任务完成状态
---

分析所有任务并输出概览。`);

    const cmds = loadKiloCommands('/root');
    expect(cmds).toHaveLength(2);
    expect(cmds[0]).toEqual({ name: 'gci', description: '分析改动并提交 git commit', type: 'kilo', body: '执行流程说明...' });
    expect(cmds[1]).toEqual({ name: 'tasks', description: '查看任务完成状态', type: 'kilo', body: '分析所有任务并输出概览。' });
  });

  it('解析 .opencode/commands/ 文件', () => {
    addOpenCodeMock('/root', 'test.md', `---
description: 运行测试
---

运行 npm test`);
    const cmds = loadKiloCommands('/root');
    expect(cmds).toHaveLength(1);
    expect(cmds[0].type).toBe('opencode');
    expect(cmds[0].name).toBe('test');
  });

  it('无 frontmatter 的文件跳过', () => {
    addMock('/root', 'plain.md', '没有 frontmatter 的纯文本');
    const cmds = loadKiloCommands('/root');
    expect(cmds).toHaveLength(0);
  });

  it('无 description 时使用 name 作为 fallback', () => {
    addMock('/root', 'foo.md', `---
other: value
---

body`);
    const cmds = loadKiloCommands('/root');
    expect(cmds).toHaveLength(1);
    expect(cmds[0].description).toBe('foo');
  });

  it('仅扫描 .md 文件，忽略非 md', () => {
    addMock('/root', 'script.sh', `---
description: script
---
code`);
    addMock('/root', 'readme.txt', `plain text`);
    const cmds = loadKiloCommands('/root');
    expect(cmds).toHaveLength(0);
  });

  it('文件读取失败时静默跳过', () => {
    addMock('/root', 'good.md', `---
description: good
---
ok`);
    const cmds = loadKiloCommands('/root');
    expect(cmds).toHaveLength(1);
    expect(cmds[0].name).toBe('good');
  });

  it('同时加载 .kilo 和 .opencode 两个目录', () => {
    addMock('/root', 'kilo-cmd.md', `---
description: kilo command
---
kilo`);
    addOpenCodeMock('/root', 'opencode-cmd.md', `---
description: opencode command
---
opencode`);
    const cmds = loadKiloCommands('/root');
    expect(cmds).toHaveLength(2);
    expect(cmds.map(c => c.type).sort()).toEqual(['kilo', 'opencode']);
  });
});
