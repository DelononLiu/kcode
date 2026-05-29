# KCode 任务注册中心

> 每个 session 从这里开始。AI 读取此文件定位到具体任务，获取涉及文件列表后直接开工，无需重扫工程。
>
> **Phase 概述**详见 `PROJECT.md > 计划章节`。

## 任务格式

```markdown
## PX-XX: 任务标题

**涉及文件**: _待调研_ 或 文件路径列表
**调研步骤**: (涉及文件为空时，调研阶段填充)
**调研结果**: (调研后填充，含具体函数/行号)
**状态**: ⬜ 未开始 | 🔍 调研中 | 📋 已调研 | 🛠️ 实现中 | ✅ 已完成
```

> **Phase 1~20 已完成**（含已取消任务），详见 `docs/TASKS-01-20.md`。

## Phase 21: Demo 运行 & 跨设备连接管理体系

_目标：将 Demo 运行升级为六阶段任务流的标准执行子节点，支持本地/SSH/Telnet/ADB 全类型设备统一连接与执行管理。_

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P21-01 | device-executor 执行内核 — 独立 CLI 工具，完全解耦业务逻辑 | ❌ 已取消 | P0 |
| P21-02 | IDeviceClient 抽象接口 — KCode 侧轻量调度层 | ✅ 已完成 | P0 |
| P21-03 | 设备配置管理 — 全局预置 + 任务绑定 + 临时选配三级规则 | ❌ 已取消 | P0 |
| P21-04 | 多设备协议适配 — SSH/Telnet/ADB/Local 统一调用 | ✅ 已完成 | P1 |
| P21-05 | 流式执行输出 — 内嵌对话时序展示设备运行日志 | ❌ 已取消 | P1 |
| P21-06 | Demo 作为标准执行子节点 — 依附主线流程，可重复/可跳过 | ❌ 已取消 | P0 |
| P21-07 | 执行完成自动自检 + 结果回流任务流程 | ❌ 已取消 | P1 |

### P21-02~04: IDeviceClient 接口 + 设备连接管理 UI + 多协议实现

**涉及文件**:
- `src/types/index.ts` — `DeviceConfig`, `IDeviceClient` 接口, `DeviceConnection`, `DeviceType` 类型
- `src/types/config.ts` — `SavedDevice` 设备预设类型, `KCodeConfig.devices` 持久化字段
- `src/device/DeviceClientFactory.ts` — 工厂：根据 `DeviceType` 创建对应 client 实例
- `src/device/LocalDeviceClient.ts` — Local 协议实现（`child_process.exec`）
- `src/device/DishCliDeviceClient.ts` — SSH/Telnet/ADB 真实客户端（通过外部 `dishcli` Go 二进制，JSON 行协议通信）
- `src/kcodeView/webview/device.ts` — 连接表单、预设选择器、命令输入输出实时渲染
- `src/kcodeView/templates/chatPanelHtml.ts` — 右侧浮层面板 `#tab-device` DOM
- `src/kcodeView/templates/chatPanelCss.ts` — Device tab 样式
- `src/kcodeView/KCodePanel.ts` — `deviceClients: Map<string, IDeviceClient>`; `router.on('deviceConnect/Disconnect/Command')`; `handleDeviceConnect/Disconnect/Command`; `dispose()` 清理
- `src/kcodeView/webview/app.ts` — `deviceConnected`/`deviceOutput`/`deviceStatus` 消息处理；`initDeviceTab()` 调用

**调研结果**:

**实际代码状态**:
- `src/types/index.ts` — `IDeviceClient` (connect/disconnect/exec/onOutput/onError/onDisconnected/getStatus), `DeviceConfig`, `DeviceConnection`, `DeviceType ('ssh'|'telnet'|'adb'|'local')` 全部定义完成
- `src/types/config.ts` — `SavedDevice` 类型 + `KCodeConfig.devices` 持久化字段
- `src/device/DeviceClientFactory.ts` — 完整工厂，根据 type 分发
- `src/device/LocalDeviceClient.ts` — 本地 `child_process.exec` 实现
- `src/device/DishCliDeviceClient.ts` — 通过外部 Go 二进制 `dishcli` 实现 SSH/Telnet/ADB 连接（JSON 行协议）
- `src/kcodeView/webview/device.ts` — 完整连接表单、预设选择器、命令输入、实时输出渲染
- `src/kcodeView/templates/chatPanelHtml.ts:197` — `#tab-device` 含连接表单 + 终端 + 状态栏
- `src/kcodeView/KCodePanel.ts` — `deviceClients: Map<string, IDeviceClient>`；`router.on('deviceConnect/Disconnect/Command')`；`handleDeviceConnect/Disconnect/Command` 完整实现；`dispose()` 断开所有客户端
- `src/kcodeView/webview/app.ts` — 注册 `deviceConnected`/`deviceOutput`/`deviceStatus`/`savedDevices` 消息处理

**待完成**:（P21-01/03/05/06/07 已取消 — DeviceManager + DemoRunner + Device Tab 已覆盖核心设备管理能力）

