/**
 * Node.js 自动检测与下载安装模块
 *
 * 职责:
 * - 检测系统 Node.js 版本
 * - 支持平台: linux-x64, linux-arm64, win-x64
 * - 在 ~/.kcode/node/ 下自动下载安装 Node.js 24
 * - 提供 PATH 注入辅助函数供 AgentManager 使用
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, exec } from 'child_process';
import { log } from '../log';

// ── 常量 ──────────────────────────────────────────────────

/** 要下载的 Node.js 版本 */
const NODE_VERSION = '24.13.0';

/** 系统 Node.js 最低主版本要求 */
const MINIMUM_NODE_MAJOR = 22;

/** 管理版 Node.js 安装基目录 */
const BASE_DIR = path.join(os.homedir(), '.kcode', 'node');

// ── 类型定义 ──────────────────────────────────────────────

type PlatformId = 'linux-x64' | 'linux-arm64' | 'win-x64';

interface PlatformInfo {
  platformId: PlatformId;
  archiveExt: string;
  nodeDirName: string;
}

export interface SystemNodeInfo {
  found: boolean;
  version: string;
  major: number;
  minor: number;
  patch: number;
}

// ── 平台检测 ──────────────────────────────────────────────

function detectPlatform(): PlatformInfo | null {
  const arch = process.arch;
  const plat = process.platform;

  if (plat === 'linux' && arch === 'x64') {
    return {
      platformId: 'linux-x64',
      archiveExt: 'tar.xz',
      nodeDirName: `node-v${NODE_VERSION}-linux-x64`,
    };
  }
  if (plat === 'linux' && arch === 'arm64') {
    return {
      platformId: 'linux-arm64',
      archiveExt: 'tar.xz',
      nodeDirName: `node-v${NODE_VERSION}-linux-arm64`,
    };
  }
  if (plat === 'win32' && arch === 'x64') {
    return {
      platformId: 'win-x64',
      archiveExt: 'zip',
      nodeDirName: `node-v${NODE_VERSION}-win-x64`,
    };
  }
  return null;
}

/**
 * 当前平台是否受自动安装支持
 */
export function isSupportedPlatform(): boolean {
  return detectPlatform() !== null;
}

// ── 路径辅助函数 ──────────────────────────────────────────

/** ~/.kcode/node/ 基目录 */
export function getNodeBaseDir(): string {
  return BASE_DIR;
}

/** 管理版 Node 的 bin 目录，如 ~/.kcode/node/node-v24.13.0-linux-x64/bin/ */
export function getNodeBinDir(): string {
  const info = detectPlatform();
  if (!info) return '';
  return path.join(BASE_DIR, info.nodeDirName, 'bin');
}

/** 管理版 node 可执行文件的完整路径 */
export function getNodeExePath(): string {
  const binDir = getNodeBinDir();
  if (!binDir) return '';
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(binDir, `node${ext}`);
}

/**
 * 返回注入管理版 Node PATH 后的环境 PATH 字符串。
 * 若管理版 Node 未安装或不支持当前平台，则返回当前系统 PATH 不变。
 */
export function getPathWithManagedNode(): string {
  const binDir = getNodeBinDir();
  const currentPath = process.env.PATH || '';
  if (!binDir || !fs.existsSync(binDir)) {
    return currentPath;
  }
  return `${binDir}${path.delimiter}${currentPath}`;
}

// ── 系统 Node 检测 ────────────────────────────────────────

function parseNodeVersion(versionStr: string): { major: number; minor: number; patch: number } | null {
  const v = versionStr.replace(/^v/i, '').trim();
  const parts = v.split('.');
  if (parts.length < 1) return null;
  const major = parseInt(parts[0], 10);
  const minor = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  const patch = parts.length > 2 ? parseInt(parts[2], 10) : 0;
  if (isNaN(major)) return null;
  return { major, minor: isNaN(minor) ? 0 : minor, patch: isNaN(patch) ? 0 : patch };
}

