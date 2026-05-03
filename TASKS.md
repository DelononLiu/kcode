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

## Phase 1: Task 骨架

_目标：建立 Task 驱动的开发模式基础，实现任务管理与 AI 对话的基础集成。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P1-01 | 扩展骨架激活/停用 | ✅ 已完成 |
| P1-02 | kcode.open / kcode.newTask 命令注册 | ✅ 已完成 |
| P1-03 | 任务创建、选择、删除 CRUD | ✅ 已完成 |
| P1-04 | 侧边栏 WebviewViewProvider 注册 | ✅ 已完成 |
| P1-05 | 任务列表扁平展示于侧边栏 | ✅ 已完成 |
| P1-06 | 点击任务加载对话历史 | ✅ 已完成 |
| P1-07 | Task 与 ACP Session 一对一绑定 | ✅ 已完成 |

**验收标准**：侧边栏可正常创建和管理任务，AI 对话内容与任务绑定存储。

## Phase 2: AI 对话完整化

_目标：完善 AI 对话体验，配置可自定义，连接状态可知。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P2-01 | Agent 路径可配置（kcode.agentPath） | ✅ 已完成 |
| P2-02 | Agent 连接状态实时反馈 | ✅ 已完成 |
| P2-03 | 对话支持流式输出 | ✅ 已完成 |
| P2-04 | 用户消息即时渲染 | ✅ 已完成 |
| P2-05 | Markdown 渲染（粗体/斜体/链接/换行） | ✅ 已完成 |
| P2-06 | 输入框 + 发送按钮（Enter/点击） | ✅ 已完成 |

**验收标准**：用户可配置 Agent，连接状态可见，对话流畅无阻塞。

## Phase 3: 体验打磨

_目标：提升交互体验，完善右侧预览面板，引入分组和验收流程。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P3-01 | 侧边栏分组管理（已置顶/普通任务/分组） | 📋 已调研 |
| P3-02 | 验收流程（Agent回复→验收按钮→diff预览→确认/驳回） | ⬜ 未开始 |
| P3-03 | 右侧面板 Tab 默认引导内容 | ⬜ 未开始 |
| P3-04 | 右键菜单扩展（归档、置顶、移出分组） | ⬜ 未开始 |

**验收标准**：侧边栏支持分组和折叠，验收流程可闭环，右侧面板体验友好。

---

## 已完成任务详情

### P1-01: 扩展骨架激活/停用
**涉及文件**: `src/extension.ts`
**状态**: ✅ 已完成

### P1-02: kcode.open / kcode.newTask 命令注册
**涉及文件**: `src/extension.ts`
**状态**: ✅ 已完成

### P1-03: 任务创建、选择、删除 CRUD
**涉及文件**: `src/store/TaskStore.ts`, `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/webview/sidebar.ts`
**状态**: ✅ 已完成

### P1-04: 侧边栏 WebviewViewProvider 注册
**涉及文件**: `src/kcodeView/KCodeSidebarProvider.ts`
**状态**: ✅ 已完成

### P1-05: 任务列表扁平展示于侧边栏
**涉及文件**: `src/kcodeView/webview/sidebar.ts`
**状态**: ✅ 已完成

### P1-06: 点击任务加载对话历史
**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/store/TaskStore.ts`
**状态**: ✅ 已完成

### P1-07: Task 与 ACP Session 一对一绑定
**涉及文件**: `src/acp/AcpClient.ts`
**状态**: ✅ 已完成

### P2-01: Agent 路径可配置
**涉及文件**: `src/acp/AgentManager.ts`
**状态**: ✅ 已完成

### P2-02: Agent 连接状态实时反馈
**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/acp/callbacks.ts`
**状态**: ✅ 已完成

### P2-03: 对话支持流式输出
**涉及文件**: `src/acp/AcpClient.ts`, `src/kcodeView/KCodePanel.ts`
**状态**: ✅ 已完成

### P2-04: 用户消息即时渲染
**涉及文件**: `src/kcodeView/webview/app.ts`
**状态**: ✅ 已完成

### P2-05: Markdown 渲染
**涉及文件**: `src/kcodeView/webview/app.ts`
**状态**: ✅ 已完成

### P2-06: 输入框 + 发送按钮
**涉及文件**: `src/kcodeView/webview/app.ts`
**状态**: ✅ 已完成

## Phase 3 任务详情

### P3-01: 侧边栏分组管理
**涉及文件**: `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/webview/sidebar.ts`
**调研结果**:
- UI 设计参考 `PROJECT.md > UI 设计 > 整体布局`（左侧栏）
- `KCodeSidebarProvider.ts` — `resolveWebviewView()` 设置 HTML/JS，`refresh()` 发更新
- `sidebar.ts` — `renderTaskList(tasks)` 渲染扁平列表，需改为分组渲染
- `types/index.ts` — Task 类型需增加 `pinned`、`group` 字段
**状态**: 📋 已调研

### P3-02: 验收流程
**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`, `src/kcodeView/webview/preview.ts`, `src/acp/callbacks.ts`, `src/types/index.ts`
**调研结果**:
- UI 设计参考 `PROJECT.md > UI 设计 > 聊天面板布局`（验收按钮）
- `KCodePanel.ts` — 扩展侧处理 ACP 回调，收集文件变更，通知 WebView
- `app.ts` — `initMessageHandler` 添加验收相关消息处理器
- `preview.ts` — `showDiff(original, modified)` 已实现
- `callbacks.ts` — `writeTextFile()` 需记录变更文件的原内容和新内容
**状态**: ⬜ 未开始

### P3-03: 右侧面板 Tab 默认引导内容
**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`
**调研结果**:
- UI 设计参考 `PROJECT.md > UI 设计 > 右侧面板布局`
- `KCodePanel.ts` — `getWebviewContent()` HTML 中右侧面板 Tab 内容区
- `app.ts` — 右侧面板加载时检查是否有内容 → 显示引导或实际内容
**状态**: ⬜ 未开始

### P3-04: 右键菜单扩展
**涉及文件**: `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/webview/sidebar.ts`, `package.json`
**调研结果**:
- UI 设计参考 `PROJECT.md > UI 设计 > 任务右键菜单`
- `KCodeSidebarProvider.ts` — `onDidReceiveMessage` 处理右键菜单命令
- `sidebar.ts` — 渲染任务项时添加右键事件监听
- `package.json` — `contributes.menus` 注册 context menu
**状态**: ⬜ 未开始