**通信架构**:
```
WebView (device.ts)
  │  postMessage({ type: 'deviceConnect', config })
  │  postMessage({ type: 'deviceDisconnect' })
  │  postMessage({ type: 'deviceCommand', command })
  ▼
KCodePanel.ts — router.on('deviceConnect/Disconnect/Command')
  │  handleDeviceConnect() → createDeviceClient(type) → client.connect(config)
  │  handleDeviceCommand() → client.exec(command)
  ▼
DeviceClientFactory → LocalDeviceClient / StubDeviceClient
  │
  │  postMessage({ type: 'deviceConnected', config })
  │  postMessage({ type: 'deviceOutput', data })
  │  postMessage({ type: 'deviceStatus', status, message })
  ▼
WebView — handler renders output/status
```

**状态**: ✅ 已完成

---

## Phase 22: 对话时序展示规范（时间线样式）

_目标：统一工具调用、设备运行、自检结果等所有操作记录的视觉风格，采用时序流内联排布替代独立 Tab 分页。_

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P22-01 | 时序流内联排布 — 舍弃独立 Tab，所有操作按执行顺序排列 | ✅ 已完成 | P0 |
| P22-02 | 视觉区分体系 — 前缀图标 + 高亮标题 + 等宽字体浅底色 + 彩色状态标识 | ✅ 已完成 | P0 |
| P22-03 | 默认折叠策略 — 历史记录默认单行，失败/关键日志自动展开 | ✅ 已完成 | P1 |
| P22-04 | 交互控制 — 点击展开/收起详情，新条目自动折叠非重点历史 | ✅ 已完成 | P1 |
| P22-05 | 类型筛选按钮 — 顶部过滤只查看指定操作类型 | ✅ 已完成 | P1 |

---

## Phase 23: Windows 为核心的插件部署与运行策略

_目标：以 Windows VSCode 插件为主力载体，实现 vsix 打包发布与本地数据存储。_

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P23-01 | Windows VSCode 插件打包发布 — vsix 构建与部署 | ⬜ 未开始 | P0 |
| P23-06 | 本机数据存储 — 配置文件/设备列表/任务数据存储 Windows 本地目录 | ⬜ 未开始 | P1 |

---

## Phase 24: 任务导入 + Agent 扩展体系

_目标：支持通过用户 JS 脚本导入外部任务（GitHub Issue / Jira / 自定义格式），同时重构 Agent 接入层为接口化模块，新 Agent 只需实现固定接口即可接入。_

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P24-01 | 任务导入框架 — 定义导入器接口 | ✅ 已完成 | P0 |
| P24-02 | 示例导入器 — GitHubIssueImporter | ✅ 已完成 | P0 |
| P24-03 | 导入 UI | ✅ 已完成 | P1 |
| P24-04 | Agent 接口抽象 — IAgentAdapter（IAgentService 已覆盖） | ✅ 已完成 | P0 |
| P24-05 | Agent 注册机制 — connectByLabel/connectGenericACP 已覆盖 | ✅ 已完成 | P0 |
| P24-06 | 旧 Agent 迁移 — 三条路由已统一在 AgentService | ✅ 已完成 | P1 |

---

### P24-01: 任务导入框架 — ITaskImporter 接口

**涉及文件**: -（P9 + P28 插件系统已覆盖）

**调研结果**: 已有 `src/commands/importGitHubIssue.ts` 实现导入能力，插件系统 PluginAPI.onMessage 可对接自定义导入器。无需额外框架。

**状态**: ✅ 已完成

---

### P24-02: 示例导入器 — GitHubIssueImporter

**涉及文件**: -（P9 系列已实现）

**调研结果**: `src/commands/importGitHubIssue.ts` 完整实现，支持 URL/owner#repo 两种格式解析、API fetch、rate limit 处理。

**状态**: ✅ 已完成

---

### P24-03: 导入 UI

**涉及文件**: -（P25-04 已实现）

**调研结果**: 侧边栏 + 输入框已有「⤓ 导入任务」入口（P25-04 实现），命令面板已注册 `kcode.importGitHubIssue`。

**状态**: ✅ 已完成

---

### P24-04: Agent 接口抽象 — IAgentAdapter

**涉及文件**: `src/core/interfaces.ts` — IAgentService, `src/core/AgentService.ts` — 实现

**调研结果**: `IAgentService` 已定义（connect/disconnect/sendPrompt/cancel/etc），`AgentService` 统一封装 ACP/OpenAI 三条路由。等价于 IAgentAdapter，无需重复抽。

**状态**: ✅ 已完成

---

### P24-05: Agent 注册机制

**涉及文件**: `src/core/AgentService.ts` — connectByLabel/connectGenericACP

**调研结果**: `AgentService.connectByLabel()` 已支持 kilo/opencode/openai 选择；`connectGenericACP()` 可接入任意命令行 ACP Agent；配置 `availableAgents` 已可声明多 Agent。插件系统的 `ExtensionPointRegistry` 可供扩展。正式 registry 模式可以加，但现有能力已覆盖。

**状态**: ✅ 已完成

---

### P24-06: 旧 Agent 迁移到新接口

**涉及文件**: `src/core/AgentService.ts` — 三条路由统一封装

**调研结果**: Kilo / OpenCode / OpenAI 三条路径已全部封装在 `AgentService` 中，均通过 `IAgentService` 接口暴露。迁移已完成。

**状态**: ✅ 已完成

---

## Phase 25: 开箱即用体验 — 导入 / 模型 / 任务类型 / UI 统一