/**
 * 获取系统 Node.js 版本信息
 */
export async function getSystemNodeVersion(): Promise<SystemNodeInfo> {
  return new Promise(resolve => {
    exec('node --version', { maxBuffer: 4096 }, (err: Error | null, stdout: string) => {
      if (err) {
        resolve({ found: false, version: '', major: 0, minor: 0, patch: 0 });
        return;
      }
      const raw = stdout.trim().split('\n')[0];
      const parsed = parseNodeVersion(raw);
      if (!parsed) {
        resolve({ found: false, version: raw, major: 0, minor: 0, patch: 0 });
        return;
      }
      resolve({ found: true, version: raw, ...parsed });
    });
  });
}

/**
 * 是否需要管理版 Node.js：
 * - 系统 Node 未安装，或
 * - 系统 Node 主版本 < 22
 *
 * 注意：管理版 Node 已安装时返回 false（已就绪）。
 */
export async function needsManagedNode(): Promise<boolean> {
  if (!isSupportedPlatform()) return false;

  // 管理版 Node 已安装 → 不需要额外操作
  if (fs.existsSync(getNodeExePath())) return false;

  const sysNode = await getSystemNodeVersion();
  if (!sysNode.found) return true;
  return sysNode.major < MINIMUM_NODE_MAJOR;
}

// ── 下载 ──────────────────────────────────────────────────

/** 镜像源列表，按优先级排列 */
const MIRRORS: string[] = [
  `https://npmmirror.com/mirrors/node/v${NODE_VERSION}`,
  `https://nodejs.org/dist/v${NODE_VERSION}`,
];

function getDownloadUrl(info: PlatformInfo, mirrorBase: string): string {
  return `${mirrorBase}/node-v${NODE_VERSION}-${info.platformId}.${info.archiveExt}`;
}

