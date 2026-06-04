import { detectEnv } from '../../view/SetupWizard';
import type { ConfigService } from '../../core/ConfigService';

export class EnvDetector {
    constructor(private configService: ConfigService, private stream: (text: string) => void) {}

    async runSetup(agentService: any, router: any, assistantHandler: any): Promise<void> {
        const stream = this.stream;

        stream('正在检查运行环境…\n');

        const env = await detectEnv(() => {});

        if (!env.nodeInstalled) {
            stream('\n\n⚠️ Node.js 未安装，请先安装 Node.js https://nodejs.org');
            return;
        }

        if (!env.kiloInstalled && !env.opencodeInstalled && !env.claudeInstalled) {
            stream('\n\n⚠️ 未检测到 Kilo CLI、OpenCode CLI 或 Claude CLI，请先安装其中一个：\n- Kilo: https://kilo.ai\n- OpenCode: https://opencode.ai\n- Claude: https://claude.ai');
            return;
        }

        const agentToUse = env.kiloInstalled ? 'kilo' : env.claudeInstalled ? 'claude' : 'opencode';

        if (!env.configReady) {
            stream('\n\n正在配置 Agent…');
            this.configService.set('agentName', agentToUse);
            await this.configService.save();
            stream(`\n\n✅ 已自动配置 agentName = "${agentToUse}"`);
        }

        this.streamModelConfig(agentToUse);

        stream('\n\n正在连接 Agent…');
        if (agentService.isConnected) {
            await agentService.disconnect();
        }
        const connected = await agentService.connectByLabel(agentToUse);
        if (connected) {
            stream('\n\n✅ **环境已就绪**');
        } else {
            stream('\n\n⚠️ 环境配置完成，但连接仍有问题，请在设置中检查。');
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

        assistantHandler?.transitionAfterSetup?.();
    }

    private streamModelConfig(agentName: string): void {
        const stream = this.stream;
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
            stream('\n\n🤖 模型: 使用 Claude 默认配置');
        }
    }
}