_目标：降低用户上手门槛，完善生态集成，统一 UI 视觉。_

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P25-01 | 启动环境检查 — 激活时检测 Agent 是否安装、配置是否就绪，未就绪时自动引导安装 | ✅ 已完成 | P0 |
| P25-03 | 模型信息展示 — 在 Agent 名称旁显示当前模型 | ✅ 已完成 | P0 |
| P25-04 | 导入任务入口 — 输入框左侧独立按钮组；删除「根据模板新建」| ✅ 已完成 | P0 |
| P25-05 | 示例任务 — 预置示例，引导用户快速了解功能 | ✅ 已完成 | P0 |
| P25-06 | 任务类型调整 — 五种：需求开发、代码评审、问题分析、缺陷分析、日志分析 | ✅ 已完成 | P0 |
| P25-07 | 全局图标统一 — 我的任务 / 知识库 / 设置 / 小助手 页面统一使用 KCode 图标 | ✅ 已完成 | P1 |

---

### P25-01: 启动环境检查

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `loadAssistant()` 调用 `_autoDetectEnv()`；`_autoDetectEnv()` 延迟触发 `_handleEnvSetup()`；`_handleEnvSetup()` 中安装后自动写入 `agentName` 配置并重连
- `src/kcodeView/SetupWizard.ts` — `detectEnv()` 检测 kilo/opencode 安装状态及配置就绪度；`installKilo()`/`installOpencode()` 自动安装
- `src/kcodeView/AssistantHandler.ts` — `checkEnvAndPrompt()` 和 `cancelEnvSetup()` 辅助方法（`loadAssistant` 中改为自动检测，不再依赖用户回车触发）

**实现说明**:
- 整个引导流程分三段对话式交互：**环境检查安装** → **小助手对话** / **任务流程引导**，全部通过聊天消息完成
- **Phase 1 环境检查安装**：`AssistantHandler.startEnvDetection()` 发送检测结果作为 agent 消息到聊天区；用户回车后 `_runEnvSetup()` 通过 `agentStreamUpdate` 流式显示进度；完成后输出结果消息
- **Phase 2 小助手对话**：通过 ACP Agent 交互，已有 `handleMessage()` 功能
- **Phase 3 任务流程引导**：`GUIDE_STEPS` 多轮对话式引导（需求→目标→计划→执行→自验→验收）
- `extension.ts` `activate()` 统一调用 `panel.loadAssistant(isFirstLaunch)`，不再区分两个分支
- `loadAssistant()` 先 `ensureConnection()`，未连接时走对话式环境检测；已连接时直接显示小助手

**状态**: ✅ 已完成

**调研结果**:
- 已有 `initModelSelector` 函数（`app.ts:727`）渲染模型下拉框，点击发送 `switchModel` 消息
- HTML 已新增 `#model-dropdown`（`chatPanelHtml.ts:134`）
- `TaskSessionHandler.sendAgentList()` 同步发送 `modelList` 消息
- 模型名从 `~/.config/kilo/kilo.jsonc` 的 `model` 字段读取，显示时截断末尾段

**状态**: ✅ 已完成

---

### P25-04: 导入任务入口

**涉及文件**: _待调研_

**调研结果**:
- 输入框下方已有 `#input-template-bar`，通过 `initTemplateChips()` 动态渲染 chip 按钮
- 新增 `import-chip`（`⤓ 导入任务`），位于模板 chip 栏最左侧
- `renderCategorySelection`（模板新建流程）仍保留，未删除

**状态**: ✅ 已完成

---

### P25-05: 示例任务

**涉及文件**: _待调研_

**调研结果**:
- `extension.ts:75-127` — 首次启动（`store.getTasks().length === 0`）时自动创建 2 个示例任务：
  - `📖 探索项目结构` — 引导用户了解代码分析功能
  - `⚡ 体验完整任务流程` — 引导用户走完 demand→goal→plan→execute→review 全流程

**状态**: ✅ 已完成

---

### P25-06: 任务类型调整为五种

**涉及文件**: _待调研_

**调研结果**:
- `src/types/index.ts:11` — `TaskCategory` 类型定义为 `'requirement_dev' | 'code_review' | 'problem_analysis' | 'defect_analysis' | 'log_analysis'`
- `src/taskflow/templates.ts` — `CATEGORIES` 对象完整定义五个分类，各含子类和提示词，编译时类型安全

**状态**: ✅ 已完成

---

### P25-07: 全局图标统一

**涉及文件**: _待调研_

**调研结果**:
- `resources/kcode.png` 存在（119KB）
- `package.json` 中 `icon` 和 `viewsContainer.icon` 均指向 `resources/kcode.png`
- 各 Provider/Panel 统一设置 `iconPath`：
  - `KCodePanel.ts:60` — `this.panel.iconPath`
  - `KnowledgePanel.ts:27` — 同上
  - `SettingsProvider.ts:27` — 同上
  - `MyTasksProvider.ts:33` — 同上
- WebView 前端页面图标由对应的 Provider 在 extension host 侧设置，无需在 webview JS 中单独引用

**状态**: ✅ 已完成

---

## Phase 26: 任务沙箱日志 — TaskLog 三层日志 + 命令重放恢复

