import * as cp from 'child_process';
import * as os from 'os';

export interface SetupResult {
    nodeInstalled: boolean;
    kiloInstalled: boolean;
    opencodeInstalled: boolean;
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

export async function detectEnv(narrate: NarrationCallback): Promise<SetupResult> {
    narrate('正在检测内置运行环境…');

    const results: SetupResult = { nodeInstalled: false, kiloInstalled: false, opencodeInstalled: false, configReady: false };

    const [hasNode, hasKilo, hasOpencode] = await Promise.all([
        which('node'),
        which('kilo'),
        which('opencode'),
    ]);

    results.nodeInstalled = hasNode;
    results.kiloInstalled = hasKilo;
    results.opencodeInstalled = hasOpencode;

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
