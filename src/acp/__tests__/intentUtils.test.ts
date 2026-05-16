import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../intentUtils';

describe('classifyIntent', () => {
    it('空文本返回 chat', () => {
        expect(classifyIntent('')).toBe('chat');
        expect(classifyIntent('   ')).toBe('chat');
    });

    it('任务动词开头返回 task', () => {
        expect(classifyIntent('实现用户登录')).toBe('task');
        expect(classifyIntent('修复登录bug')).toBe('task');
        expect(classifyIntent('添加新功能')).toBe('task');
        expect(classifyIntent('重构UserService')).toBe('task');
    });

    it('implement/create 等英文动词返回 task', () => {
        expect(classifyIntent('Implement login')).toBe('task');
        expect(classifyIntent('Create user API')).toBe('task');
        expect(classifyIntent('Fix the bug')).toBe('task');
    });

    it('"请/帮我" 开头返回 task', () => {
        expect(classifyIntent('请实现登录功能')).toBe('task');
        expect(classifyIntent('帮我写一个排序算法')).toBe('task');
    });

    it('问候语返回 chat', () => {
        expect(classifyIntent('你好')).toBe('chat');
        expect(classifyIntent('hello')).toBe('chat');
        expect(classifyIntent('hi')).toBe('chat');
    });

    it('你是谁/能力询问返回 chat', () => {
        expect(classifyIntent('你是谁')).toBe('chat');
        expect(classifyIntent('你能做什么')).toBe('chat');
    });

    it('普通文本默认返回 chat', () => {
        expect(classifyIntent('今天天气不错')).toBe('chat');
    });
});