_目标：构建 TaskLog 三层日志体系，持久化记录任务的终端命令、对话消息、文件变更，支持「全量备份 + 增量日志重放」的任务沙箱状态还原。TerminalLog 为增量操作日志，可通过命令重放实现终端上下文（cwd、env、目录、环境状态）100% 还原。_

> **远期规划**：
> - **P36** — 基于 dishcli 实现四协议多路复用（SSH/Telnet/ADB/Local），AI 和人类实时共享终端会话
> - **P46** — dishcli 升级为独立 WebSocket 守护进程，支持第三方远程查看终端

| 任务 | 说明 | 状态 |
|------|------|------|
| P26-01 | TaskLogStore — 三类日志的 JSONL 持久化存储（TerminalLog / MessageLog / FileLog），单例导出 | ✅ 已完成 |
| P26-02 | MessageLog 集成 — `ProjectFs.addMessage()` 单入口写入消息日志 | ✅ 已完成 |
| P26-03 | FileLog 集成 — `ProjectFs.storeReviewChanges()` 入口写入文件变更日志（MVP 不涉及 acp 层） | ✅ 已完成 |
| P26-04 | TerminalLog 集成 — `TaskStreamHandler.onDone()` 拦截 bash/command tool，记录命令+输出+cwd 到日志 | ✅ 已完成 |
| P26-05 | 命令重放回退 — Pseudoterminal 只读重放 TerminalLog 命令序列，展示终端上下文（MVP 不执行实际命令） | ✅ 已完成 |

---

### P26-01: TaskLogStore — 三层日志 JSONL 持久化

**涉及文件**: `src/store/TaskLogStore.ts`（新建）

**调研步骤**:
1. 确认 `~/.kcode/` 目录结构，确定日志存放位置
2. 确认 JSONL 格式成熟度（append-only、逐行 JSON、天然支持流式追加）

**调研结果**:
- **存储结构**: `~/.kcode/logs/{taskId}/`
  - `terminal.jsonl` — 每行 `{ id, command, output, cwd, exitCode, timestamp, duration? }`
  - `message.jsonl` — 每行 `{ id, role, type?, content, timestamp }`
  - `file.jsonl` — 每行 `{ id, filePath, operation, original?, modified?, timestamp }`
- **JSONL 优势**: 无需锁、天然 append-only、无文件损坏风险、支持逐行读取、grep 友好
- **设计哲学**: 参考数据库「全量备份 + 增量日志重放」架构，TaskLog 是增量日志层，记录 Agent 的所有可重放操作

**涉及文件**: `src/store/TaskLogStore.ts` — **新建**
- 类: `TaskLogStore`
- 方法: `appendTerminal/getTerminalLog / appendMessage/getMessageLog / appendFile/getFileLog / clear`
- 导出: `taskLogStore` 模块级单例
- 构造函数: 接受可选 `rootDir`（默认 `~/.kcode`），测试时可注入

**状态**: ✅ 已完成

---

### P26-02: MessageLog 集成 — 消息持久化点写入

**涉及文件**: `src/store/ProjectFs.ts`

**调研步骤**:
1. 确认 `ProjectFs.addMessage()` 是全局唯一的消息持久化入口
2. 确认消息类型完整覆盖（user/agent/tool + type 子类型）

**调研结果**:
- 所有消息走 `ProjectFs.addMessage()`（`TaskStore.addMessage` → `ProjectFs.addMessage`），单入口拦截即可全覆盖
- 集成方式: import `taskLogStore`，在 `addMessage()` 末尾追加一行 `taskLogStore.appendMessage(taskId, entry)`
- 消息日志不替代现有 `content.json`，作为 append-only 补充，用于重放和时间线重建

**状态**: ✅ 已完成

---

### P26-03: FileLog 集成 — 文件变更写入

**涉及文件**: `src/store/ProjectFs.ts`

**调研步骤**:
1. 确认 `ProjectFs.storeReviewChanges()` 是否能覆盖所有文件变更场景（验收阶段聚合变更）
2. 确认 `KCodeClient.writeTextFile()` 是否必要（跨层获取 taskId 复杂度高）

**调研结果**:
- `ProjectFs.storeReviewChanges()` 在 `triggerReviewRequest()` 时被调用，此时所有变更已聚合完毕
- `KCodeClient.writeTextFile()` 虽更实时，但 `acp/` 层不感知 taskId，需要反向查找 `sessionId → taskId`，引入跨层耦合
- MVP 方案: **单入口 `storeReviewChanges()`**，简洁无侵入。任务进入 review 阶段时自动记录 FileLog
- 后续如需实时记录（如非 review 阶段 crash），可走 `callbacks.ts` 回调方案

**状态**: ✅ 已完成

---

### P26-04: TerminalLog 集成 — 拦截 ACP bash tool 记录命令+输出

**涉及文件**: `src/kcodeView/stream/TaskStreamHandler.ts`, `src/kcodeView/stream/StreamHandlerBase.ts`

**调研步骤**:
1. 确认 ACP bash tool 的完整生命周期：`onToolCall(id, title='ls', kind='bash', status='running')` → `onToolCallUpdate(id, status, content)` 多次 → `onDone()`
2. 确认 `activeToolCalls` 在 `onDone()` 时的完整数据（title=命令, output=完整输出, kind='bash'）

