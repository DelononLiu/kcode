import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
    window: {
        createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
        showInputBox: vi.fn(),
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        withProgress: vi.fn(),
    },
    workspace: {
        getConfiguration: vi.fn(() => ({ get: vi.fn() })),
    },
}));

import { parseGitHubUrl } from '../importGitHubIssue';

describe('parseGitHubUrl', () => {
    it('解析完整 GitHub Issue URL', () => {
        const result = parseGitHubUrl('https://github.com/owner/repo/issues/123');
        expect(result).toEqual({ owner: 'owner', repo: 'repo', issueNumber: 123 });
    });

    it('解析短格式 owner/repo#123', () => {
        const result = parseGitHubUrl('owner/repo#456');
        expect(result).toEqual({ owner: 'owner', repo: 'repo', issueNumber: 456 });
    });

    it('解析带中文的 URL', () => {
        const result = parseGitHubUrl('https://github.com/测试/项目/issues/1');
        expect(result).toEqual({ owner: '测试', repo: '项目', issueNumber: 1 });
    });

    it('无效输入返回 null', () => {
        expect(parseGitHubUrl('')).toBeNull();
        expect(parseGitHubUrl('not-a-url')).toBeNull();
        expect(parseGitHubUrl('https://github.com/owner/repo')).toBeNull();
        expect(parseGitHubUrl('owner/repo')).toBeNull();
        expect(parseGitHubUrl('https://other.com/owner/repo/issues/1')).toBeNull();
    });

    it('带不同位数 issue number', () => {
        const result = parseGitHubUrl('https://github.com/a/b/issues/999999');
        expect(result?.issueNumber).toBe(999999);
    });
});
