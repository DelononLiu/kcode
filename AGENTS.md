# KCode — 项目指南 for AI Agents

> **📖 先读 `PROJECT.md`** — 包含完整的文件导出、消息协议、数据流索引，避免重复全局搜索。
> **📋 任务在 `TASKS.md`** — 每个任务包含涉及文件、调研结果、状态，新 session 直接定位无需重扫工程。

## 项目定位

KCode 是一个 VS Code 扩展，参考 ZCode ADE 设计理念，聚焦 **Task 管理 + AI 对话** 驱动的开发模式。文件编辑复用 VS Code 原生能力。

## 项目结构

```
kcode/
├── package.json
├── tsconfig.json
├── AGENTS.md
├── PROJECT.md                # 项目参考手册，包含文件索引、MVP 状态、Phase 计划
├── resources/kcode.png       # 扩展图标
└── src/
    ├── extension.ts                 # 入口: activate/deactivate, 注册命令 + 侧边栏 Provider
    ├── kcodeView/
    │   ├── KCodePanel.ts            # WebviewPanel (编辑器区域: 聊天 + 右侧面板)
    │   ├── KCodeSidebarProvider.ts   # WebviewViewProvider (左侧 activity bar 侧边栏视图)
    │   └── webview/
    │       ├── style.css            # 未引用(样式内联在 KCodePanel.ts)
    │       ├── app.ts               # 主逻辑: 布局交互, 消息分派
    │       ├── sidebar.ts           # 左侧栏: 任务列表渲染
    │       ├── chat.ts              # 空壳(渲染逻辑在 app.ts)
    │       ├── preview.ts           # 右侧面板: Preview/Diff/WebView
    │       └── device.ts            # 右侧面板: Device tab
    ├── commands/
    │   ├── newTask.ts               # 新建任务 (输入标题)
    │   └── selectTask.ts
    ├── acp/
    │   ├── AcpClient.ts             # ACP ClientSideConnection 封装
    │   ├── AgentManager.ts          # Agent 子进程 spawn/管理
    │   ├── FakeAgent.ts             # FakeAgent 调试模式
    │   ├── OpenAIAgent.ts           # OpenAI Agent (通过 HTTP 调用 OpenAI API)
    │   └── callbacks.ts             # Client 回调(文件读写/权限/sessionUpdate)
    ├── store/
    │   └── TaskStore.ts             # CRUD: 任务 / 消息
    └── types/
        └── index.ts                 # Task, ChatMessage 等类型
```

## 构建与调试

```bash
npm run compile       # 编译 TypeScript → out/
npm run watch         # 监听模式自动编译
npm run package       # 打包为 vsix (via @vscode/vsce)
npm run build:install # 打包 + 安装到 VS Code
npx tsc --noEmit      # 仅类型检查
```

调试配置在 `.vscode/launch.json`:
- **Run Extension**: F5 启动，先编译再打开扩展开发窗口
- **Run Extension (Watch)**: 以 watch 模式启动

F5 后，左侧 activity bar 出现 KCode 图标，点击图标显示侧边栏视图。
`Ctrl+Shift+P` → `KCode: Open` 聚焦侧边栏。
在侧边栏点击任务 → 编辑器区域打开聊天面板。

---

## 开发流程 (每次 session 必须遵守)

根据 TASKS.md 中任务的 **涉及文件** 和 **状态** 决定走哪条路：

```
                    ┌──────────────────────────┐
                    │ 读 TASKS.md 定位任务条目   │
                    └──────────┬───────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
         涉及文件为空                   涉及文件已填充
                 │                           │
                 ▼                           ▼
    ┌─────────────────────┐    ┌──────────────────────┐
    │ 🔍 调研             │    │ 🛠️ 实现              │
    │                     │    │                      │
    │ 1. 读 PROJECT.md    │    │ 1. 读涉及文件列表     │
    │ 2. 打开目标文件      │    │ 2. 按需求编码         │
    │ 3. 确认接口/类型     │    │ 3. npx tsc --noEmit   │
    │ 4. 填充涉及文件列表   │    │ 4. npm run build:install │
    │ 5. 状态 → 📋 已调研  │    │ 5. 更新 TASKS.md 状态  │
    │ 6. 输出结果，停止     │    │     → ✅ 已完成       │
    └─────────────────────┘    │ 6. 输出总结，停止      │
                               └──────────────────────┘
```