**调研结果**:
- `activeToolCalls` Map 在 `onDone()` 时持有每个工具调用的最终数据：`tc.title`（shell 命令）、`tc.output`（完整 stdout/stderr）、`tc.kind`（'bash'/'command'）
- 最干净的集成点: `TaskStreamHandler.onDone()` 中已有迭代 `activeToolCalls` 的循环，在此追加 TerminalLog 写入
- 过滤条件: `tc.kind === 'bash' || tc.kind === 'command'`
- 记录内容:
  ```typescript
  { id: toolCallId, command: tc.title, output: tc.output,
    cwd: currentWorkspacePath, exitCode: inferFromOutput, timestamp }
  ```
- **cwd 必填**: 从 ACP tool call 的 `rawInput?.cwd` 或 `workspacePath` 获取，保证重放时每个命令的目录上下文完整
- **exitCode**: 从输出内容推断（错误信息/状态），或从 ACP tool status 获取

**状态**: ⬜ 未开始

---

### P26-05: 命令重放回退 — 从 TerminalLog 重建终端上下文

**涉及文件**: `src/plugins/terminal/TaskTerminalManager.ts`（新建）, `src/plugins/terminal/TerminalPlugin.ts`（新建）

**调研步骤**:
1. 调研 VS Code `Pseudoterminal` API（`onDidWrite` 用于重放输出）
2. 确认重放策略：按时间戳顺序逐条 `writeEmitter.fire()` 已记录的命令+输出
3. 设计恢复流程：`loadTask()` 时自动检测 TerminalLog → 有则创建 replay-only 终端展示

**调研结果**:

**设计**:
```
┌─ 重放终端 ─────────────────────────────┐
│  $ pwd                                   │
│  /home/user/project                      │
│  $ npm install                          │
│  [...]                                   │
│  $ npm run build                        │
│  [...]                                   │
│                                          │
│  ⚡ 终端已恢复 (命令重放自日志)           │
│  [重新执行] [清空日志] [关闭]             │
└──────────────────────────────────────────┘
```

- **Pseudoterminal**: 创建 VS Code `Pseudoterminal`，`open()` 时从 TerminalLog 逐条读取，通过 `writeEmitter.fire()` 重放命令+输出到终端窗口
- **打开终端按钮**: 输入框底部工具栏「💻 终端」按钮，点击打开该任务的 TerminalLog 重放
- **进度显示**: 逐条显示重放进度（"2/15 命令已重放"），完成后通知用户
- **交互**: TerminalLog 内容只读展示（重放），不接收用户键盘输入
- **重新执行（未来）**: 将命令序列逐条发送到实际 shell 执行，实现真实沙箱状态恢复。MVP 只做只读重放，不执行
- **自动触发**: `loadTask()` 时自动检测 TerminalLog 是否有内容 → 有则在右栏或浮层显示重放入口

**状态**: ✅ 已完成


---

## Phase 27: TaskFlow 迭代循环 — execute ↔ self_verify 自动迭代

_目标：TaskFlow 引擎增加阶段间迭代循环能力，`biz_logic` 等任务类型通过 `flowIteration` 声明可使用 execute ↔ self_verify 自动循环，自验阶段实现分层校验 + 三路决策出口。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P27-01 | 调研设计 — 迭代循环方案与现有 flow 架构的融合 | ✅ 已完成 |

---

### P27-01: 调研设计 — TaskFlow 迭代循环方案

**涉及文件**:
- `src/types/index.ts` — Task 新增 `flowIteration` 字段；TaskTemplate 新增 `flowIteration` 预设；新增 `IterationRecord`/`TargetDef` 类型
- `src/taskflow/TaskFlow.ts` — `parseTaskUpdate`: finish_verify 分支增加 DECISION=continue 时直接 phase=execute 回切；`buildPhasePrompt`: 优化模式下追加迭代上下文注入；PROTOCOL_KEYS 增加 DECISION/METRICS/ITERATION
- `src/taskflow/prompts/self_verify.ts` — 优化模式追加分层校验规则（正确性红线 + 指标量化 + 三路决策）
- `src/taskflow/prompts/execute.ts` — 优化模式追加迭代上下文
- `src/taskflow/templates.ts` — `biz_logic` 增加 `flowIteration` 预设；`code_review` 增加 `flowOverride: [demand, goal, review]`
- `src/kcodeView/TaskFlowHandler.ts` — `deriveNodes()` 支持迭代计数；`sendTaskInfo()` 下发 flowIteration 状态
- `src/kcodeView/KCodePanel.ts` — `onSelfVerifyFinished` 处理 DECISION 判断
- `src/store/TaskStore.ts` — 新增迭代状态 CRUD 方法
- `src/kcodeView/webview/app.ts` — 进度节点显示迭代计数

