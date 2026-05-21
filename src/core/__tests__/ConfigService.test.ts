import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '../ConfigService';

const { mockFs, configStore } = vi.hoisted(() => {
    const fs = new Map<string, Uint8Array>();
    const store: Record<string, any> = {};
    return { mockFs: fs, configStore: store };
});

vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: vi.fn((section: string) => ({
            get: (key: string, defaultValue?: any) => {
                const val = configStore[`${section}.${key}`];
                return val !== undefined ? val : defaultValue;
            },
            keys: () => Object.keys(configStore).filter(k => k.startsWith(section + '.')),
        })),
        fs: {
            readFile: vi.fn((uri: { fsPath: string }) => {
                const data = mockFs.get(uri.fsPath);
                if (!data) return Promise.reject(new Error('ENOENT'));
                return Promise.resolve(data);
            }),
            writeFile: vi.fn((uri: { fsPath: string }, content: Uint8Array) => {
                mockFs.set(uri.fsPath, content);
                return Promise.resolve();
            }),
            createDirectory: vi.fn(() => Promise.resolve()),
            stat: vi.fn((uri: { fsPath: string }) => {
                if (mockFs.has(uri.fsPath)) {
                    return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 0 });
                }
                return Promise.reject(new Error('ENOENT'));
            }),
        },
        workspaceFolders: [{ uri: { fsPath: '/test-workspace', scheme: 'file', path: '/test-workspace' } }],
        createFileSystemWatcher: vi.fn(() => ({
            onDidChange: vi.fn(),
            onDidCreate: vi.fn(),
            dispose: vi.fn(),
        })),
        RelativePattern: vi.fn((base: string, pattern: string) => ({ base, pattern })),
    },
    Uri: { file: (path: string) => ({ fsPath: path, scheme: 'file', path }) },
    Disposable: class { dispose() {} },
}));

vi.mock('os', () => ({ homedir: () => '/fake-home' }));

const enc = (s: string): Buffer => Buffer.from(s, 'utf-8');

const GLOBAL_PATH = '/fake-home/.kcode/kcode.jsonc';
const PROJECT_PATH = '/test-workspace/.kcode/kcode.jsonc';

beforeEach(() => {
    mockFs.clear();
    Object.keys(configStore).forEach(k => delete configStore[k]);
    vi.clearAllMocks();
});

afterEach(() => {
    (ConfigService as any)['_instance'] = undefined;
});

