const CHAT_PATTERNS = [
    /你好|你好吗|嗨|hello|hi|hey/i,
    /你是谁|你叫什么|你是哪个|who are you|what are you|介绍一下你自己|你能做什么|你会什么|what can you do|你的功能|有什么用/i,
    /谢谢|thanks|thank you|再见|拜拜|bye|天气|闲聊|聊天|你会聊天吗/i,
];

const TASK_ONLY_PATTERNS = [
    /^(写|实现|开发|编写|创建|新建|添加|增加|修改|修复|重构|优化|删除|迁移|升级|配置|集成|部署|测试|调试|排查|分析|检查)/,
    /^(implement|create|add|fix|refactor|write|update|delete|migrate|deploy|test|debug)\b/i,
    /^(请|帮我|给我|需要|我要|我想|能不能|怎么|如何)/,
];

export type Intent = 'task' | 'chat';

export function classifyIntent(text: string): Intent {
    const trimmed = text.trim();
    if (!trimmed) return 'chat';

    for (const p of TASK_ONLY_PATTERNS) {
        if (p.test(trimmed)) return 'task';
    }

    for (const p of CHAT_PATTERNS) {
        if (p.test(trimmed)) return 'chat';
    }

    return 'chat';
}