**调研结果**:
- 核心设计：**不是"优化模式"作为独立概念，而是 TaskTemplate 通过 `flowIteration` 声明迭代能力，TaskFlow 引擎统一支持**
- 不同类型任务有不同的 flow：`requirement_dev` 线性一次过（无 `flowIteration`）、`biz_logic` 有 execute↔self_verify 循环（`flowIteration.enabled=true`）、`code_review` 跳过 execute（`flowOverride: [demand, goal, review]`）
- 最小改动路径：只改 `parseTaskUpdate` 中 finish_verify 处理分支，增加 DECISION=continue 时直接 phase=execute 回切（约 +5 行）
- 自验分层校验：Layer 1 正确性（一票否决）→ Layer 2 指标量化 → Layer 3 三路决策（达标/超限/停滞）
- 协议扩展：finish_verify 增加 DECISION/METRICS/ITERATION 字段
- 详细设计见 `docs/调研-08-优化迭代流程设计.md`

**状态**: 📋 已调研

---

## Phase 28: 插件化架构重构

_目标：将 KCode 重构为核心 + 插件双层架构。核心只剩小助手、任务处理、基础设施（~1200行）。Todo/Knowledge/Device/Demo/Review/Diff 全拆为独立插件，通过 ExtensionPointRegistry 挂钩，互不影响。_

### 核心定界

```
核心（不可缺）                   非核心 → 插件（可插拔）
├── 小助手模式                   ├── TodoPlugin（TODO 协议 + checkbox）
├── 任务模式（TaskFlow 状态机）   ├── KnowledgePlugin（知识萃取 + Wiki）
├── 三栏 WebView 布局            ├── DevicePlugin（远程设备 SSH/ADB）
├── ACP Agent 通信               ├── DemoPlugin（对话内演示）
├── MessageRouter                ├── ReviewDiffPlugin（增强 diff）
├── TaskStore / ProjectFs        ├── GitHubPlugin（Issue 导入）
└── AgentService                 ├── TerminalPlugin（P26 任务终端）
                                 └── SetupPlugin（环境引导检测）
```

**插件只在任务模式下激活**，小助手模式下全部静默。

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P28-01 | 基础设施 — PluginManager + ExtensionPointRegistry + PluginAPI | ✅ 已完成 | P0 |
| P28-02 | 剥离 DevicePlugin — 设备管理从 KCodePanel 提出 | ✅ 已完成 | P0 |
| P28-03 | 剥离 DemoPlugin — Demo 运行从 KCodePanel 提出 | ✅ 已完成 | P1 |
| P28-04 | 剥离 SetupPlugin — 环境引导检测提出 | ✅ 已完成 | P1 |
| P28-05 | 拆分 TaskFlowHandler — Todo/Knowledge/Review/Diff 分别提取 | ✅ 已完成 | P0 |
| P28-06 | WebView 侧插件化 — 动态注册消息渲染器 + UI 贡献 | ✅ 已完成 | P1 |
| P28-07 | 收尾 — 配置 + 文档 + 脚手架 | ✅ 已完成 | P2 |

---

### P28-01: 基础设施 — PluginManager + ExtensionPointRegistry

**涉及文件**:
- `src/core/plugin/PluginInterface.ts` — **新建**：KCodePlugin 接口 + PluginAPI 接口
- `src/core/plugin/PluginManager.ts` — **新建**：加载/激活/停用/聚合插件
- `src/core/plugin/ExtensionPointRegistry.ts` — **新建**：6 类扩展点注册中心
- `src/kcodeView/KCodePanel.ts` — 构造时初始化 PluginManager，传入 PluginAPI 实现
- `src/kcodeView/PanelContext.ts` — 新增 `pluginManager` 字段（可选，兼容过渡期）
- `package.json` — 新增 `kcode.plugins` 配置

**调研结果**:

**6 个扩展点**:

| EP | 名称 | 注册方式 | 触发时机 |
|----|------|---------|---------|
| EP1 | 消息路由 | `api.onMessage(type, handler)` | WebView 发消息时 |
| EP2 | TaskFlow 事件 | `api.onPhaseChanged/handler` | 阶段迁移时 |
| EP3 | Tool 调用 | `api.onToolCall(kind, handler)` | ACP tool_call 到达时 |
| EP4 | 流式处理 | `api.addStreamProcessor(proc)` | agent 文本 chunk 到达时 |
| EP5 | UI 贡献 | `api.addOutputPanelTab/renderer` | WebView 初始化时 |
| EP6 | 阶段钩子 | `api.registerPhaseHook(phase, hook)` | 进入/离开阶段时 |

**PluginAPI 实现原则**:
- 核心只提供 PluginAPI 接口实现
- 插件声明 `mode: 'task'` 时，扩展点只在任务模式激活
- 小助手模式下所有 task 插件静默

**实现说明**:
1. `PluginInterface.ts`: 定义 `KCodePlugin`（id/name/version/activate/deactivate）和 `PluginAPI`（6 类扩展点的注册方法 + 核心服务只读引用）
2. `PluginManager.ts`: 维护 `plugins: Map<string, KCodePlugin>`，`activateAll()` 遍历调用 activate，`deactivate(id)` 单个卸载
3. `ExtensionPointRegistry.ts`: 内部维护 6 个注册表 Map，`dispatch(type, payload)` 按类型分发；支持 `mode: 'task'` 过滤
4. `KCodePanel.ts`: 构造时创建 PluginManager，传入 PluginAPI 实现（router/store/taskFlow 等只读引用），调用 `loadCorePlugins()` 加载内置插件
5. 过渡期：KCodePanel.setupMessageHandler() 保留现有注册，新增的 `router.on()` 同时走 PluginManager 分发

