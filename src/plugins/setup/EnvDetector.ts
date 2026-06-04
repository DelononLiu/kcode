import { detectEnv } from '../../view/SetupWizard';
import type { ConfigService } from '../../core/ConfigService';

export class EnvDetector {
    constructor(private configService: ConfigService, private stream: (text: string) => void) {}

    async runSetup(agentService: any, router: any, assistantHandler: any): Promise<void> {
        const stream = this.stream;

        let streamBuffer = '';
        const bufferedStream = (text: string) => {
            streamBuffer += text;
            stream(text);
        };

        bufferedStream('正在检查运行环境…\n');

        const env = await detectEnv(() => {});

        // 自动检测 Node.js，缺失或版本过低则自动下载 Node 24
        const { ensureNode, needsManagedNode } = await import('../../env/NodeManager');
        const nodePath = await ensureNode(bufferedStream);

        if (!nodePath && await needsManagedNode()) {
            bufferedStream('\n\n❌ Node.js 不可用，请手动安装 Node.js https://nodejs.org');
            return;
        }

        if (!env.kiloInstalled && !env.opencodeInstalled && !env.claudeInstalled) {
            bufferedStream('\n\n⚠️ 未检测到 Agent CLI，将自动安装 Claude Code：\n```bash\nnpm install -g @anthropic-ai/claude-code\n```\n或手动安装其一：\n- Claude: `npm install -g @anthropic-ai/claude-code`\n- Kilo: `npm install -g @kilocode/cli`\n- OpenCode: `npm install -g opencode-ai@latest`');
            return;
        }

        const agentToUse = env.claudeInstalled ? 'claude' : env.kiloInstalled ? 'kilo' : env.opencodeInstalled ? 'opencode' : 'claude';

        if (!env.configReady) {
            bufferedStream('\n\n正在配置 Agent…');
            this.configService.set('agentName', agentToUse);
            await this.configService.save();
            bufferedStream(`\n\n✅ 已自动配置 agentName = "${agentToUse}"`);
        }

        this.streamModelConfig(agentToUse, bufferedStream);

        bufferedStream('\n\n正在连接 Agent…');
        if (agentService.isConnected) {
            await agentService.disconnect();
        }
        const connected = await agentService.connectByLabel(agentToUse);
        if (connected) {
            bufferedStream('\n\n✅ **环境已就绪**');
        } else {
            bufferedStream('\n\n⚠️ 环境配置完成，但连接仍有问题，请在设置中检查。');
        }

        if (agentService.isConnected) {
            const labelMap: Record<string, string> = { kilo: 'Kilo', opencode: 'OpenCode', claude: 'Claude' };
            router.PostMessage({
                type: 'agentStatus', status: 'connected',
                message: labelMap[agentToUse] || agentToUse,
                agentName: agentService.agentName,
                modelName: agentService.modelName,
            });
        }

        assistantHandler?.transitionAfterSetup?.(undefined, streamBuffer);
    }

    private streamModelConfig(agentName: string, stream: (text: string) => void): void {
        if (agentName === 'openai') {
            const apiKey = this.configService.get<string>('provider.openai.apiKey');
            const model = this.configService.get<string>('provider.openai.model');
            if (apiKey) {
                stream(`\n\n🤖 模型: ${model || '未设置'} | API Key: ✅`);
            } else {
                stream('\n\n⚠️ OpenAI API Key 未配置，请在设置中填写');
            }
        } else if (agentName === 'kilo') {
            stream('\n\n🤖 模型: 使用 Kilo 配置 (~/.config/kilo/kilo.jsonc)');
        } else if (agentName === 'opencode') {
            stream('\n\n🤖 模型: 使用 OpenCode 默认配置');
        } else if (agentName === 'claude') {
            const key = process.env.ANTHROPIC_API_KEY;
            const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
            stream(key
                ? `\n\n🤖 模型: ${model} | API Key: ✅`
                : `\n\n🤖 模型: ${model}\n⚠️ ANTHROPIC_API_KEY 未设置，请在环境变量或设置中配置`);
        }
    }
}