async function downloadWithFallback(
  info: PlatformInfo,
  archivePath: string,
  stream?: (msg: string) => void,
): Promise<void> {
  let lastError: Error | null = null;
  for (const mirror of MIRRORS) {
    const url = getDownloadUrl(info, mirror);
    const label = mirror.includes('npmmirror') ? 'npmmirror' : 'nodejs.org';
    try {
      stream?.(`⏬ 正在从 ${label} 下载 Node.js (${info.platformId})…`);
      log('node', `开始下载: ${url}`);
      await downloadFile(url, archivePath);
      log('node', `从 ${label} 下载完成`);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log('node', `从 ${label} 下载失败: ${lastError.message}`);
      stream?.(`⚠️ ${label} 下载失败，尝试备用源…`);
      // 清理失败留下的临时文件，准备下一个源
      try { if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath); } catch { /* ignore */ }
    }
  }
  // 所有源都失败
  throw lastError || new Error('所有下载源均失败');
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = https.get(url, response => {
      // 处理重定向
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        file.close();
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
        reject(new Error(`下载失败，HTTP 状态码: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.on('error', err => {
      file.close();
      try { fs.unlinkSync(destPath); } catch { /* ignore */ }
      reject(err);
    });

    // 超时处理
    request.setTimeout(120000, () => {
      request.destroy();
      file.close();
      try { fs.unlinkSync(destPath); } catch { /* ignore */ }
      reject(new Error('下载超时 (120s)'));
    });
  });
}

// ── 解压 ──────────────────────────────────────────────────

function extractArchive(archivePath: string, targetDir: string, info: PlatformInfo): void {
  if (info.archiveExt === 'tar.xz') {
    execSync(`tar -xJf "${archivePath}" -C "${targetDir}"`, { stdio: 'inherit', timeout: 120000 });
  } else if (info.archiveExt === 'zip') {
    // Windows 10+ 内置 tar 命令支持解压 zip
    execSync(`tar -xf "${archivePath}" -C "${targetDir}"`, { stdio: 'inherit', timeout: 120000 });
  } else {
    throw new Error(`不支持的压缩格式: ${info.archiveExt}`);
  }
}

// ── 主入口 ────────────────────────────────────────────────

/**
 * 确保管理版 Node.js 已就绪。
 *
 * 检测逻辑：
 * 1. 若管理版 Node 已安装 → 直接返回路径
 * 2. 若系统 Node >= 22 → 返回 null（使用系统 Node）
 * 3. 若系统 Node < 22 或未安装 → 自动下载 Node 24 到 ~/.kcode/node/ → 返回路径
 * 4. 下载失败 → 返回 null
 *
 * @param stream 可选的进度回调函数
 * @returns node 可执行文件路径（成功），或 null（使用系统 Node 或失败）
 */
export async function ensureNode(stream?: (msg: string) => void): Promise<string | null> {
  const info = detectPlatform();
  if (!info) {
    stream?.('⚠️ 当前平台不支持自动安装 Node.js，请手动安装 https://nodejs.org');
    log('node', '不支持的平台，跳过自动安装 Node.js');
    return null;
  }

  // 1. 管理版 Node 已安装
  const nodeExe = getNodeExePath();
  if (fs.existsSync(nodeExe)) {
    stream?.('✅ Node.js 已就绪');
    return nodeExe;
  }

  // 2. 检查系统 Node
  const sysNode = await getSystemNodeVersion();
  log('node', `系统 Node.js: ${sysNode.found ? `v${sysNode.version}` : '未检测到'}`);
  if (sysNode.found && sysNode.major >= MINIMUM_NODE_MAJOR) {
    stream?.(`✅ 系统 Node.js v${sysNode.version} 满足要求 (>= v${MINIMUM_NODE_MAJOR})`);
    return null;
  }

  // 3. 需要下载
  if (sysNode.found) {
    stream?.(`📦 系统 Node.js v${sysNode.version} 版本过低，正在自动下载 Node.js v${NODE_VERSION}…`);
    log('node', `系统 Node.js v${sysNode.version} < v${MINIMUM_NODE_MAJOR}，准备下载管理版`);
  } else {
    stream?.(`📦 未检测到系统 Node.js，正在自动下载 Node.js v${NODE_VERSION}…`);
    log('node', '未检测到系统 Node.js，准备下载管理版');
  }

  // 确保目标目录存在
  fs.mkdirSync(BASE_DIR, { recursive: true });

  const archiveName = `node-v${NODE_VERSION}-${info.platformId}.${info.archiveExt}`;
  const archivePath = path.join(BASE_DIR, archiveName);

  try {
    // 清理残留的临时文件
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }

    // 优先 npmmirror，失败自动回退 nodejs.org
    await downloadWithFallback(info, archivePath, stream);

    stream?.('📦 下载完成，正在解压…');
    extractArchive(archivePath, BASE_DIR, info);
    log('node', `解压完成: ${BASE_DIR}`);

    stream?.(`✅ Node.js v${NODE_VERSION} 已安装到 ${BASE_DIR}`);

    // 验证
    if (fs.existsSync(nodeExe)) {
      stream?.(`   ${nodeExe}`);
      log('node', `管理版 Node.js 已就绪: ${nodeExe}`);
    } else {
      log('node', `解压后未找到 node 可执行文件: ${nodeExe}`);
    }

    // 清理压缩包
    try { fs.unlinkSync(archivePath); } catch { /* ignore */ }
  } catch (err) {
    // 清理临时文件
    try { if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath); } catch { /* ignore */ }
    const detail = err instanceof Error ? err.message : String(err);
    stream?.(`❌ 自动安装 Node.js 失败: ${detail}`);
    stream?.('\n👉 请手动安装 Node.js https://nodejs.org');
    log('node', `自动安装失败: ${detail}`);
    if (err instanceof Error && err.stack) {
      log('node', err.stack);
    }
    return null;
  }

  return nodeExe;
}