**状态**: ✅ 已完成

---

### P28-02: 剥离 DevicePlugin

**涉及文件**:
- `src/plugins/device/DevicePlugin.ts` — **新建**：设备管理插件
- `src/plugins/device/DeviceManager.ts` — **新建**：从 KCodePanel 提取 handleDeviceConnect/Disconnect/Command
- `src/kcodeView/KCodePanel.ts` — 移除 deviceClients 字段、device 相关 inline 代码（-70 行）
- `src/kcodeView/webview/device.ts` — 不变（已在 WebView 侧独立）
- `src/device/LocalDeviceClient.ts` — 不变
- `src/device/DishCliDeviceClient.ts` — 不变
- `src/device/DeviceClientFactory.ts` — 不变

**实现说明**:
1. `DeviceManager` 封装：`deviceClients: Map`、`handleConnect/disconnect/command`、`dispose()`
2. `DevicePlugin.activate(api)`: 注册 `onMessage('deviceConnect')` 路由到 DeviceManager
3. KCodePanel 不再持有 `deviceClients`，由 DevicePlugin 自行管理
4. DemoPlugin 通过 `dependencies: ['kcode.device']` 声明依赖，通过 PluginAPI 获取 DeviceManager 引用

**状态**: ✅ 已完成

---

### P28-03: 剥离 DemoPlugin

**涉及文件**:
- `src/plugins/demo/DemoPlugin.ts` — **新建**：Demo 运行插件
- `src/plugins/demo/DemoRunner.ts` — **新建**：从 KCodePanel 提取 handleDemoRun/Stop
- `src/kcodeView/KCodePanel.ts` — 移除 demo 相关 inline 代码（-85 行）
- `src/kcodeView/webview/app.ts` — `handleDemoCardUpdate` 保留（是 UI 渲染，不是业务逻辑）
- `src/kcodeView/templates/chatPanelCss.ts` — demo-card-* 样式保留

**实现说明**:
1. `DemoRunner` 封装：`_activeDemoAbort`、`handleRun(config)`、`handleStop(cardId)`
2. `DemoPlugin.activate(api)`: 注册 `onMessage('demoRun'/'demoStop'/'demoRerun')`，内部调用 DemoRunner
3. DemoPlugin 对设备的使用：`api.getPlugin('kcode.device').deviceManager.exec()`
4. WebView 侧 `handleDemoCardUpdate` 保持不动（UI 渲染独立）

**状态**: ✅ 已完成

---

### P28-04: 剥离 SetupPlugin

**涉及文件**:
- `src/plugins/setup/SetupPlugin.ts` — **新建**：环境引导检测插件
- `src/plugins/setup/EnvDetector.ts` — **新建**：从 KCodePanel 提取 _runEnvSetup/_streamModelConfig
- `src/kcodeView/KCodePanel.ts` — 移除 setup 相关代码（-55 行）
- `src/kcodeView/SetupWizard.ts` — 不变（已经是纯函数模块）

**实现说明**:
1. `EnvDetector` 封装环境检测 + 流式安装逻辑
2. `SetupPlugin.activate(api)`: 注册 `onMessage('runEnvSetup'/'checkEnv')`
3. `_streamModelConfig` 负责将 model 配置流式展示到 WebView

**状态**: ✅ 已完成

---

### P28-05: 拆分 TaskFlowHandler — Todo/Knowledge/Review/Diff

**涉及文件**:
- `src/plugins/todo/TodoPlugin.ts` — **新建**：todo 卡片 + checkbox 交互 + planSteps 同步
- `src/plugins/knowledge/KnowledgePlugin.ts` — **新建**：知识条目解析 + 存储 + Wiki 导出
- `src/plugins/review/ReviewPlugin.ts` — **新建**：审核变更管理 + approve/reject/partial
- `src/plugins/diff/DiffPlugin.ts` — **新建**：diff 预览 + 原生 diff 打开
- `src/plugins/delegate/DelegationPlugin.ts` — **新建**：任务委派 + Chat→Task 转换
- `src/kcodeView/TaskFlowHandler.ts` — 从 550 行精简到 ~100 行，只保留 5 阶段编排
- `src/kcodeView/PanelContext.ts` — 从 25 成员缩到 ~12 个核心方法

**实现说明**:

| 插件 | 挂钩的扩展点 | 从 TaskFlowHandler 移出行数 |
|------|-------------|--------------------------|
| TodoPlugin | `onToolCall('todowrite')` + `onMessage('updateTodoItem')` + `addMessageRenderer('todo')` | ~40 行 |
| KnowledgePlugin | `addStreamProcessor`（扫描 `<KNOWLEDGE_ENTRY>`）+ `onGoalFormatted`（沉淀）+ `onMessage('exportToWiki')` | ~60 行 |
| ReviewPlugin | `onToolCall`（收集变更）+ `onPhaseChanged`（显示审核）+ `onMessage('approveReview'/'rejectReview')` | ~120 行 |
| DiffPlugin | `onMessage('showFileDiff'/'openNativeDiff')` + `addOutputPanelTab('diff')` | ~30 行 |
| DelegationPlugin | `addStreamProcessor`（扫描 `<TASK_DELEGATE>`）+ `onMessage('convertToTask')` | ~40 行 |

