import * as cp from 'child_process';
import * as os from 'os';

export interface SetupResult {
    nodeInstalled: boolean;
    nodeVersion: string;
    npmInstalled: boolean;
    npmVersion: string;
    kiloInstalled: boolean;
    kiloVersion: string;
    opencodeInstalled: boolean;
    opencodeVersion: string;
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

    const results: SetupResult = { nodeInstalled: false, nodeVersion: '', npmInstalled: false, npmVersion: '', kiloInstalled: false, kiloVersion: '', opencodeInstalled: false, opencodeVersion: '', configReady: false };

    const [hasNode, hasNpm, hasKilo, hasOpencode] = await Promise.all([
        which('node'),
        which('npm'),
        which('kilo'),
        which('opencode'),
    ]);

    results.nodeInstalled = hasNode;
    results.npmInstalled = hasNpm;
    results.kiloInstalled = hasKilo;
    results.opencodeInstalled = hasOpencode;

    if (hasNode) {
        results.nodeVersion = await getVersion('node');
    }
    if (hasNpm) {
        results.npmVersion = await getVersion('npm');
    }
    if (hasKilo) {
        results.kiloVersion = await getVersion('kilo');
    }
    if (hasOpencode) {
        results.opencodeVersion = await getVersion('opencode');
    }

    // Check if kcode config has agentName set
    const configPath = `${os.homedir()}/.kcode/kcode.jsonc`;
    try {
        const fs = await import('fs');
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf-8');
            const cfg = JSON.parse(raw);
            results.configReady = !!(cfg.agentName || cfg.agent?.code?.name);
        }
    } catch {}

    return results;
}
