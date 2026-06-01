import { spawn, execSync, ChildProcess } from 'child_process';
import { Writable, Readable } from 'stream';

let _agentChannel: any = null;
function logAgent(msg: string): void {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log(line);
    try {
        if (!_agentChannel) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const v = require('vscode');
            _agentChannel = v.window.createOutputChannel('KCode Agent');
        }
        _agentChannel.appendLine(line);
    } catch { }
}

export interface AgentProcess {
    process: ChildProcess;
    input: WritableStream<Uint8Array>;
    output: ReadableStream<Uint8Array>;
}

export class AgentManager {
    private process: ChildProcess | null = null;

    /**
     * Start an ACP agent subprocess.
     * Supports both direct JS/TS files (via node/tsx) and npm packages.
     */
    async startAgent(command: string, args: string[] = []): Promise<AgentProcess> {
        if (this.process) {
            this.stopAgent();
        }

        let resolvedPath = command;
        try {
            resolvedPath = execSync(`which "${command}"`, { encoding: 'utf-8' }).trim();
        } catch {
            resolvedPath = command + ' (NOT FOUND on PATH)';
        }
        logAgent(`Spawning: ${resolvedPath} ${args.join(' ')}`);

        const agentProcess = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'inherit'],
            env: { ...process.env }
        });

        this.process = agentProcess;

        // Convert Node.js streams to Web Streams for ACP SDK
        const input = Writable.toWeb(agentProcess.stdin) as WritableStream<Uint8Array>;
        const output = Readable.toWeb(agentProcess.stdout) as ReadableStream<Uint8Array>;

        agentProcess.on('exit', (code) => {
            logAgent(`Process exited with code ${code}`);
            this.process = null;
        });

        agentProcess.on('error', (err) => {
            logAgent(`Process error: ${(err as Error)?.message || err}`);
            this.process = null;
        });

        return { process: agentProcess, input, output };
    }

    /**
     * Start the agent via npx (for running TypeScript agents)
     */
    async startAgentWithNpx(scriptPath: string): Promise<AgentProcess> {
        const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        return this.startAgent(npxCmd, ['tsx', scriptPath]);
    }

    /**
     * Start OpenCode ACP agent via stdio.
     * Spawns: `opencode acp --port 0 --cwd <workspacePath>`
     */
    async startOpenCodeAgent(opencodePath: string, workspacePath: string): Promise<AgentProcess> {
        return this.startAgent(opencodePath, [
            'acp', '--port', '0', '--cwd', workspacePath
        ]);
    }

    stopAgent(): void {
        if (this.process) {
            this.process.kill('SIGTERM');
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
            }, 3000);
            this.process = null;
        }
    }

    isRunning(): boolean {
        return this.process !== null && !this.process.killed && this.process.exitCode === null;
    }
}