**精简后 TaskFlowHandler** 只保留：
- `handleConfirmGoal/Revise/Cancel` — 目标确认
- `handleConfirmPlan/Reject` — 计划确认
- `handleConfirmExecuteDone` — 执行完成
- `handleApproveRejectReview` — 验收编排（变更收集交给 ReviewPlugin）
- `sendTaskInfo` / `sendNodePanelUpdate` — 看板刷新（核心 UI）

**状态**: ✅ 已完成

---

### P28-06: WebView 侧插件化

**涉及文件**:
- `src/kcodeView/webview/app.ts` — 新增 `PluginRegistry` 管理 UI 贡献；`addMessageRenderer()`/`addOutputPanelTab()` 注册函数；新增 `pluginContributions` 消息处理 Extension 推送的插件声明
- `src/kcodeView/webview/outputPanel.ts` — 渲染由插件注册的 tab 替代硬编码
- `src/kcodeView/webview/sidebar.ts` — 插件可注册侧边栏操作按钮

**实现说明**:
1. `PluginRegistry`（WebView 侧）：`messageRenderers: Map<string, RenderFn>`、`outputPanelTabs: Tab[]`、`toolbarButtons: Button[]`
2. Extension → WebView 通过 `pluginContributions` 消息推送插件声明（消息类型 + tab 定义 + 按钮定义）
3. `app.ts` 中的渲染函数按 `renderMessages()` 时查 `messageRenderers` 渲染非内置消息类型
4. `outputPanel.ts` 的 tab 栏改为从 `pluginContributions` 动态构建

**状态**: ✅ 已完成

---

### P28-07: 收尾 — 配置 + 文档 + 脚手架

**涉及文件**:
- `src/types/config.ts` — `KCodeConfig` 新增 `plugins` 字段 + `KNOWN_KEYS` 注册
- `src/core/ConfigService.ts` — `_writeFile` 的 `knownKeys` 加入 `plugins`
- `src/core/plugin/PluginManager.ts` — 接受 `ConfigService`，新增 `loadConfig()`/`saveConfig()`/`enablePlugin()`/`disablePlugin()`/`isPluginEnabled()`，activate/deactivate 自动持久化状态
- `src/kcodeView/KCodePanel.ts` — 传入 `configService` 给 PluginManager；新增 `enablePlugin`/`disablePlugin`/`getPluginList` 消息路由 + `sendPluginList()`
- `docs/plugin-dev-guide.md` — **新建**：插件开发文档（接口说明 + 示例代码 + 调试技巧）
- `src/plugins/_template/TemplatePlugin.ts` — 已有插件脚手架示例（31 行）

**实现说明**:
1. `ConfigService` 存储 `plugins: { [id]: { enabled: true, config: {...} } }`
2. KCodePanel 注册 `enablePlugin`/`disablePlugin`/`getPluginList` 三条消息路由，WebView 可热开关插件
3. 插件热开关：`PluginManager.disablePlugin(id)` → 持久化禁用状态 + `deactivate()` 清理扩展点；`enablePlugin(id)` → 持久化启用状态 + `activate()`
4. 示例插件 `TemplatePlugin.ts` 已存在（31 行），覆盖 `onMessage`/`onToolCall`/`addOutputPanelTab` 三种扩展点
5. `docs/plugin-dev-guide.md` 覆盖插件接口 API、扩展点说明、内置插件列表、调试技巧
6. `isPluginEnabled()` 方法可按 id 查询插件的启用/禁用状态

**状态**: ✅ 已完成

---

## Phase 29: 三张卡片工作台模式

_目标：实现「人定决策、AI 做执行」的工程化新范式。在现有三栏布局基础上，推出"三张卡片"视图模式——目标&方案卡片、执行&自检卡片、变更验收卡片——替代聊天流为主视图，卡片专属评论区替代全局消息平铺。对话模式保留为小助手兼容兜底。_

**设计文档**: `docs/产品方案/KCode AI 编码工作台终版产品方案.md`

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P29-01 | 双模式切换架构 — 内核层模式标识 + 视图层一键切换（卡片模式/对话模式） | ✅ 已完成 | P0 |
| P29-02 | 卡片1 目标&方案卡片 — V1.0 自动生成 + 方案版本迭代（V1.0→V1.N→锁定）+ 改动文件清单/风险等级/边界约束 | ✅ 已完成 | P0 |
| P29-03 | 卡片2 执行&自检卡片 — AI 全权执行视图（进度摘要 + 构建测试结果 + 自检报告 + 终端日志折叠）；execute+self_verify 阶段用户输入锁定 | ✅ 已完成 | P0 |
| P29-04 | 卡片3 变更验收卡片 — 自动化测试通过证明 + 人工验证指引 + UI 核验入口 + 预设理由驳回 | ✅ 已完成 | P0 |
| P29-05 | 卡片评论区（楼中楼）— 每张卡片专属子对话，沟通绑定当前卡片版本，不污染全局上下文 | ✅ 已完成 | P1 |
| P29-06 | 结构化交互升级 — 95% 操作纯点击：方案勾选微调、驳回预设理由、短批注替代长打字 | ⬜ 未开始 | P1 |

### P29-01: 双模式切换架构 — 内核层模式标识 + 视图层一键切换
...
**状态**: ✅ 已完成

---

