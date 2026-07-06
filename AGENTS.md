# KCode — 项目指南 for AI Agents

> **📖 先读 `PROJECT.md`** — 包含完整的文件导出、消息协议、数据流索引，避免重复全局搜索。
> **📋 任务在 `TASKS.md`** — 每个任务包含涉及文件、调研结果、状态，新 session 直接定位无需重扫工程。

## 项目定位

KCode 是一个 VS Code 扩展，参考 ZCode ADE 设计理念，聚焦 **Task 管理 + AI 对话** 驱动的开发模式。文件编辑复用 VS Code 原生能力。

## OpenWiki

This repository has documentation located in the /openwiki directory.

Start here:
- [OpenWiki quickstart](openwiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.

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
    ├── view/
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

根据 TASKS.md 中任务的类型决定走哪条路：

```
                    ┌──────────────────────────┐
                    │ 读 TASKS.md 定位任务条目   │
                    └──────────┬───────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
           🆕 功能开发                   🐛 问题解决
                 │                           │
                 ▼                           ▼
    ┌─────────────────────┐    ┌──────────────────────────┐
    │ 先调研，再实现        │    │ 1. 调研               │
    │                     │    │ 2. 先写会失败的新测试       │
    │ 🔍 调研              │    │ 3. 修复代码               │
    │  涉及文件为空 →       │    │ 4. 跑全量测试             │
    │  读 PROJECT.md       │    └──────────────────────────┘
    │  打开目标文件确认      │
    │  填充涉及文件列表      │
    │  状态 → 📋 已调研     │
    │                     │
    │ 🛠️ 实现              │
    │  涉及文件已填充 →      │
    │  按需求编码           │
    │  npx tsc --noEmit    │
    │  更新状态 → ✅ 已完成  │
    └─────────────────────┘
```

**禁止**: 不要 glob/grep 搜全工程。文件定位只从 `PROJECT.md` 或「涉及文件」列表读取。

---

### 🆕 功能开发

#### 调研 (涉及文件为空)
- 读 `PROJECT.md` → 定位目标文件 → 打开确认接口/类型
- 填充到 `TASKS.md` 的「涉及文件」字段，状态改为 📋 已调研
- 输出结果，**结束会话**

#### 实现 (涉及文件已填充)
- 只读「涉及文件」列表，**零全局搜索**
- 按需求编码 → `npx tsc --noEmit` → `npm run build:install`
- 更新 `TASKS.md` 状态为 ✅ 已完成
- 输出改动总结 + 验收步骤，**结束会话**

---

### 🐛 问题解决

遇到 Bug 时，严格按照以下流程执行：

```
1. 调研 → 2. 先写会失败的新测试 → 3. 修复代码 → 4. 跑全量测试
```

**详细步骤**:

1. **调研** — 描述现象，阅读相关代码理解上下文，定位根因（CSS/类型/逻辑），确认具体文件+行号
2. **先写测试** — 新增（或修改）测试用例，运行**确认新测试在旧代码上失败**，证明测试能捕获该 bug
3. **修复代码** — 只改必要的代码解决问题
4. **跑全量测试** — `npx vitest run`，确认全部通过

> **原则**: 在修复之前，测试必须能证明 bug 存在。通过后再修复。

---

### 任务条目格式

```markdown
## P1-02: 侧边栏重构为三区块

**涉及文件**: _待调研_
**调研步骤**:
1. 读 PROJECT.md → 定位 KCodeSidebarProvider、sidebar.ts
2. 打开两个文件确认渲染逻辑

**调研结果**:
- `src/view/KCodeSidebarProvider.ts` — getHtml()、refresh()
- `src/view/webview/sidebar.ts` — renderTaskList()
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

### WebView 渲染原则（违反即拒绝 PR）

1. **数据驱动 UI** — 所有 DOM 变更必须通过 `stateManager → subscriber → render` 单向流。禁止直接从消息处理函数操作 DOM（`style.display`、`classList`、`innerHTML` 全量重置、直接 `appendChild`）。
2. **折叠/展开是数据属性** — 一切 UI 状态（折叠、展开、卡片类型）必须是 `ChatMessage` 或 `AppState` 的字段，不能存于 DOM 类名或模块级变量。
3. **单一渲染入口** — `#chat-messages` 的写入只能经由 `renderManager`（或等效唯一模块），禁止多处散点操作同一 DOM 子树。
4. **订阅机制必须被消费** — 定义 `subscribe` 的地方必须存在至少一个调用方，否则是死代码，合入即技术债。

5. **流式增量追加，禁止全量替换** — stream chunk 到达时只能 `element.append()` 或拼接后替换单个子节点，不能 `element.innerHTML = x` 全量重建。全量替换导致光标丢失、选择状态重置、浏览器重解析整个 HTML。

6. **状态必须通过 stateManager，禁止模块级 `let` 可变变量** — 任何跨渲染持久化的值（stream 引用、折叠状态、初始化标记）都必须作为 `AppState` 或 `ChatMessage` 的字段，不能存于模块顶层 `let _xxx`。模块级变量在任务切换时泄漏，不受订阅机制管理。

> 具体验证检查点见对应架构计划文件（`.kilo/plans/*-arch.md`）。违反上述原则的 PR 不予合入，直至修复。

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

---

## 阶段钩子（kcode-hooks）

在 AGENTS.md 中定义，AI 切换到对应阶段时自动注入提示词。支持 `execute` / `self_verify` / `plan` / `goal` / `demand` / `review` 共 6 个阶段。

示例：

```markdown
## kcode-hooks:execute
查看当前时间 date
先运行 npm run lint
- 写测试

## kcode-hooks:self_verify
运行 npm test
```

每行一条命令，可用 `- ` 前缀也可纯文本。项目全局钩子在编辑器里只读显示，"任务钩子"按钮可打开全阶段概览。

---

### 新增右侧面板 Tab

1. 在 `KCodePanel.ts` 的 `getWebviewContent()` HTML 中添加 tab 按钮和 tab-content 容器
2. 新建 `src/view/webview/xxx.ts` 实现渲染逻辑
3. 在 `preview.ts` 或新建文件中暴露全局函数，在 `app.ts` 消息处理中调用
4. 在 `style.css` 中添加对应样式

<!-- CODEGRAPH_START -->
## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.

### When to prefer codegraph over native search

Use codegraph for **structural** questions — what calls what, what would break, where is X defined, what is X's signature. Use native grep/read only for **literal text** queries (string contents, comments, log messages) or after you already have a specific file open.

| Question | Tool |
|---|---|
| "How does X work? / trace X / explain a system / architecture" | `codegraph_explore` (seed with symbol names) |
| "Where is X defined?" / "Find symbol named X" | `codegraph_search` |
| "What calls function Y?" | `codegraph_callers` |
| "What does Y call?" | `codegraph_callees` |
| "What would break if I changed Z?" | `codegraph_impact` |
| "Show me Y's signature / source / docstring" | `codegraph_node` |
| "Give me focused context for a task/area" | `codegraph_context` |
| "What files exist under path/" | `codegraph_files` |
| "Is the index healthy?" | `codegraph_status` |

### Rules of thumb

- **`codegraph_explore` is the workhorse for understanding questions** ("how does X work", "trace…", "explain the Y system"). Feed it the key symbol/file names and read its output (line-numbered source from many files in one call). If the question names nothing concrete, do one quick `codegraph_search`/`codegraph_context` to surface the names, then explore with them. Fill gaps with `codegraph_node`/Read — don't grep-and-read your way through; that's the loop explore replaces.
- **Delegating exploration to a subagent?** Tell it to call `codegraph_explore` first and trust the result. A generic "explore"-style agent defaults to grep+Read and treats codegraph as just a search index, throwing away the token savings.
- **Trust codegraph results.** They come from a full AST parse. Do NOT re-verify them with grep — that's slower, less accurate, and wastes context.
- **Don't grep first** when looking up a symbol by name. `codegraph_search` is faster and returns kind + location + signature in one call.
- **Index lag**: the file watcher debounces ~500ms behind writes; don't re-query immediately after editing a file in the same turn.

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Ask the user: *"I notice this project doesn't have CodeGraph initialized. Want me to run `codegraph init -i` to build the index?"*
<!-- CODEGRAPH_END -->
