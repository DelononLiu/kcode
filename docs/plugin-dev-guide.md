# KCode 插件开发指南

## 插件是什么

KCode 插件是一组通过 `KCodePlugin` 接口声明的模块，可以注册消息路由、流处理器、UI 贡献等扩展点。插件只在**任务模式**下激活，小助手模式全部静默。

## 快速开始

复制 `src/plugins/_template/TemplatePlugin.ts` 开始开发：

```typescript
import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';

const plugin: KCodePlugin = {
    id: 'kcode.myplugin',
    name: 'My Plugin',
    version: '1.0.0',
    mode: 'task',

    async activate(api: PluginAPI) {
        // 注册消息处理器
        api.onMessage('customEvent', async (msg: any) => {
            console.log('[MyPlugin] customEvent:', msg);
        });

        // 注册输出面板 Tab
        api.addOutputPanelTab('myTab', '📌 我的Tab', (taskInfo: any) => {
            return `<div class="op-item">数据: ${taskInfo?.phase}</div>`;
        });
    },

    async deactivate() {
        console.log('[MyPlugin] deactivated');
    },
};

export default plugin;
```

## 插件接口

### `KCodePlugin`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | **必填**。全局唯一 ID，如 `kcode.myplugin` |
| `name` | `string` | **必填**。人类可读名称 |
| `version` | `string` | **必填**。语义化版本 |
| `mode` | `'task' \| 'assistant'` | 运行模式，默认 `'task'`。小助手模式下静默 |
| `dependencies` | `string[]` | 依赖的其他插件 ID 列表 |
| `activate(api)` | `void \| Promise<void>` | **必填**。插件激活时调用，注册扩展点 |
| `deactivate()` | `void \| Promise<void>` | **必填**。插件停用时调用，清理资源 |

### `PluginAPI`

#### `onMessage(type, handler)`
注册 WebView 消息处理器。`type` 为消息类型字符串，当 WebView 发送匹配类型的消息时调用 handler。

```typescript
api.onMessage('myAction', async (msg: { taskId: string; payload: any }) => {
    // 处理消息
});
```

#### `onPhaseChanged(handler)`
任务阶段迁移时触发。handler 接收 `(taskId, fromPhase, toPhase)`。

```typescript
api.onPhaseChanged((taskId, fromPhase, toPhase) => {
    console.log(`任务 ${taskId}: ${fromPhase} → ${toPhase}`);
});
```

#### `onToolCall(kind, handler)`
特定工具类型被调用时触发。`kind` 如 `'bash'`, `'read'`, `'write'`, `'todowrite'` 等。

```typescript
api.onToolCall('bash', (taskId: string, info: any) => {
    console.log(`bash 命令: ${info.title}`);
});
```

#### `addStreamProcessor(processor)`
注册流式文本处理器。接收 AI 回复的文本 chunk，处理后返回修改后的文本。

```typescript
api.addStreamProcessor((text: string) => {
    return text.replace(/foo/g, 'bar');
});
```

#### `addOutputPanelTab(id, label, renderer)`
在右栏产出物面板注册一个新 Tab。`renderer` 返回 HTML 字符串。

```typescript
api.addOutputPanelTab('metrics', '📊 指标', (taskInfo) => {
    const steps = taskInfo?.planSteps || [];
    return `<div class="op-item">进度: ${steps.filter(s => s.status === 'completed').length}/${steps.length}</div>`;
});
```

#### `registerPhaseHook(phase, hook)`
在指定阶段进入/离开时触发钩子。

```typescript
api.registerPhaseHook('review', {
    onEnter: async (taskId) => { /* review 阶段开始 */ },
    onLeave: async (taskId) => { /* review 阶段结束 */ },
});
```

#### `getPlugin(id)`
获取其他插件的导出 API。需对方调用 `api.setPluginExport()` 暴露接口。

```typescript
const deviceMgr = api.getPlugin('kcode.device');
```

#### `setPluginExport(id, exports)`
暴露插件 API 供其他插件调用。

```typescript
api.setPluginExport('kcode.myplugin', { myMethod: () => {} });
```

#### 核心服务访问

| 方法 | 返回 |
|------|------|
| `getStore()` | `TaskStore` — 任务/消息 CRUD |
| `getRouter()` | `MessageRouter` — 消息分发 |
| `getAgentService()` | `AgentService` — Agent 连接/发送 |

## 热开关

插件支持运行时启用/禁用，无需重启 VS Code：

- WebView 发送 `enablePlugin` / `disablePlugin` 消息
- 状态持久化到 `~/.kcode/kcode.jsonc` 的 `plugins` 字段
- 停用时自动清理已注册的扩展点，恢复之前状态

## 内置插件列表

| ID | 名称 | 说明 |
|----|------|------|
| `kcode.device` | Device Plugin | 远程设备连接管理 (SSH/ADB/Local) |
| `kcode.demo` | Demo Plugin | 对话内演示运行 |
| `kcode.todo` | Todo Plugin | TODO 协议 + checkbox 交互 |
| `kcode.knowledge` | Knowledge Plugin | 知识萃取 + Wiki 导出 |
| `kcode.review` | Review Plugin | 审核变更管理 |
| `kcode.diff` | Diff Plugin | diff 预览 + 原生 diff 打开 |
| `kcode.delegate` | Delegation Plugin | 任务委派 + Chat→Task 转换 |
| `kcode.setup` | Setup Plugin | 环境引导检测 |
| `kcode.terminal` | Terminal Plugin | 任务终端日志重放 |

## 调试技巧

1. `console.log` 输出会显示在 VS Code 开发者工具的「控制台」面板
2. 在 KCodePanel 构造时 `initPlugins()` 已按注册顺序激活所有插件
3. 可通过 Settings 面板管理插件启用/禁用