**禁止**: 不要 glob/grep 搜全工程。文件定位只从 `PROJECT.md` 或「涉及文件」列表读取。

### 调研 (涉及文件为空)
- 读 `PROJECT.md` → 定位目标文件 → 打开确认接口/类型
- 填充到 `TASKS.md` 的「涉及文件」字段，状态改为 📋 已调研
- 输出结果，**结束会话**

### 实现 (涉及文件已填充)
- 只读「涉及文件」列表，**零全局搜索**
- 按需求编码 → `npx tsc --noEmit` → `npm run build:install`
- 更新 `TASKS.md` 状态为 ✅ 已完成
- 输出改动总结 + 验收步骤，**结束会话**

### 任务条目格式

```markdown
## P1-02: 侧边栏重构为三区块

**涉及文件**: _待调研_
**调研步骤**:
1. 读 PROJECT.md → 定位 KCodeSidebarProvider、sidebar.ts
2. 打开两个文件确认渲染逻辑

**调研结果**:
- `src/kcodeView/KCodeSidebarProvider.ts` — getHtml()、refresh()
- `src/kcodeView/webview/sidebar.ts` — renderTaskList()
- `src/types/index.ts` — Task interface

**状态**: ⬜ 未开始
```

---

## 开发约定

> **🚨 严禁自动提交代码** — 任何情况下 AI 不得自行执行 `git commit`。必须等待用户明确要求提交后，再执行操作。

1. **不要引入 UI 框架** — WebView 使用 Vanilla JS，保持轻量
2. **不要添加多余的 error handling** — 只在系统边界（用户输入、外部 API）做校验
3. **不要写注释** — 除非有非显而易见的 WHY（隐藏约束、微妙的不变性、特定 bug 的 workaround）
4. **消息类型需同步更新** — 新增 `postMessage` 类型时，同时在 `app.ts` 的 `initMessageHandler` 中注册处理器
5. **数据存储用 `workspaceState`** — 不要用文件系统存储，不要用全局变量持久化
6. **ACP Client 回调 auto-accept 权限** — MVP 阶段不做权限 UI
7. **使用中文**

---

## 常见操作指引

### 提交代码

用户要求提交时，使用 `/gci` 命令，AI 会自动完成分析、stage、commit 全流程。

提交消息遵循 `type: 简短描述` 格式：
- `feat` — 新功能 | `fix` — 修复 bug | `refactor` — 重构 | `docs` — 文档 | `chore` — 构建/工具
- 简短描述不超过 50 字，正文说明**为什么**改
- 使用中文

### 新增一个命令

1. 在 `src/commands/` 下新建文件，导出一个 async 函数
2. 在 `package.json` 的 `contributes.commands` 中注册
3. 在 `src/extension.ts` 中 `vscode.commands.registerCommand` 并 push 到 `context.subscriptions`

### 新增 WebView 消息类型

1. Extension → WebView (KCodePanel)：在 `KCodePanel.ts` 中调用 `webview.postMessage`，在 `app.ts` 的 `initMessageHandler` switch 中添加 case
2. WebView → Extension (KCodeSidebarProvider)：在 WebView 中调用 `vscode.postMessage`，在 `KCodeSidebarProvider` 的 `onDidReceiveMessage` switch 中添加 case

### 新增右侧面板 Tab

1. 在 `KCodePanel.ts` 的 `getWebviewContent()` HTML 中添加 tab 按钮和 tab-content 容器
2. 新建 `src/kcodeView/webview/xxx.ts` 实现渲染逻辑
3. 在 `preview.ts` 或新建文件中暴露全局函数，在 `app.ts` 消息处理中调用
4. 在 `style.css` 中添加对应样式
