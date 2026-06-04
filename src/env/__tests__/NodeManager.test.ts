import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── mock 工厂 ──────────────────────────────────────────────

const mockExecFn = vi.fn();
const mockExecSyncFn = vi.fn();
const mockHttpsGet = vi.fn();
const mockExistsSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockUnlinkSync = vi.fn();
const mockCreateWriteStream = vi.fn();

vi.mock('child_process', () => ({
  exec: mockExecFn,
  execSync: mockExecSyncFn,
}));

vi.mock('https', () => ({
  get: mockHttpsGet,
}));

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  unlinkSync: mockUnlinkSync,
  createWriteStream: mockCreateWriteStream,
}));

// ── 工厂：创建一个像 fs.WriteStream 的 mock（有 .close()） ──

async function makeMockWritable() {
  const { PassThrough } = await import('stream');
  const s = new PassThrough();
  (s as any).close = vi.fn(() => { s.destroy(); });
  return s;
}

// ── 测试 ──────────────────────────────────────────────────

async function getNodeManager() {
  return await import('../NodeManager');
}

describe('NodeManager', () => {
  let NodeManager: Awaited<ReturnType<typeof getNodeManager>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    NodeManager = await getNodeManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── isSupportedPlatform ──────────────────────────────────

  describe('isSupportedPlatform', () => {
    it('returns true on linux-x64', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('x64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      expect(NodeManager.isSupportedPlatform()).toBe(true);
    });

    it('returns true on linux-arm64', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      expect(NodeManager.isSupportedPlatform()).toBe(true);
    });

    it('returns true on win32-x64', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('x64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
      expect(NodeManager.isSupportedPlatform()).toBe(true);
    });

    it('returns false on darwin-arm64', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
      expect(NodeManager.isSupportedPlatform()).toBe(false);
    });

    it('returns false on unsupported architectures', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('ia32' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      expect(NodeManager.isSupportedPlatform()).toBe(false);
    });
  });

  // ── Path helpers ─────────────────────────────────────────

  describe('getNodeBaseDir', () => {
    it('returns ~/.kcode/node/', () => {
      const expected = path.join(os.homedir(), '.kcode', 'node');
      expect(NodeManager.getNodeBaseDir()).toBe(expected);
    });
  });

  describe('getNodeBinDir', () => {
    it('returns correct bin dir on linux-x64', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('x64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      const dir = NodeManager.getNodeBinDir();
      expect(dir).toContain('.kcode/node/node-v');
      expect(dir).toContain('-linux-x64');
      expect(dir).toContain('bin');
    });

    it('returns empty string on unsupported platforms', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
      expect(NodeManager.getNodeBinDir()).toBe('');
    });
  });

  describe('getNodeExePath', () => {
    it('returns correct path to node executable on linux', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('x64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      const p = NodeManager.getNodeExePath();
      expect(p).toContain('bin/node');
      expect(p).not.toContain('.exe');
    });

    it('returns path with .exe on windows', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('x64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
      const p = NodeManager.getNodeExePath();
      expect(p).toContain('bin/node.exe');
    });

    it('returns empty on unsupported platform', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
      expect(NodeManager.getNodeExePath()).toBe('');
    });
  });

  // ── getPathWithManagedNode ───────────────────────────────

  describe('getPathWithManagedNode', () => {
    it('prepends managed node bin dir when it exists', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('x64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      const savedPath = process.env.PATH;
      process.env.PATH = '/usr/bin:/bin';
      mockExistsSync.mockReturnValue(true);

      const result = NodeManager.getPathWithManagedNode();
      expect(result).toContain('.kcode/node/node-v');
      expect(result).toContain('bin');
      expect(result).toContain('/usr/bin:/bin');
      expect(result!.split(path.delimiter).length).toBeGreaterThanOrEqual(3);

      process.env.PATH = savedPath;
    });

    it('returns current PATH when managed node dir does not exist', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('x64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      const savedPath = process.env.PATH;
      process.env.PATH = '/usr/local/bin:/usr/bin';
      mockExistsSync.mockReturnValue(false);

      const result = NodeManager.getPathWithManagedNode();
      expect(result).toBe('/usr/local/bin:/usr/bin');

      process.env.PATH = savedPath;
    });

    it('returns current PATH on unsupported platform', () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
      const savedPath = process.env.PATH;
      process.env.PATH = '/usr/bin';
      mockExistsSync.mockReturnValue(false);

      const result = NodeManager.getPathWithManagedNode();
      expect(result).toBe('/usr/bin');

      process.env.PATH = savedPath;
    });
  });

  // ── getSystemNodeVersion ─────────────────────────────────

  describe('getSystemNodeVersion', () => {
    it('returns version info when node is found and version >= 22', async () => {
      mockExecFn.mockImplementation((_cmd: string, _opts: any, cb: any) => {
        cb(null, 'v22.5.0\n');
      });

      const info = await NodeManager.getSystemNodeVersion();
      expect(info.found).toBe(true);
      expect(info.version).toBe('v22.5.0');
      expect(info.major).toBe(22);
      expect(info.minor).toBe(5);
      expect(info.patch).toBe(0);
    });

    it('returns found=false when node is not installed', async () => {
      mockExecFn.mockImplementation((_cmd: string, _opts: any, cb: any) => {
        cb(new Error('not found'), '');
      });

      const info = await NodeManager.getSystemNodeVersion();
      expect(info.found).toBe(false);
      expect(info.major).toBe(0);
    });

    it('parses versions like v24.13.0 correctly', async () => {
      mockExecFn.mockImplementation((_cmd: string, _opts: any, cb: any) => {
        cb(null, 'v24.13.0\n');
      });

      const info = await NodeManager.getSystemNodeVersion();
      expect(info.found).toBe(true);
      expect(info.major).toBe(24);
      expect(info.minor).toBe(13);
      expect(info.patch).toBe(0);
    });

    it('parses versions with leading whitespace', async () => {
      mockExecFn.mockImplementation((_cmd: string, _opts: any, cb: any) => {
        cb(null, '  v20.11.1\n');
      });

      const info = await NodeManager.getSystemNodeVersion();
      expect(info.found).toBe(true);
      expect(info.major).toBe(20);
      expect(info.minor).toBe(11);
      expect(info.patch).toBe(1);
    });
  });

  // ── needsManagedNode ─────────────────────────────────────

  describe('needsManagedNode', () => {
    beforeEach(() => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('x64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    });

    it('returns false when managed node already exists', async () => {
      mockExistsSync.mockReturnValue(true);

      const result = await NodeManager.needsManagedNode();
      expect(result).toBe(false);
      expect(mockExecFn).not.toHaveBeenCalled();
    });

    it('returns true when system node not found', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFn.mockImplementation((_cmd: string, _opts: any, cb: any) => {
        cb(new Error('not found'), '');
      });

      const result = await NodeManager.needsManagedNode();
      expect(result).toBe(true);
    });

    it('returns true when system node major < 22', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFn.mockImplementation((_cmd: string, _opts: any, cb: any) => {
        cb(null, 'v20.11.1\n');
      });

      const result = await NodeManager.needsManagedNode();
      expect(result).toBe(true);
    });

    it('returns false when system node major >= 22', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFn.mockImplementation((_cmd: string, _opts: any, cb: any) => {
        cb(null, 'v22.5.0\n');
      });

      const result = await NodeManager.needsManagedNode();
      expect(result).toBe(false);
    });

    it('returns false on unsupported platform', async () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');

      const result = await NodeManager.needsManagedNode();
      expect(result).toBe(false);
    });
  });

  // ── ensureNode ───────────────────────────────────────────

  describe('ensureNode', () => {
    const streamMsgs: string[] = [];
    const stream = (msg: string) => { streamMsgs.push(msg); };

    beforeEach(() => {
      streamMsgs.length = 0;
      vi.spyOn(process, 'arch', 'get').mockReturnValue('x64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    });

    it('returns path when managed node already exists', async () => {
      mockExistsSync.mockReturnValue(true);

      const result = await NodeManager.ensureNode(stream);
      expect(result).toBeTruthy();
      expect(result).toContain('bin/node');
      expect(streamMsgs.some(m => m.includes('已就绪'))).toBe(true);
    });

    it('returns null when system node >= 22 and managed node not installed', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('bin/node')) return false;
        return false;
      });
      mockExecFn.mockImplementation((_cmd: string, _opts: any, cb: any) => {
        cb(null, 'v22.5.0\n');
      });

      const result = await NodeManager.ensureNode(stream);
      expect(result).toBeNull();
      expect(streamMsgs.some(m => m.includes('满足要求'))).toBe(true);
    });

    it('downloads and extracts when system node < 22', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFn.mockImplementation((_cmd: string, _opts: any, cb: any) => {
        cb(null, 'v20.11.1\n');
      });

      const writeStream = await makeMockWritable();
      mockCreateWriteStream.mockReturnValue(writeStream);

      // Mock https.get with a Readable stream that auto-completes
      const { Readable } = await import('stream');
      const response = new Readable({ read() {} });
      (response as any).statusCode = 200;
      (response as any).headers = {};
      mockHttpsGet.mockImplementation((_url: string, cb: any) => {
        cb(response);
        return { on: vi.fn(), setTimeout: vi.fn((_t: any, _cb: any) => ({})) };
      });
      response.push(Buffer.from('fake tarball data'));
      response.push(null);

      mockExecSyncFn.mockReturnValue('');

      const result = await NodeManager.ensureNode(stream);
      expect(result).toBeTruthy();
      expect(result).toContain('bin/node');
      expect(streamMsgs.some(m => m.includes('版本过低'))).toBe(true);
      expect(streamMsgs.some(m => m.includes('下载'))).toBe(true);
      expect(streamMsgs.some(m => m.includes('解压'))).toBe(true);
      expect(streamMsgs.some(m => m.includes('已安装'))).toBe(true);
      expect(mockHttpsGet).toHaveBeenCalled();
      expect(mockExecSyncFn).toHaveBeenCalled();
    });

    it('downloads and extracts when system node not found', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFn.mockImplementation((_cmd: string, _opts: any, cb: any) => {
        cb(new Error('not found'), '');
      });

      const writeStream = await makeMockWritable();
      mockCreateWriteStream.mockReturnValue(writeStream);

      const { Readable } = await import('stream');
      const response = new Readable({ read() {} });
      (response as any).statusCode = 200;
      (response as any).headers = {};
      mockHttpsGet.mockImplementation((_url: string, cb: any) => {
        cb(response);
        return { on: vi.fn(), setTimeout: vi.fn((_t: any, _cb: any) => ({})) };
      });
      response.push(Buffer.from('fake tarball data'));
      response.push(null);

      mockExecSyncFn.mockReturnValue('');

      const result = await NodeManager.ensureNode(stream);
      expect(result).toBeTruthy();
      expect(streamMsgs.some(m => m.includes('未检测到系统'))).toBe(true);
    });

    it('returns null on download failure', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFn.mockImplementation((_cmd: string, _opts: any, cb: any) => {
        cb(new Error('not found'), '');
      });

      const writeStream = await makeMockWritable();
      mockCreateWriteStream.mockReturnValue(writeStream);

      mockHttpsGet.mockImplementation((_url: string, _cb: any) => {
        const req = {
          on: vi.fn((event: string, cb: any) => {
            if (event === 'error') cb(new Error('Connection refused'));
            return req;
          }),
          setTimeout: vi.fn((_t: any, _cb: any) => req),
          destroy: vi.fn(),
        };
        return req;
      });

      const result = await NodeManager.ensureNode(stream);
      expect(result).toBeNull();
      expect(streamMsgs.some(m => m.includes('失败'))).toBe(true);
    });

    it('returns null on unsupported platform', async () => {
      vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64' as any);
      vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');

      const result = await NodeManager.ensureNode(stream);
      expect(result).toBeNull();
      expect(streamMsgs.some(m => m.includes('不支持'))).toBe(true);
    });
  });
});
