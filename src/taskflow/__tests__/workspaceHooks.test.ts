import { describe, it, expect } from 'vitest';
import { parseWorkspaceHooks } from '../workspaceHooks';

describe('parseWorkspaceHooks', () => {
    it('空内容返回空对象', () => {
        expect(parseWorkspaceHooks('')).toEqual({});
    });

    it('单个阶段提取钩子命令（列表格式）', () => {
        const md = `## kcode-hooks:execute\n- 运行 npm test\n- 检查类型`;
        expect(parseWorkspaceHooks(md)).toEqual({
            execute: ['运行 npm test', '检查类型'],
        });
    });

    it('多个阶段提取', () => {
        const md = `## kcode-hooks:execute\n- npm test\n\n## kcode-hooks:self_verify\n- npm run lint`;
        expect(parseWorkspaceHooks(md)).toEqual({
            execute: ['npm test'],
            self_verify: ['npm run lint'],
        });
    });

    it('纯文本格式（非列表）也支持', () => {
        const md = `## kcode-hooks:plan\n查看当前时间 date`;
        expect(parseWorkspaceHooks(md)).toEqual({
            plan: ['查看当前时间 date'],
        });
    });

    it('跳过空行和注释', () => {
        const md = `## kcode-hooks:execute\n  \n- npm test\n\n- lint`;
        expect(parseWorkspaceHooks(md)).toEqual({
            execute: ['npm test', 'lint'],
        });
    });

    it('不匹配的 section 名不包含', () => {
        const md = `# AGENTS.md\n\n## kcode-hooks:execute\n- npm test`;
        expect(parseWorkspaceHooks(md)).toEqual({
            execute: ['npm test'],
        });
    });

    it('无 hooks 内容时返回空', () => {
        const md = `# 普通文档\n没有 hooks 定义`;
        expect(parseWorkspaceHooks(md)).toEqual({});
    });
});
