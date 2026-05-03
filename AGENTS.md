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
├── .kilo/
│   └── tasks.md              # 任务注册中心，每个 session 从这里开始
├── PROJECT.md                # 项目参考手册，包含文件索引、MVP 状态、Phase 计划
├── resources/icon.svg        # 扩展图标
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
npx tsc --noEmit      # 仅类型检查
```

调试配置在 `.vscode/launch.json`:
- **Run Extension**: F5 启动，先编译再打开扩展开发窗口
- **Run Extension (Watch)**: 以 watch 模式启动

F5 后，左侧 activity bar 出现 KCode 图标，点击图标显示侧边栏视图。
`Ctrl+Shift+P` → `KCode: Open` 聚焦侧边栏。
在侧边栏点击任务 → 编辑器区域打开聊天面板。

---

## 开发流程 (Agent 工作流)

开发流程分为两个层级：**宏观 5 步**（每次 AI session 的骨架）和 **微观 Task 生命周期**（在"实现"步骤内部的精细控制）。

### 宏观流程 (每次开发必须遵守)

```
1. 读索引   ──  读 3 个文件定位目标
2. 定计划   ──  确认本次做什么、怎么做
3. 实现     ──  根据 Task 状态选择微观路径（见下方）
4. 验收     ──  编译通过 + 改动完整
5. 更新文档 ──  更新索引、任务状态
6. 停止     ──  输出本次改动的总结，**然后结束会话，不再继续交互**
```

---

**步骤 1 — 读索引**

依次读这 2 个文件：

| 顺序 | 文件 | 目的 |
|------|------|------|
| 1 | `PROJECT.md` | 项目模块索引、文件导出、消息协议 |
| 2 | `TASKS.md` | 定位具体任务条目，获取「涉及文件」「调研步骤」「关键函数」 |

**禁止**：不要 glob 搜索整个工程，不要 grep 全局搜关键字。所有文件定位应来自 `PROJECT.md` 或 task 的「涉及文件」列表。

---

**步骤 2 — 定计划**

- 读 `tasks.md` 中对应任务的「涉及文件」和「调研结果」
- 如果任务状态是 📋 已调研，直接确认方案
- 如果任务状态是 ⬜ 未开始，用 `EnterPlanMode` 规划调研方向
- 调用 `ExitPlanMode` 让用户确认

---

**步骤 3 — 实现**

根据 Task 的「涉及文件」状态，走两条路径之一：

```
                 ┌────────────────────────────────────┐
                 │   读 tasks.md 中对应任务条目        │
                 └──────────┬─────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
      涉及文件为空                   涉及文件已填充
              │                           │
              ▼                           ▼
    ┌──────────────────┐       ┌──────────────────────┐
    │ 🔍 调研阶段      │       │ 🛠️ 实现阶段         │
    │                  │       │                      │
    │ 1. 读 project-   │       │ 1. 读涉及文件列表    │
    │    index.md       │       │     （精准打开，     │
    │ 2. 打开目标文件   │       │      不做搜索）      │
    │ 3. 确认接口/类型  │       │ 2. 按需求编码        │
    │ 4. 填充涉及文件   │       │ 3. npx tsc --noEmit  │
     │ 5. 状态→📋已调研  │       │ 4. 状态→✅已完成    │
     │ 6. 输出给用户确认  │       │                      │
     │    **然后停止**     │       │                      │
     └──────────────────┘       └──────────────────────┘
```

**调研阶段**（涉及文件为空时）：
- 只读 `PROJECT.md` + 通过索引定位到的目标文件
- 不 glob、不 grep、不遍历 `src/`
- 调研结果填充到 `tasks.md` 的「涉及文件」字段，状态改为 📋 已调研
- 输出调研结果，**然后结束会话，不再继续交互**

**实现阶段**（涉及文件已填充时）：
- 只读「涉及文件」列出的文件，**零次全局搜索**
- 修改完成后确保 `npx tsc --noEmit` 通过
- 更新 `tasks.md` 状态为 ✅ 已完成
- 输出本次改动的总结，**然后结束会话，不再继续交互**

---

**步骤 4 — 验收**

- `npm run compile` 确保零错误
- 检查改动的完整性：涉及的文件是否全部修改到位
- 如果涉及 UI 变化，说明 F5 后如何验证

---

**步骤 5 — 更新文档**

- 如果新增/移动/删除文件 → 更新 `AGENTS.md` 项目结构图 + `PROJECT.md` 目录结构
- 如果新增消息类型 → 更新 `PROJECT.md` 通信协议部分
- 更新 `TASKS.md` 中对应任务的状态

---

### Task 生命周期 (微观)

`TASKS.md` 中的每个任务经历以下状态流转：

```
⬜ 未开始
    │  涉及文件为空
    ▼
🔍 调研中  ← AI 读 PROJECT.md 定位目标，填充「涉及文件」
    │
    ▼
📋 已调研  ← 「涉及文件」已填充，待用户确认后实现
    │
    ▼
🛠️ 实现中  ← AI 只读「涉及文件」列表，不做全量搜索
    │
    ▼
✅ 已完成  ← **停止：输出本次改动的总结并结束会话，不再继续交互**
```

任务条目格式：

```markdown
## P1-02: 侧边栏重构为三区块

**涉及文件**: _待调研_     ← 新任务此处为空
**调研步骤**:
1. 读 PROJECT.md → 定位 KCodeSidebarProvider、sidebar.ts
2. 打开两个文件确认渲染逻辑

**调研结果**: (调研后填充)
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

### Git 提交消息格式

```
<类型>: <简短描述>

[可选正文]

[可选 footer]
```

**类型**：
- `feat` — 新功能
- `fix` — 修复 bug
- `refactor` — 重构（无功能变化）
- `docs` — 文档更新
- `chore` — 构建/工具/依赖变更

**规则**：
- 简短描述不超过 50 字，句末不加句号
- 正文说明**为什么**改，不说明**是什么**
- 使用中文

**示例**：
```
feat: 补全 WebView↔Extension 消息类型

- 新增 deleteTask/addUserMessage/focusInput 消息
- 修正 loadMessages 缺少 taskId 字段

关闭 #12
```

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