describe('ConfigService', () => {
    describe('基础操作', () => {
        it('load() 返回默认配置', async () => {
            const svc = new ConfigService('/test-workspace');
            const cfg = await svc.load();
            expect(cfg.agentName).toBe('');
            expect(cfg.provider?.openai?.model).toBe('deepseek-v4-flash');
            expect(cfg.log?.acpLogEnabled).toBe(false);
        });

        it('load() 读取全局配置文件', async () => {
            mockFs.set(GLOBAL_PATH, enc(JSON.stringify({
                log: { acpLogEnabled: true, acpLogMaxGlobal: 9999, acpLogMaxTask: 500 },
            })));
            const svc = new ConfigService('/test-workspace');
            const cfg = await svc.load();
            expect(cfg.log?.acpLogEnabled).toBe(true);
            expect(cfg.log?.acpLogMaxGlobal).toBe(9999);
        });

        it('load() 项目文件覆盖全局', async () => {
            mockFs.set(GLOBAL_PATH, enc(JSON.stringify({
                agentName: 'global-agent',
                log: { acpLogEnabled: true, acpLogMaxGlobal: 9999, acpLogMaxTask: 500 },
            })));
            mockFs.set(PROJECT_PATH, enc(JSON.stringify({ agentName: 'project-agent' })));
            const svc = new ConfigService('/test-workspace');
            const cfg = await svc.load();
            expect(cfg.agentName).toBe('project-agent');
            expect(cfg.log?.acpLogEnabled).toBe(true);
        });

        it('load() 读取 JSONC（含注释）', async () => {
            mockFs.set(GLOBAL_PATH, enc('{ /* comment */ "agentName": "openai" }'));
            const svc = new ConfigService('/test-workspace');
            const cfg = await svc.load();
            expect(cfg.agentName).toBe('openai');
        });

        it('load() 损坏文件回退默认值', async () => {
            mockFs.set(GLOBAL_PATH, enc('{bad json}'));
            const svc = new ConfigService('/test-workspace');
            const cfg = await svc.load();
            expect(cfg.agentName).toBe('');
        });

        it('get() 读取嵌套 key', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            expect(svc.get('provider.openai.model')).toBe('deepseek-v4-flash');
            expect(svc.get('log.acpLogEnabled')).toBe(false);
        });

        it('get() 不存在的 key 返回默认值', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            expect(svc.get('nope', 42)).toBe(42);
        });
    });

    describe('Draft/Commit', () => {
        it('set() 修改 draft 标记 dirty', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            svc.set('agentName', 'kilo');
            expect(svc.isDirty).toBe(true);
            expect(svc.draft.agentName).toBe('kilo');
            expect(svc.config.agentName).toBe('');
        });

        it('updateDraft() 批量更新', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            svc.updateDraft({ agentName: 'kilo' });
            expect(svc.isDirty).toBe(true);
        });

        it('discardDraft() 回退', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            svc.set('agentName', 'kilo');
            svc.discardDraft();
            expect(svc.isDirty).toBe(false);
            expect(svc.draft.agentName).toBe('');
        });

        it('save() 拆分写入全局 + 项目文件', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            // 预先创建项目配置文件，模拟已有项目配置
            mockFs.set(PROJECT_PATH, enc('{}'));
            svc.set('agentName', 'my-agent');
            svc.set('log.acpLogEnabled', true);
            await svc.save();
            expect(svc.isDirty).toBe(false);
            expect(svc.config.agentName).toBe('my-agent');
            expect(svc.config.log?.acpLogEnabled).toBe(true);

            const projectRaw = mockFs.get(PROJECT_PATH)!;
            expect(projectRaw).toBeDefined();
            const projectParsed = JSON.parse(Buffer.from(projectRaw).toString());
            expect(projectParsed.agentName).toBe('my-agent');
            expect(projectParsed.log).toBeUndefined();

            const globalRaw = mockFs.get(GLOBAL_PATH)!;
            expect(globalRaw).toBeDefined();
            const globalParsed = JSON.parse(Buffer.from(globalRaw).toString());
            expect(globalParsed.log?.acpLogEnabled).toBe(true);
            expect(globalParsed.agentName).toBe('my-agent');
        });

        it('save() 无项目文件时只写全局', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            svc.set('agentName', 'only-global');
            await svc.save();
            // 项目文件不存在 → 不创建
            expect(mockFs.has(PROJECT_PATH)).toBe(false);
            // 全局文件应有完整配置
            const globalRaw = mockFs.get(GLOBAL_PATH)!;
            expect(globalRaw).toBeDefined();
            const globalParsed = JSON.parse(Buffer.from(globalRaw).toString());
            expect(globalParsed.agentName).toBe('only-global');
        });
    });

    describe('导入/导出', () => {
        it('exportConfig() 返回 JSON', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            svc.set('agentName', 'kilo');
            const json = await svc.exportConfig();
            const parsed = JSON.parse(json);
            expect(parsed._meta.version).toBe(1);
            expect(parsed.agentName).toBe('kilo');
        });

        it('importConfig() 有效导入', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            const r = await svc.importConfig(JSON.stringify({ agentName: 'openai' }));
            expect(r.ok).toBe(true);
            expect(svc.draft.agentName).toBe('openai');
        });

        it('importConfig() 损坏 JSON 报错', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            const r = await svc.importConfig('bad json');
            expect(r.ok).toBe(false);
        });
    });

    describe('文件变化与通知', () => {
        it('外部变化自动重载（非 dirty）', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            mockFs.set(GLOBAL_PATH, enc(JSON.stringify({ agentName: 'external' })));
            await (svc as any)._onFileChanged();
            expect(svc.config.agentName).toBe('external');
        });

        it('dirty 时不覆盖', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            svc.set('agentName', 'unsaved');
            mockFs.set(GLOBAL_PATH, enc(JSON.stringify({ agentName: 'external' })));
            await (svc as any)._onFileChanged();
            expect(svc.config.agentName).toBe('');
            expect(svc.draft.agentName).toBe('unsaved');
        });

        it('onDidChange 触发', async () => {
            const svc = new ConfigService('/test-workspace');
            await svc.load();
            const fn = vi.fn();
            svc.onDidChange(fn);
            svc.set('agentName', 'kilo');
            await svc.save();
            expect(fn).toHaveBeenCalledWith(expect.objectContaining({ agentName: 'kilo' }));
        });
    });

    describe('Singleton', () => {
        it('getInstance / setInstance', () => {
            const svc = new ConfigService();
            ConfigService.setInstance(svc);
            expect(ConfigService.getInstance()).toBe(svc);
        });
    });

    describe('项目文件自动发现', () => {
        it('无项目文件时使用默认路径', async () => {
            const svc = new ConfigService('/test-workspace');
            const found = await (svc as any)._findProjectConfigPath();
            expect(found).toBeUndefined();

            const created = await (svc as any)._findOrCreateProjectPath();
            expect(created).toBe(PROJECT_PATH);
        });

        it('向上遍历发现已有 .kcode/kcode.jsonc', async () => {
            // workspaceFolders mock returns /test-workspace
            // traversal: /test-workspace → / → stop
            // Place config at root /.kcode/kcode.jsonc to test upward traversal
            const rootPath = '/.kcode/kcode.jsonc';
            mockFs.set(rootPath, enc(JSON.stringify({ agentName: 'root-cfg' })));
            const svc = new ConfigService('/test-workspace');
            const found = await (svc as any)._findProjectConfigPath();
            expect(found).toBe(rootPath);

            const cfg = await svc.load();
            expect(cfg.agentName).toBe('root-cfg');
        });
    });

    describe('环境变量覆盖', () => {
        const OLD_ENV = process.env;

        beforeEach(() => {
            process.env = { ...OLD_ENV };
        });

        afterEach(() => {
            process.env = OLD_ENV;
        });

        it('环境变量覆盖文件和默认值', async () => {
            process.env['OPENAI_API_KEY'] = 'env-key';
            process.env['OPENAI_MODEL'] = 'env-model';
            process.env['OPENAI_BASE_URL'] = 'https://env.url';

            mockFs.set(GLOBAL_PATH, enc(JSON.stringify({
                provider: { openai: { apiKey: 'file-key', model: 'file-model' } },
            })));

            const svc = new ConfigService('/test-workspace');
            const cfg = await svc.load();
            expect(cfg.provider?.openai?.apiKey).toBe('env-key');
            expect(cfg.provider?.openai?.model).toBe('env-model');
            expect(cfg.provider?.openai?.baseUrl).toBe('https://env.url');
        });
    });
});
