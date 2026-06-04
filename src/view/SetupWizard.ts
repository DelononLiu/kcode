import * as cp from 'child_process';
import * as os from 'os';
import * as path from 'path';

export interface SetupResult {
    nodeInstalled: boolean;
    nodeVersion: string;
    npmInstalled: boolean;
    npmVersion: string;
    kiloInstalled: boolean;
    kiloVersion: string;
    opencodeInstalled: boolean;
    opencodeVersion: string;
    claudeInstalled: boolean;
    claudeVersion: string;
    configReady: boolean;
}

export type NarrationCallback = (text: string) => void;

async function which(cmd: string): Promise<boolean> {
    return new Promise(resolve => {
        cp.exec(`which "${cmd}"`, { maxBuffer: 4096 }, (err) => {
            resolve(!err);
        });
    });
}

async function getVersion(cmd: string, flag = '--version'): Promise<string> {
    return new Promise(resolve => {
        cp.exec(`"${cmd}" ${flag}`, { maxBuffer: 4096 }, (err, stdout) => {
            if (err) { resolve(''); return; }
            resolve(stdout.trim().split('\n')[0]);
        });
    });
}

export async function detectEnv(narrate: NarrationCallback): Promise<SetupResult> {
    narrate('正在检测内置运行环境…');

    const results: SetupResult = { nodeInstalled: false, nodeVersion: '', npmInstalled: false, npmVersion: '', kiloInstalled: false, kiloVersion: '', opencodeInstalled: false, opencodeVersion: '', claudeInstalled: false, claudeVersion: '', configReady: false };

    const [hasSystemNode, hasNpm, hasKilo, hasOpencode, hasClaude] = await Promise.all([
        which('node'),
        which('npm'),
        which('kilo'),
        which('opencode'),
        which('claude'),
    ]);

    // 也检测管理版 Node 目录（~/.kcode/node/ 下已下载的）
    let { getNodeBinDir } = { getNodeBinDir: () => '' };
    try {
        ({ getNodeBinDir } = await import('../env/NodeManager'));
    } catch {}
    const managedBinDir = getNodeBinDir();
    const fs = await import('fs');

    // 管理版内各可执行文件
    const managedNodeExe = managedBinDir ? path.join(managedBinDir, process.platform === 'win32' ? 'node.exe' : 'node') : '';
    const hasManagedNode = managedNodeExe ? fs.existsSync(managedNodeExe) : false;
    const managedNpmExe = managedBinDir ? path.join(managedBinDir, process.platform === 'win32' ? 'npm.cmd' : 'npm') : '';
    const hasManagedNpm = managedNpmExe ? fs.existsSync(managedNpmExe) : false;
    const managedClaudeExe = managedBinDir ? path.join(managedBinDir, 'claude') : '';
    const hasManagedClaude = managedClaudeExe ? fs.existsSync(managedClaudeExe) : false;
    const managedKiloExe = managedBinDir ? path.join(managedBinDir, 'kilo') : '';
    const hasManagedKilo = managedKiloExe ? fs.existsSync(managedKiloExe) : false;
    const managedOpencodeExe = managedBinDir ? path.join(managedBinDir, 'opencode') : '';
    const hasManagedOpencode = managedOpencodeExe ? fs.existsSync(managedOpencodeExe) : false;

    results.nodeInstalled = hasSystemNode || hasManagedNode;
    results.npmInstalled = hasNpm || hasManagedNpm;
    results.kiloInstalled = hasKilo || hasManagedKilo;
    results.opencodeInstalled = hasOpencode || hasManagedOpencode;
    results.claudeInstalled = hasClaude || hasManagedClaude;

    // 优先读管理版版本（优先级更高），再读系统版
    if (hasManagedNode) {
        results.nodeVersion = await new Promise<string>(resolve => {
            cp.exec(`"${managedNodeExe}" --version`, { maxBuffer: 4096 }, (err, stdout) => {
                resolve(err ? '' : stdout.trim().split('\n')[0]);
            });
        });
    } else if (hasSystemNode) {
        results.nodeVersion = await getVersion('node');
    }
    if (hasManagedNpm) {
        results.npmVersion = await new Promise<string>(resolve => {
            cp.exec(`"${managedNpmExe}" --version`, { maxBuffer: 4096 }, (err, stdout) => {
                resolve(err ? '' : stdout.trim().split('\n')[0]);
            });
        });
    } else if (hasNpm) {
        results.npmVersion = await getVersion('npm');
    }
    if (hasManagedKilo) {
        results.kiloVersion = await getVersion(managedKiloExe);
    } else if (hasKilo) {
        results.kiloVersion = await getVersion('kilo');
    }
    if (hasManagedOpencode) {
        results.opencodeVersion = await getVersion(managedOpencodeExe);
    } else if (hasOpencode) {
        results.opencodeVersion = await getVersion('opencode');
    }
    if (hasManagedClaude) {
        results.claudeVersion = await getVersion(managedClaudeExe);
    } else if (hasClaude) {
        results.claudeVersion = await getVersion('claude');
    }

    // Check if kcode config has agentName set
    const configPath = path.join(os.homedir(), '.kcode', 'kcode.jsonc');
    try {
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf-8');
            const cfg = JSON.parse(raw);
            results.configReady = !!(cfg.agentName || cfg.agent?.code?.name);
        }
    } catch {}

    return results;
}
