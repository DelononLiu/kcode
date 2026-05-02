import { spawn, ChildProcess } from 'child_process';
import { Writable, Readable } from 'stream';

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

        const agentProcess = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'inherit'],
            env: { ...process.env }
        });

        this.process = agentProcess;

        // Convert Node.js streams to Web Streams for ACP SDK
        const input = Writable.toWeb(agentProcess.stdin) as WritableStream<Uint8Array>;
        const output = Readable.toWeb(agentProcess.stdout) as ReadableStream<Uint8Array>;

        agentProcess.on('exit', (code) => {
            console.log(`Agent process exited with code ${code}`);
            this.process = null;
        });

        agentProcess.on('error', (err) => {
            console.error('Agent process error:', err);
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
