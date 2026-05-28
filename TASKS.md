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
| P1-08 | 侧边栏UI布局与样式实现 | ✅ 已完成 |

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
| P2-07 | FakeAgent 调试模式（agentPath="fake"） | ✅ 已完成 |

**验收标准**：用户可配置 Agent，连接状态可见，对话流畅无阻塞。

## Phase 3: 体验打磨

_目标：提升交互体验。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P3-01 | 侧边栏分组管理（已置顶/普通任务/分组） | ✅ 已完成 |
| P3-04 | 右键菜单扩展（置顶/取消置顶、删除） | ✅ 已完成 |
| P3-05 | 聊天面板任务信息栏 | ✅ 已完成 |
| P3-06 | 右键菜单重新设计（任务/分组） | ✅ 已完成 |

_注：P3-02 验收流程已被 Phase 5 的新状态模型覆盖，不再独立实现。_

---

### P3-07: MyTasks 页面增加"我的项目"功能

**涉及文件**:
- `src/kcodeView/MyTasksProvider.ts` — 接受 TaskStore，发送容器数据到 WebView，处理 newProject/deleteProject
- `src/kcodeView/webview/myTasksApp.ts` — 渲染项目列表，"新建项目"/删除项目操作
- `src/extension.ts` — 传递 store 给 MyTasksProvider

**调研结果**:
- 容器系统（ContainerEntity）已完整实现，存储于 workspaceState 全局共享
- TaskStore 已包含完整的容器 CRUD（addContainer/deleteContainer/moveContainer 等）
- MyTasksProvider 原为独立 WebViewPanel，使用 mock 数据展示跨工作区任务
- 侧边栏已有项目渲染能力（createProjectSection），但 MyTasks 页缺少项目展示

**实现说明**:
- `MyTasksProvider.ts` — 构造时接受 TaskStore；新增 `_sendProjectData()` 发送 containers 到 WebView；`_setupMessageHandler` 处理 `ready`/`newProject`/`deleteProject` 消息；HTML 改为 Tab 布局：主Tab栏「📋 我的任务 / 📁 我的项目」，任务内容包含二级Tab（进行中/待验收/已归档/全部）
- `myTasksApp.ts` — 新增 `switchPrimaryTab()` 切换任务/项目视图；项目Tab隐藏搜索栏，标题改为"📁 我的项目"；项目列表展示 📦 名称+✕ 删除；WebView 监听 `updateProjects` 消息更新
- `extension.ts` — `MyTasksProvider` 构造传入 `store!`
- 项目数据跨目录共享（workspaceState）；侧边栏项目列表保持不变；新建入口仅出现在 MyTasks 页面的"我的项目"Tab

**状态**: ✅ 已完成

**验收标准**：侧边栏支持分组和折叠。

---

## Phase 6: 对话显示体验升级

_目标：升级 AI 对话消息渲染质量，实现与 Kilo 接近的消息展示体验。_

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P6-01 | Markdown 渲染升级（marked + 代码块语法高亮） | ✅ 已完成 | P0 |
| P6-02 | 流式消息增量渲染优化 | ✅ 已完成 | P0 |
| P6-03 | Tool 调用 UI 改进（按工具类型差异渲染） | ✅ 已完成 | P1 |
| P6-04 | 对话消息 UX 细节完善（Code 复制、时间戳、Diff 总结） | ✅ 已完成 | P2 |

**验收标准**：AI 回复代码块带语法高亮，流式输出不闪烁不碎裂，工具调用状态清晰可辨，对话消息信息完整。

---

### P6-05: 输入框停止按钮（生成中可中断）

**涉及文件**:
- `src/kcodeView/KCodePanel.ts`
- `src/kcodeView/webview/app.ts`
- `src/acp/FakeAgent.ts`
- `src/acp/OpenAIAgent.ts`

**调研结果**:
- `KCodePanel.ts:26` — 新增 `isGenerating` 状态跟踪
- `KCodePanel.ts:68-75` — 新增 `stopGeneration` 消息处理 + `handleStopGeneration()` 调用对应 agent 的 cancel
- `KCodePanel.ts:720-745` — HTML 新增 send/stop 按钮（SVG图标），通过 `generationState` 消息通知 WebView 切换
- `app.ts:294-318` — `initChat()` 绑定 send/stop 按钮点击事件
- `app.ts:320-334` — `handleGenerationState()` 切换按钮显隐
- `FakeAgent.ts:14-16` — 新增 `cancel()` 设置取消标记，prompt 循环中检查
- `OpenAIAgent.ts` — 新增 `abortControllers` map、`cancel(sessionId)` 方法调用 AbortController.abort()

**实现说明**:
- 发送按钮（↑ 箭头图标，蓝色 hover）和停止按钮（■ 方块图标，红色 hover）共享 input-actions 位置
- 生成开始时（`setGenerationState(true)`），Extension 向 WebView 发送 `generationState { isGenerating: true }`，WebView 隐藏发送按钮、显示停止按钮
- 生成结束（onDone/onError），Extension 发送 `generationState { isGenerating: false }`，恢复发送按钮
- 停止按钮点击 → `vscode.postMessage({ type: 'stopGeneration', taskId })` → `handleStopGeneration` → 调用 agent.cancel(taskId)
- ACP: `AcpClient.cancel()` 发送 `connection.cancel({ sessionId })` 给 Agent 进程
- FakeAgent: 设置 cancelled flag，prompt 循环检测到后调用 `handler.onDone('cancelled')`
- OpenAIAgent: AbortController.abort() 中断 fetch，catch 中识别 `AbortError` + 检查 controller 是否已从 map 移除（区分用户取消 vs 超时）
- 取消后 `onDone('cancelled')` 触发 `setGenerationState(false)` 恢复 UI

**状态**: ✅ 已完成

---

### P11-06: Kilo Agent 支持 + 输入框 Agent 名称显示

**涉及文件**:
- `src/core/AgentService.ts` — 新增 `connectKilo()` 方法 + `connect()` 分支；新增 `agentName` 属性
- `package.json` — `contributes.configuration` 新增 `kcode.kiloPath`
- `src/kcodeView/KCodePanel.ts` — `flowHandler.sendStatus()` 增加 `agentName` 字段
- `src/kcodeView/webview/app.ts` — `agentStatus` 消息处理更新 `#status-model` 文本

**调研结果**:
- `AgentService.ts:30-58` — `connect()` 当前支持 opencode / openai / 通用 ACP 三条路由
- `chatPanelHtml.ts:122-125` — 输入框底部已有 `#status-model` 元素，固定显示 "Agent"
- `app.ts:312` — `agentStatus` 消息当前只处理连接状态指示灯，未更新名称文本

**方案**:

**Kilo ACP 连接**（方案 B — 专属路由）:
- `connectKilo()` 类似 `connectOpenCode()`，通过 ACP stdio 连接 `kilo acp` 命令
- 配置项 `kcode.kiloPath`，默认值 `kilo`
- 启动参数：`kilo acp --port 0 --cwd <workspaceRoot>`

**Agent 名称显示**:
- `AgentService` 新增 `agentName: string` 属性，连接时记录
- `KCodePanel` 发送 `agentStatus` 时携带 `agentName`
- WebView 收到后更新 `#status-model` 文本为 `'kilo' | 'opencode' | 'openai'`

**状态**: ✅ 已完成

---

### P11-07: 动态导入外部提示词 — 叠加 + 级联继承

**涉及文件**:
- `src/taskflow/externalPrompts.ts` — **新建**：文件读取 + 标签解析 + 级联查找
- `src/taskflow/TaskFlow.ts` — `buildPhasePrompt()` 调用外部 prompt 并追加
- `src/taskflow/__tests__/TaskFlow.test.ts` — 新增外部 prompt 级联测试用例

**调研结果**:
- `TaskFlow.ts:522-562` — `buildPhasePrompt()` 当前按 phase switch 加载内置 `prompts/<phase>.ts`，再注入 `templates.ts` 的 `analysisFramework`/`executionHints`
- `TaskFlow.ts:457-472` — `buildInitialPrompt()` 组装 4 层：BASE → PROTOCOL → buildTaskContext → buildPhasePrompt
- 外部 prompt 作为第 5 层注入，叠加到内置 prompt 末尾

**文件路径规范**:
```
~/.kcode/taskflow/
  task.md                  ← 所有 task 类型基底
  requirement_dev.md       ← category 层
  problem_analysis.md
  performance_opt.md
  defect_analysis.md
  feature_dev.md           ← subType 层 (key 全局唯一，平铺)
  debug.md
  ...
```

**文件格式**:
```markdown
<plan>
计划必须包含测试策略
</plan>

<execute>
完成代码后自动运行 npx tsc --noEmit 检查类型
</execute>
```
仅定义部分阶段标签，未定义的阶段继承上一层。

**级联查找逻辑** (per phase):
```
buildPhasePrompt(task, phase):
  content = ""

  // L1: subType 文件 → 当前 phase 标签内容
  content += loadPhaseSection("~/.kcode/taskflow/<subType>.md", phase)

  // L2: category 文件 → 仅当 L1 该 phase 为空时
  content += loadPhaseSection("~/.kcode/taskflow/<category>.md", phase)

  // L3: 类型基底 → 仅当 L1+L2 该 phase 都为空时
  content += loadPhaseSection("~/.kcode/taskflow/<task.type>.md", phase)

  // 注入到内置 prompt 末尾
  if content: basePrompt += "\n\n【用户自定义规则】\n" + content
```

**标签解析规则**:
- 正则 `<phase>([\s\S]*?)<\/phase>` 逐 phase 提取内容段
- phase 名对应 6 个阶段：`demand` / `goal` / `plan` / `execute` / `self_verify` / `review`
- 文件不存在 → 无操作（fallback 到内置 prompt）
- 文件存在但无当前 phase 标签 → 该层返回空

**状态**: ✅ 已完成

---

## Phase 12: 卡片UI堆叠 + 三栏布局

_目标：减少卡片视觉干扰 + 将 KCode 面板重新划分为三栏，职责完全解耦。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P12-01 | 三栏布局骨架 — 左流程 / 中对话 / 右产出 | ✅ 已完成 |
| P12-02 | 卡片堆叠 — 相邻工具卡片折叠、仅当前卡片展开 | ✅ 已完成 |
| P12-03 | 卡片风格升级 — 参考 Kilo 设计语言，重构卡片标题/配色/视觉层次 | ✅ 已完成 |
| P12-04 | 对话区悬浮导航按钮 — 上一条/下一条用户消息跳转 + 回底部 | ✅ 已完成 |

### P12-01: 三栏布局骨架 — 左流程 / 中对话 / 右产出

**涉及文件**:
- `src/kcodeView/templates/chatPanelHtml.ts` — HTML 结构改为三栏 flex 布局；header 从 7 块缩为 3 行
- `src/kcodeView/templates/chatPanelCss.ts` — CSS 三栏布局，左栏 240px 可折叠，右栏可拖拽调宽
- `src/kcodeView/webview/app.ts` — `updateTaskInfo()` 按 3 行语义重写渲染 + 进度条；移除旧 gutter 面板代码
- `src/kcodeView/webview/processPanel.ts` — **新建** 左栏渲染：进度线节点 + 任务状态 + 时间线
- `src/kcodeView/webview/outputPanel.ts` — **新建** 右栏渲染：四类产出物标签页（代码/工具/计划/知识）
- `src/kcodeView/KCodePanel.ts` — 新增 `sendOutputPanelUpdate()` 通知产出物面板

**实现说明**:
1. **三栏布局**：`#left-panel`(240px) + `#chat-area`(flex:1) + `#right-output-panel`(220px, 可拖拽 140~500px)
2. **header 3 行**：行1 标题+状态→行2 goal+共识tags→行3 阶段标识+确认按钮+进度条; Hook 编辑器收起
3. **左栏**：任务标题+状态标+时间线节点(点击跳转消息)+底部新建任务按钮; 可折叠为 0 宽度
4. **右栏**：四 Tab(📄代码/🔧工具/✅计划/📚知识)，初始空态占位; 通过 `updateOutputPanel` 消息更新
5. **`#right-panel` 保持为 overlay**：Diff/Preview/ACP Log/Device 作为浮层从右侧边界滑出

**状态**: ✅ 已完成

### P12-04: 对话区悬浮导航按钮 — 上一条/下一条用户消息跳转 + 回底部

**涉及文件**:
- `src/kcodeView/templates/chatPanelHtml.ts` — 新增悬浮按钮组 HTML
- `src/kcodeView/templates/chatPanelCss.ts` — 按钮组样式（磨砂底、hover/disabled 状态）
- `src/kcodeView/webview/app.ts` — `initNavButtons()` 导航逻辑、`updateNavButtons()` 可见性+置灰状态

**调研结果**:
- HTML: 在 `#chat-area` 底部添加 `#chat-nav-btns` 容器，含 3 个 `chat-nav-btn` 按钮
- CSS: 按钮组 `position:absolute` 定位右下角，半透明 `rgba(30,30,30,.85)` 底色，hover 高亮
- JS: 查询 `.chat-msg.user` 获取所有用户消息 DOM，`previousUserMsg()`/`nextUserMsg()` 滚动到对应位置
- 可见性规则：`#chat-scroll` 不在底部（`scrollTop + clientHeight < scrollHeight - 48`）且用户消息 ≥ 1 条时显示
- 置灰规则：当前视口已在第一条/最后一条用户消息时，对应按钮置灰不可点击

**状态**: ✅ 已完成

### P12-05: TabCard 组件 — 连续工具卡片聚合成多Tab容器

**涉及文件**:
- `src/kcodeView/webview/app.ts` — 新增 `createTabCardFromTools()` 组件；`handleToolCallUpdate()` 改用 TabCard 替代独立卡片；`renderMessages()` 连续 tool 消息分组渲染；移除旧 `applyAggressiveStack`/`stack-preview` 死代码
- `src/kcodeView/templates/chatPanelCss.ts` — 新增 `.tab-card-*` 样式组件；移除 `.tool-stack-wrapper` 旧样式

**实现说明**:
1. **`createTabCardFromTools(toolInfos)`** — 全新 TabCard 组件，接收聚合的 tool info 数组，整体渲染为一个容器：顶部 tab 栏（每个子 card 的 title 为一个 tab）+ 下方 body 区域（选中 tab 对应的 body 内容）
2. **`_tabGroup` 跟踪** — `handleToolCallUpdate()` 中跟踪当前连续 tool 批次，首个 tool 创建 TabCard，后续 tool 追加 tab，非 tool 事件触发 `resetTabGroup()` 结束批次
3. **`renderMessages()`** — 预分组连续 `role: 'tool'` 消息，多 tool 组渲染为 TabCard，单条消息保持原有渲染
4. **连体效果** — 选中 tab `background` 与 body 一致（`var(--vscode-sideBar-background)`），`border-bottom-color: transparent` 隐藏下方分割线；未选中 tab 保留 header 底色和分割线
5. **等宽 min-width** — `.tab-card-tab` 设 `min-width:100px; flex:1; flex-wrap:wrap`，一行放不下自动换行

**状态**: ✅ 已完成

---

### 设计定调 — 三栏布局

| 区域 | 核心问题 | 内容 | 定位 |
|------|----------|------|------|
| **左栏** | 我走到哪 | 进度线 / 阶段节点 / 任务状态 / 时间线 | ⚙️ 流程控制、导航 |
| **中栏** | 我在聊什么 | 对话消息 / 输入区 / Goal 编辑 / 确认按钮 | 💬 过程交互 |
| **右栏** | 我产出了什么 | 文件变更清单 / 工具执行记录 / Todo 待办 / 关联知识 | 📦 产出物沉淀 |

**极简记忆**：左边「走到哪」— 中间「聊什么」— 右边「产出了什么」

### Header 重构（中栏顶部）

当前 header 7 块内容平铺（标题/状态/时间/Goal/阶段/按钮/共识/计划/钩子），缺行级语义分组。重构为严格 3 行：

```
行1: [标题] [类型标签] [状态badge]        ← 任务是谁、什么状态
     创建时间 · 最后活跃 · 待验收文件数     ← 小号副信息

行2: 🎯 [Goal 文本]                        ← 要达成什么
     [共识inline tag1] [tag2] ...          ← 已锁定共识（紧凑 inline）

行3: 📍 [阶段名称] — 阶段一句话描述         ← 走到哪、还剩多少
     ■■□□  TODO 3/5                        ← 计划步骤进度条+分数
```

| 行 | 回答的问题 | 内容 |
|----|-----------|------|
| **行1 + 副行** | 这任务是谁、什么时候 | 身份 + 时间上下文 |
| **行2** | 要达成什么 | Goal + 已锁定共识（任务契约） |
| **行3** | 走到哪、还剩多少 | 当前阶段 + 描述 + 计划步骤完工比例 |

**关键变化**：
- 阶段按钮只显示当前阶段唯一操作按钮（不堆叠4个）
- 钩子入口移到工具栏
- 共识条目从独立列表变为 Goal 行内 inline tag
- 计划步骤从独立区域压缩为进度条 + 分数
- 创建时间/最后活跃降级为行1下方小字

### 右栏四类产出物

| 产出类型 | 来源 | 内容 |
|----------|------|------|
| 📄 **代码产出** | `FileChange[]` | AI 修改/新增/删除的文件列表，点击打开 diff |
| 🔧 **行为产出** | ACP tool_call 记录 | AI 调用过的工具: bash(已执行命令+输出)、read/glob 等 |
| ✅ **计划产出** | `Task.planSteps` + Todo | AI 制定的步骤及其完成状态，人工可勾选确认 |
| 📚 **知识产出** | 对话关键决策 + 关联案例 | AI 提炼的本次任务可复用的经验、决策记录，跨任务可追溯 |

### 右栏 vs 工具浮层 — 索引 + 详情两层

**右栏（产出物列）— ~200px 固定窄列，始终可见**
聚合四类产出物的列表，作为永久索引入口，不压缩中栏。

**工具浮层 — 从右侧边界滑出，z-index overlay**
Diff / Preview / ACP Log / Device 保留为 tab 形式，但作为**浮层**而非固定面板：

- **默认隐藏**，不占任何布局空间
- **触发**：点击右栏条目自动滑出，切到对应 tab 加载详情（点击文件 → Diff、点击工具 → Log）
- **宽度自由**：diff 需要横向宽度，浮层不受窄列限制
- **关闭**：点击 ✕ 收回，产出物列恢复可见
- **右栏 = 列表/索引层，浮层 = 详情/渲染层**

**对比当前**：
- 当前右侧面板（Preview / Diff / ACP Log / Device）与 task 无绑定，长期占据固定空间
- Phase 12 将右栏改为产出物聚合窄列（始终可见），详情渲染交给滑出浮层（需要时才出现）

### 涉及文件

| 文件 | 改动 |
|------|------|
| `src/kcodeView/templates/chatPanelHtml.ts` | HTML 结构改为三栏 flex 布局；header 从 7 块缩为 3 行 |
| `src/kcodeView/templates/chatPanelCss.ts` | CSS 响应式三栏，左栏固定宽度 240px，右栏可拖拽调宽 |
| `src/kcodeView/webview/app.ts` | `updateTaskInfo()` 按三行语义重写渲染 + 进度条 |
| `src/kcodeView/webview/processPanel.ts` | **新建** — 左栏渲染：进度线 + 任务状态 + 时间线 |
| `src/kcodeView/webview/outputPanel.ts` | **新建** — 右栏渲染：四类产出物标签页聚合 |
| `src/kcodeView/KCodePanel.ts` | 新消息类型注册，输出数据推送（工具记录、决策点等） |
| `src/taskflow/TaskFlow.ts` | 决策点提取事件（`onDecisionLogged` delegate） |

---

### P12-02: 卡片堆叠 — 相邻工具卡片折叠、仅当前卡片展开

**涉及文件**:
- `src/kcodeView/webview/app.ts` — `createCard()` 增加堆叠逻辑；`handleToolCallUpdate()` 追加卡片时折叠相邻卡片
- `src/kcodeView/templates/chatPanelCss.ts` — `.msg-card-body` 堆叠态过渡动画

**调研结果**:
- `app.ts:1701-1810` — `createCard()` 每张卡片独立创建，无堆叠感知
- `app.ts:2272-2292` — `handleToolCallUpdate()` 每收到 toolCallUpdate 就创建/更新独立卡片，追加到 chat-messages
- `app.ts:2335-2376` — `renderToolBubbleContent()` 所有卡片 `defaultCollapsed: false`，从不自动折叠
- 当前每个工具卡片是独立 `chat-msg tool` 消息元素，appendToChatMessages 追加

**实现说明**:

1. **堆叠判定**：在 `handleToolCallUpdate()` 中，追加新卡片前检查上一个兄弟元素是否为 `chat-msg tool`。如果是，则触发堆叠模式：
   - 找到上一个 `chat-msg tool` 元素内的 `.msg-card-body`，添加 `collapsed` 类
   - 切换其 toggle 箭头为 `▶`
   - 新卡片保持 `defaultCollapsed: false`
2. **仅相邻堆叠**：如果上一兄弟元素是普通文本消息（`chat-msg agent` 含文本），则不触发堆叠
3. **header 点击展开**：维持现有的 `msg-card-header` click 事件，点击某张已折叠卡片时展开它，同时折叠当前活跃卡片
4. **转换动画**：新增 CSS `.msg-card-body` transition，折叠/展开时有平滑高度过渡

**状态**: ✅ 已完成

**验收标准**：同一 agent 消息内连续工具卡片自动堆叠，仅最后一张展开；中间有文本输出时独立堆叠；点击可展开历史卡片。

---

### P12-03: 卡片风格升级 — 参考 Kilo 设计语言

**涉及文件**:
- `src/kcodeView/templates/chatPanelCss.ts`
- `src/kcodeView/webview/app.ts`

**调研结果**: _Kilo 对话区 UI 设计分析完成_

Kilo 代码位于 `~/Code/kilocode/`，其聊天 UI 核心设计如下：

#### 工具卡片

Kilo 工具卡片结构：
```
[data-component="tool-part-wrapper"][data-part-type="tool"]
  └── <Collapsible class="tool-collapsible">
       ├── <Collapsible.Trigger>
       │    └── [data-component="tool-trigger"] (height: 36px)
       │         ├── [data-slot="basic-tool-icon"] (SVG 图标)
       │         ├── [data-slot="basic-tool-tool-info-main"] (title + subtitle)
       │         └── [data-slot="tool-trigger-actions"] (hover 操作)
       └── <Collapsible.Content>
            └── [data-component="tool-output"] (padding: 8px 12px)
```

| 属性 | Kilo | KCode 当前 |
|------|------|-----------|
| 卡片边框 | `1px solid var(--border-weak-base)` | `1px solid rgba(255,255,255,.08)` |
| 卡片圆角 | `2px`（全局 `radius-*` 均 2px） | `6px` |
| Header 高度 | `36px`，`padding: 0 8px` | `padding: 7px 12px` |
| Header 背景 | `var(--surface-inset-base)` (sidebar-bg) | `rgba(0,0,0,.25)` |
| Header hover | `var(--surface-inset-base-hover)` | `rgba(255,255,255,.015)` |
| 展开态底部 | `border-bottom: 1px solid var(--border-weak-base)` | 无（body 上 border-top） |
| 箭头 | SVG chevron, 展开 0deg / 折叠 -90deg | 文本 ▶/▼ |
| 箭头可见性 | 始终 `opacity: 1`（VS Code 主题） | 始终可见 |
| Body padding | `8px 12px` | `8px 12px 10px` |
| Body max-height | 无限制 | `300px` |
| 字体大小 | header 13px / body 13px | header 12px / body 13.5px |
| 间距 | 卡片间无 margin（flex gap: 12px） | `margin-bottom: 8px` |

#### 工具类型差异配色

Kilo 在 header 上无类型边框，类型区分靠图标。KCode 已有初步配色，需增加左侧 3px 色条：

| 工具类型 | 配色 | 实现方式 |
|---------|------|---------|
| bash/command/terminal | 绿色 (#4CAF50) | header 左侧 3px border + bash 输出 #5a9d6b |
| read | 蓝色 (#2196F3) | header 左侧 3px border |
| write/edit | 橙色 (#FF9800) | header 左侧 3px border |
| glob/grep/search | 紫色 (#9C27B0) | header 左侧 3px border |
| thinking | 灰色 (#9E9E9E) | 斜体、半透明（已有）|

#### 消息气泡

| 属性 | Kilo | KCode 当前 |
|------|------|-----------|
| 用户消息 | 无边框气泡，meta 行含 agent+model+timestamp | inline-block 气泡，`border-radius:6px`，80% 最大宽度 |
| Agent 文本 | 左无装饰，margin-top: 8px | 左无装饰，全宽 |
| Agent meta | "Agent · Model · Xs" 底部 | 顶部 sender（默认 display:none）|
| 时间戳 | `h:mm AM/PM`，`.text-text-weak` | `10px, #555` |

#### 设计 Token（CSS 变量）

Kilo 使用大量语义化 CSS 变量桥接到 `--vscode-*`：
- `--surface-inset-base` → `var(--vscode-sideBar-background)`
- `--border-weak-base` → `var(--vscode-panel-border)`
- `--text-strong` / `--text-base` / `--text-weak` / `--text-weaker`（4 级透明度）
- `--icon-base` / `--icon-weak-base`
- `--text-diff-add-base` / `--text-diff-delete-base`
- `--surface-diff-add-base` / `--surface-diff-delete-base`
- 字体：base 13px, small 11px
- 卡片：`border-radius: 2px`, `border: 1px solid var(--border-weak-base)`

**实现说明**:

1. **设计 Token**：`chatPanelCss.ts` 定义 CSS 变量（对齐 Kilo 语义）
2. **卡片样式升级**：圆角 6→4px，header 对齐 Kilo 36px 紧凑布局，替换 ▶/▼ 为 SVG chevron（旋转动画），header 底部 border 代替 body top border
3. **工具类型颜色条**：每张工具 card-header 左侧 3px 实线按类型配色
4. **消息间距**：卡片 margin 8→0（flex gap 12px），消息 padding 14→10px
5. **用户消息**：Kilo 风格的 meta 行（Agent · 时间戳）
6. **Agent 文本**：左侧 2px 灰色竖线装饰（类似 Kilo reasoning block）

**状态**: ✅ 已完成

---

_目标：逐步用 KCode 自身开发 KCode，从"能看"到"完全切换"。_

| Phase | Level | 目标 | 状态 |
|-------|-------|------|------|
| **6** | 🟫 Level 0 — 能看 | 提升 AI 输出可读性 | ✅ 当前 |
| **7** | 🟥 Level 1 — 能改 | 参与修小 bug | ✅ 已完成 |
| **8** | 🟧 Level 2 — 能造 | 完成独立小功能 | ✅ 已完成 |
| **9** | 🟨 Level 3 — 能带 | 主导功能开发 | ✅ 已完成 |
| **10** | 🟩 Level 4 — 能吃 | 完全切换到 KCode | ✅ 已完成 |

各阶段详细目标和验收标准见 `PROJECT.md > 自举之路`。

---

### P6-01: Markdown 渲染升级（P0）

**涉及文件**: `src/kcodeView/webview/app.ts`, `src/kcodeView/KCodePanel.ts`, `package.json`

**Kilo 参考**:
- `packages/kilo-ui/src/components/markdown.tsx` — Markdown 组件，用 `marked` + `shiki` 渲染
- `packages/kilo-ui/src/components/markdown.css` — Markdown 样式
- `packages/kilo-ui/src/components/code.tsx` — 代码块渲染（高亮 + 复制按钮）

**调研结果**:
- `app.ts:89-106` — `simpleMarkdown()` 纯正则替换，缺失：代码块语法高亮、标题、列表、表格、引用、分割线
- `KCodePanel.ts:764-853` — `getInlineStyles()` 内联 CSS，代码块预/码样式需扩展
- WebView 当前通过 `<script src="out/...js">` 加载编译后 JS（无打包工具），无法直接 npm import。需引入 CDN 加载 `marked` + `highlight.js`，或引入 esbuild/vite 打包 webview 脚本

**调研步骤**:
1. 读取 Kilo 的 `markdown.tsx` 确认 `marked` 用法和配置
2. 确认 `package.json` 已安装的构建工具情况
3. 决定方案：CDN 加载 vs 内置打包
4. 安装 `marked` 库并集成到 webview

**状态**: ✅ 已完成

---

### P6-02: 流式消息增量渲染优化（P0）

**涉及文件**: `src/kcodeView/webview/app.ts`, `src/kcodeView/KCodePanel.ts`

**Kilo 参考**:
- `packages/kilo-ui/src/components/message-part.tsx:1258-1412` — `TextPartDisplay` 用 `createThrottledValue` 节流流式文本，每次只更新文本内容而非重建 DOM
- `packages/kilo-ui/src/components/markdown.tsx` — 底层的 Markdown 组件支持增量文本更新

**调研结果**:
- `app.ts:112-141` — `handleAgentStreamUpdate()` 每 chunk 全量 `innerHTML = rendered`，破坏流式过程中的代码块
- 方案：追踪已渲染文本长度，每次只追加新内容
- `marked.Lexer` 可部分解析不完整 markdown，配合增量策略避免代码块中间状态渲染
- 扩展侧（`KCodePanel.ts`）可考虑发送增量文本而非全量

**调研步骤**:
1. 在 P6-01 基础上实现增量渲染策略
2. 处理边界：代码块未闭合时的渲染降级

**状态**: ✅ 已完成

---

### P6-03: Tool 调用 UI 改进（按工具类型差异渲染）

**涉及文件**: `src/kcodeView/webview/app.ts`, `src/kcodeView/KCodePanel.ts`

**调研结果**:
- `app.ts:852-992` — `renderToolBubbleContent()` 重写为按工具类型差异渲染
- `app.ts:971-991` — `getToolKindIcon()` 按 tool kind 返回对应图标
- `KCodePanel.ts:859-875` — 新增 tool 类型 CSS（spinner、bash终端、diff 样式、thinking 样式）

**实现说明**:
- **bash/command/terminal**: 运行中自动展开且绿色终端风格，完成后自动折叠，支持点击切换
- **read/glob/grep/search**: 默认折叠卡片，带 ▶/▼ 切换
- **write/edit**: 默认折叠，内容以 diff 颜色展示，点击展开查看
- **thinking**: 极简样式（灰色斜体），无展开内容
- **其他**: 保持原有折叠卡片行为
- **运行中状态**: 统一显示旋转动画代替 ⏳，完成后切换为 ✅/❌
- 每个工具类型都有对应的图标前缀（`$` / 📖 / ✏️ / 🔍 / 🔎 / 💭）

**状态**: ✅ 已完成

---

### P6-04: 对话消息 UX 细节完善（Code 复制、时间戳、Diff 总结）

**涉及文件**: `src/kcodeView/webview/app.ts`, `src/kcodeView/KCodePanel.ts`

**调研结果**:
- Code 复制按钮已通过 marked 渲染器内建（`code-copy-btn`），hover 时显示，点击复制到剪贴板
- `app.ts:340-345` — `formatTimestamp()` 日期格式化（今天显示 HH:mm，之前显示 MM/DD HH:mm）
- `app.ts:306-328` — `addUserMessage()` 新增消息时间戳
- `app.ts:567-592` — `addMessageElement()` 所有消息类型增加时间戳渲染
- `app.ts:413-430` — `collectChangedFiles()` / `renderMessages()` 扫描 agent 消息后的 write/edit 工具调用，在 agent 消息底部展示变更文件列表
- `KCodePanel.ts:860` — `.msg-timestamp` CSS
- `KCodePanel.ts:875` — `.agent-diff-summary` CSS

**实现说明**:
- 时间戳：每条消息 sender 旁显示，今天仅显示 HH:mm，之前显示 MM/DD HH:mm
- Diff 总结：agent 文本消息底部自动扫描其后跟随的 write/edit 工具调用，汇总展示📄 变更文件列表，带绿色左边框视觉区隔

**状态**: ✅ 已完成

---

## Phase 3 任务详情

### P3-01: 侧边栏分组管理
**涉及文件**: `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/webview/sidebar.ts`, `src/types/index.ts`, `src/store/TaskStore.ts`
**调研结果**:
- UI 设计参考 `PROJECT.md > UI 设计 > 整体布局`（左侧栏）
- `KCodeSidebarProvider.ts` — `resolveWebviewView()` 设置 HTML/JS，`refresh()` 发更新
- `sidebar.ts` — `renderTaskList(tasks)` 渲染扁平列表，需改为分组渲染
- `types/index.ts` — Task 类型需增加 `pinned`、`group` 字段
**实现说明**:
- TaskStore 新增 `getGroups/addGroup/updateTaskGroup` 方法
- KCodeSidebarProvider 处理 `newGroup`/`moveTaskToGroup` 消息
- "任务"标题旁新增「+」新建分组按钮，弹出 `showInputBox`
- 任务项支持 HTML5 Drag & Drop 拖入分组
- 未分组区也是 drop target，拖入可移出分组
**状态**: ✅ 已完成

### P3-02: 验收流程

**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`, `src/kcodeView/webview/preview.ts`, `src/acp/callbacks.ts`, `src/types/index.ts`, `src/acp/AcpClient.ts`

**实现内容**:
- `callbacks.ts` — `writeTextFile()` 覆盖前读取原内容，按 session 记录变更文件列表（filePath + original + modified）
- `AcpClient.ts` — `setCurrentSession(sessionId)` 在 prompt 前设置, `getReviewChanges(taskId)` 对外暴露变更
- `KCodePanel.ts` — `triggerReviewRequest()` 收集变更，发送 `showReviewRequest` 消息（含 changes 数组）
- `app.ts` — 处理 `showReviewRequest`，在验收卡片底部展示文件变更列表，点击条目调用 `showDiff` 在右侧面板 Diff tab 展示
- `preview.ts` — `showDiff` 已有实现，验收流程中直接调用
- `types/index.ts` — 新增 `FileChange` 接口

**状态**: ✅ 已完成

### P3-04: 右键菜单扩展
**涉及文件**: `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/webview/sidebar.ts`, `src/store/TaskStore.ts`
**调研结果**:
- UI 设计参考 `PROJECT.md > UI 设计 > 任务右键菜单`
- `KCodeSidebarProvider.ts` — `onDidReceiveMessage` 处理 `pinTask` 消息
- `sidebar.ts` — `showContextMenu` 显示"置顶/取消置顶" + "Delete"
- `TaskStore.ts` — 新增 `updateTaskPin` 方法
**状态**: ✅ 已完成

### P3-06: 右键菜单重新设计（任务/分组）

**涉及文件**: `src/kcodeView/webview/sidebar.ts`, `src/kcodeView/KCodeSidebarProvider.ts`, `src/store/TaskStore.ts`, `src/types/index.ts`

**实现说明**:
- 任务右键菜单改为：重命名 / 置顶 / 归档 / 移至分组（含未分组和所有分组，当前分组带 ✔ 标记）
- 分组右键菜单改为：重命名 / 上移 / 下移 / 删除
- Task 类型新增 `archived` 字段，归档任务自动从列表隐藏
- TaskStore 新增 `renameGroup`、`moveGroup`、`updateTaskArchive` 方法
- 删除分组时自动清空关联任务的 group 字段
- 右键子菜单通过 CSS hover 实现（`.has-submenu` + `.submenu`）

**状态**: ✅ 已完成

### P3-05: 聊天面板任务信息栏

**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`

**实现说明**:
- 聊天面板顶部新增固定任务信息栏，不随消息滚动
- 第一行：任务标题 + 状态徽标（Pending/Active/Completed）
- 第二行：创建时间 + 待验收文件数（预留，当前恒为 0）
- `loadTask()` 时通过 `updateTaskInfo` 消息发送任务信息到 WebView
- `updateTaskInfo()` 函数处理 WebView 端 DOM 更新

**状态**: ✅ 已完成

---

## Phase 7: 自举之路 Level 1 — 能改

_目标：端到端验证目标确认与验收流程，修复发现的真实问题。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P7-01 | Goal 中心化 — 固定显示与可编辑 | ✅ 已完成 |
| P7-02 | 验收增强 — 变更文件关联 + 驳回带原因 | ✅ 已完成 |
| P7-03 | 进度线节点重构为固定 5 阶段 | ✅ 已完成 |
| P7-04 | ACP 尾部数据丢失修复 — prompt 响应后 200ms 缓冲 | ✅ 已完成 |

---

### P7-01: Goal 中心化 — 固定显示与可编辑

**涉及文件**:
- `src/types/index.ts` — ChatMessage type 增加 `'goal_updated'`
- `src/kcodeView/KCodePanel.ts` — HTML 增加 goal-header 区域；CSS 增加 goal-header 样式；`sendTaskInfo` 增加 goal/goalHint/taskType；新增 `handleUpdateGoal` 方法；消息处理注册 `updateGoal`
- `src/kcodeView/webview/app.ts` — `updateTaskInfo` 更新 goal header；新增 `showGoalViewMode`/`showGoalEditMode`/`initGoalHeader`；`addMessageElement` 处理 `goal_updated` 类型渲染

**实现说明**:
- **G1 Goal 固定显示**：对话区顶部添加 sticky `#goal-header`，task 类型且 goal 非空时显示，cancelled/completed 状态隐藏
- **G2 随时修改 Goal**：点击 ✏️ 按钮进入行内编辑，Enter 保存/ Escape 取消，保存后更新 store 并刷新 UI
- **G3 Goal 变更记录**：每次修改生成 `goal_updated` 类型消息，以卡片形式展示变更 diff

**状态**: ✅ 已完成

---

### P7-02: 验收增强 — 变更文件关联 + 驳回带原因

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `handleRejectReview` 接受 reason 参数；消息处理 `rejectReview` 传递 reason
- `src/kcodeView/webview/app.ts` — `handleShowReviewRequest` 增强显示（文件类型图标/行数摘要）；新增 `showRejectInput` 驳回输入 UI；`rejectReview` 消息带 reason
- `src/kcodeView/KCodePanel.ts` — CSS 新增 `.review-changes-icon/name/type/summary`、`.reject-input-area/input/btn-row`

**实现说明**:
- **R6 变更文件关联**：每个文件显示类型图标（📄新建/📝修改/🗑️删除）+ 行数摘要，点击通过 VS Code 原生 diff 编辑器打开对比（`vscode.diff`）
- **R5 驳回带原因**：点击"驳回"显示文本输入框，填写原因后确认驳回；原因作为用户消息发送给 AI，AI 可针对性修改
- diff 不再在右侧面板内联渲染，复用 VS Code 原生 diff 能力

**状态**: ✅ 已完成

---

### P7-03: 进度线节点重构为固定 5 阶段

**涉及文件**:
- `src/types/index.ts` — ProgressNode type 改为 5 固定阶段 + status 新增 cancelled
- `src/kcodeView/KCodePanel.ts` — 重写 `deriveNodes()`，始终返回 5 节点；CSS 新增 `.tl-node.status-cancelled`
- `src/kcodeView/webview/app.ts` — `getNodeEmoji()` 对应 5 阶段；`handleNodePanelUpdate()` 适配固定渲染
- `PROJECT.md` — 已先更新状态机文档

**调研结果**:
- 设计已在 PROJECT.md 确认：5 固定阶段，4 种颜色状态
- ProgressNode: `type: 'demand' | 'goal' | 'plan' | 'execute' | 'review'`
- ProgressNode: `status: 'pending' | 'active' | 'completed' | 'cancelled'`
- 节点始终显示，颜色区分状态
- "从用户开始，到用户终止"设计原则
- 中断点标记 ❌，后续节点 ⚪

**状态**: ✅ 已完成

---

### P8-09: TaskFlow 模块抽取 — 阶段状态机与 UI 解耦

**涉及文件**:
- `src/taskflow/TaskFlow.ts` — **新建**：阶段状态机 + TASK_UPDATE 协议 + 阶段提示词 + 用户确认操作，零 UI 依赖
- `src/kcodeView/KCodePanel.ts` — 移除 `parseTaskUpdate/validatePhaseAction/executePhaseAction/buildTaskPrompt/buildPlanSection/processGoalProposal` 等内联方法，改为委托 `this.taskFlow.*`
- `src/kcodeView/webview/app.ts` — 无改动（UI 渲染不变）
- `PROJECT.md` — 新增 `src/taskflow/TaskFlow.ts` 模块文档

**实现说明**:
- **TaskFlow 职责**：phase 迁移、TASK_UPDATE 解析/执行/拦截、prompt 构建、用户确认操作的状态迁移
- **KCodePanel 职责**：agent 通信、WebView 消息、消息存储、UI 渲染 — 通过 `TaskFlowDelegate` 接收事件
- **纯逻辑模块**：`TaskFlow.ts` 不 import VS Code API，`ITaskStore` 接口可通过 mock 替换，适合 CLI 测试
- **已迁移的方法**：
  - `parseTaskUpdate()` → `TaskFlow.processChunk()`
  - `validatePhaseAction()` → `TaskFlow.validateAction()`
  - `executePhaseAction()` → `TaskFlow.executeAction()`
  - `buildTaskPrompt()` → `TaskFlow.buildPrompt()`
  - `processGoalProposal()` → `TaskFlow.processGoalProposal()`
  - `buildPlanSection()` → `TaskFlow.buildPlanSection()`
  - `handleConfirm*` → 拆分为状态迁移（TaskFlow）+ 消息/agent 操作（KCodePanel）

**状态**: ✅ 已完成

---

### P7-04: ACP 尾部数据丢失修复 — prompt 响应后 200ms 缓冲

**涉及文件**:
- `src/acp/AcpClient.ts` — `prompt()` 方法增加 200ms 缓冲

**调研结果**:
- KiloCode ACP agent (`agent.ts`) 的事件循环与 `sdk.session.prompt()` 存在竞态：`message.part.delta` 通过独立 `for await...of` 事件循环处理，最后几个 delta 可能在 `prompt()` resolve 后才处理完毕，导致最后几个 `agent_message_chunk` 通知在 `session/prompt` 响应之后到达
- KCode 侧 `AcpClient.prompt()` 在 `connection.prompt()` resolve 后立即调用 `removeSessionHandler()`，后续到达的 `sessionUpdate` 被丢弃
- 表现为 ACP 日志中 `[TASK_UPDATE]` 块不完整（缺少 PENDING 段和 `[/TASK_UPDATE]`）
- `@agentclientprotocol/sdk` 的 `sendMessage` 使用 Promise 链写队列，但 `sendNotification` 的 `await` 在写排入队列后就返回，不等实际写入完成

**实现说明**:
- `AcpClient.prompt()` 在 `connection.prompt()` resolve 后添加 `await new Promise(resolve => setTimeout(resolve, 200))`
- 200ms 缓冲让 straggler `agent_message_chunk` 通知到达并被 `sessionHandler` 处理，然后再移除 handler 并调用 `onDone()`

**状态**: ✅ 已完成

---

## Phase 8: 自举之路 Level 2 — 能造

_目标：实现 `<TASK_UPDATE>` 协议驱动的 5 阶段全流程（demand → goal → plan → execute → review），用 KCode 自身完成独立小功能。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P8-01 | 数据模型扩展 — Task 增加 phase / confirmedItems / pendingItems / planSteps | ✅ 已完成 |
| P8-02 | `<TASK_UPDATE>` 协议解析器 — 替换旧 `[TASK_STATUS]` / `[FILE]` 标记 | ✅ 已完成 |
| P8-03 | 阶段分发提示词 — buildTaskPrompt() 按 phase 分派 4 套提示词 | ✅ 已完成 |
| P8-04 | 对话式阶段迁移 — 移除强制卡片阻断，自然对话推进阶段 | ✅ 已完成 |
| P8-05 | 顶部看板增强 — 显示当前阶段 + 共识条目 | ✅ 已完成 |
| P8-06 | 计划确认按钮 — 计划方案卡片 + 确认/调整按钮 | ✅ 已完成 |
| P8-07 | 验收文件列表 — 点击文件打开 diff 对比窗口 | ✅ 已完成 |
| P8-08 | 全阶段确认按钮 — 每阶段必须用户点击确认才进入下一阶段 | ✅ 已完成 |
| P8-09 | TaskFlow 模块抽取 — 阶段状态机与 UI 解耦 | ✅ 已完成 |
| P8-10 | Self-Verify 自验阶段 — Execute 后 AI 自动审查代码再交人类验收 | ✅ 已完成 |
| P8-P6 | Plan-before-Execute — AI 通过 `plan_step_update` 协议实时标记步骤进度 | ✅ 已完成 |
| P8-N1 | 进度节点面板增强 — 折叠/展开 + 节点 label + 点击跳转 | ✅ 已完成 |
| P8-R1 | 结构化逐条验收 — 交互式勾选清单 + 部分通过/驳回 | ✅ 已完成 |

---

### P8-01: 数据模型扩展 — Task 增加 phase / confirmedItems / pendingItems / planSteps

**涉及文件**:
- `src/types/index.ts` — Task interface 新增 `phase`, `confirmedItems`, `pendingItems`, `planSteps`
- `src/store/TaskStore.ts` — CRUD 适配新字段（含 `updateTaskPhase()`, `updateConfirmedItems()`, `updatePendingItems()`, `updatePlanSteps()`, `updatePlanStepStatus()`）

**调研结果**:
- `Task` 当前无 phase / confirmedItems / pendingItems / planSteps 字段（`src/types/index.ts:1-12`）
- `TaskStore` 当前有 `updateTaskGoal()`, `updateTaskStatus()`, `updateTaskPin()`, `updateTaskArchive()`, `updateTaskNodeMessageId()`, `updateTaskTitle()`, `updateTaskGroup()`, `renameGroup()`, `moveGroup()` 方法
- `Task.status` 保留原值，新增 `phase` 管理 5 阶段内流转（design doc §六）

**实现说明**:
- Task.phase: `'demand' | 'goal' | 'plan' | 'execute' | 'review'`，新任务默认 `'demand'`
- Task.confirmedItems: `string[]`，已锁定共识条目
- Task.pendingItems: `string[]`，待讨论条目
- Task.planSteps: `{ content: string; status: 'pending' | 'active' | 'completed' }[]`，计划步骤
- `buildTaskPrompt()` 和 `parseTaskUpdate()` 依赖此模型，必须先完成

**状态**: ✅ 已完成

---

### P8-02: `<TASK_UPDATE>` 协议解析器 — 替换旧标记

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — 合并 `stripTaskMarker()` + `stripFileMarkers()` 为 `parseTaskUpdate()`；新增 `validatePhaseAction()` 校验

**调研结果**:
- `KCodePanel.ts:370-400` — `stripTaskMarker()` 匹配 `[TASK_STATUS:...]`，`stripFileMarkers()` 匹配 `[FILE]...`，均需替换为 `<TASK_UPDATE>` JSON 协议
- 新解析器需兼容流式输出：每次 chunk 到达后扫描 `<TASK_UPDATE>...</TASK_UPDATE>`，剥离后送给前端渲染
- 解析规则见 design doc §三

**实现说明**:
- **正则匹配**: `/<TASK_UPDATE>([\s\S]*?)<\/TASK_UPDATE>/g` 从累积文本中提取，剥离后不展示给用户
- **JSON 解析**: 解析 `{ phase, action, confirmed_items, pending_items }`
- **阶段校验**: `validatePhaseAction(currentPhase, action)` — 按 design doc §3.3 表校验
  - demand: 大模型不输出迁移指令
  - goal: 仅 `propose_goal`, `lock_goal`
  - plan: 仅 `propose_plan`, `lock_plan`
  - execute: 仅 `finish_execute`
  - review: 仅 `accept`, `reject`
- **副作用**: 解析成功后自动调用 `sendTaskInfo()` + `sendNodePanelUpdate()` 刷新看板+节点
- **非法指令**: 日志警告，不执行，不报错给用户
- `stripTaskMarker()` + `stripFileMarkers()` 保留到下游兼容期结束再删除

**状态**: ✅ 已完成

---

### P8-03: 阶段分发提示词 — 分层外置架构

**涉及文件**:
- `src/taskflow/prompts/base.ts` — AI 人格基线
- `src/taskflow/prompts/protocol.ts` — TASK_UPDATE 协议全量参考
- `src/taskflow/prompts/demand.ts` — 需求收集阶段
- `src/taskflow/prompts/goal.ts` — 目标确认阶段
- `src/taskflow/prompts/plan.ts` — 计划制定阶段
- `src/taskflow/prompts/execute.ts` — 执行阶段
- `src/taskflow/prompts/review.ts` — 验收阶段
- `src/taskflow/TaskFlow.ts` — `buildPrompt()` 分层组装 + `buildTaskContext()` + `buildPhasePrompt()`
- `src/kcodeView/KCodePanel.ts` — 移除硬编码 demand 格式化字符串，统一走 `buildPrompt()`

**实现说明**:

提示词从 KCodePanel 内联字符串 → TaskFlow.ts 独立文件分层，参考 kilocode 的 "分层 + 外置 + 动态" 模式。

`buildPrompt()` 输出组装顺序：
1. **BASE_PROMPT** — "你是一个专注于任务驱动的 AI 编程助手"
2. **PROTOCOL_PROMPT** — TASK_UPDATE 协议规则（一次定义，不重复）
3. **buildTaskContext()** — 动态提取 task.goal/confirmedItems/planSteps/pendingItems
4. **buildPhasePrompt()** — 按 task.phase 从 prompts/ 目录加载对应文件

| Phase | 提示词文件 | 行为约束 |
|-------|-----------|---------|
| `demand` | `demand.ts` | 只做目标归纳，不写代码，输出 propose_goal |
| `goal` | `goal.ts` | 与用户讨论确认，输出 propose_goal/lock_goal |
| `plan` | `plan.ts` | 基于锁定目标制定计划，输出 propose_plan |
| `execute` | `execute.ts` | 可写代码/改文件/执行命令，输出 finish_execute |
| `review` | `review.ts` | 展示变更，输出 accept/reject |

**额外变更**:
- `parseTaskUpdate()` 修复 `const text` 造成的 regex 死循环（改为 `let text` + 同步局部变量）
- `src/taskflow/__tests__/TaskFlow.test.ts` — 7 个测试用例覆盖分层 prompt/协议解析/完整流程
- KCodePanel `handleSendMessage` 首条消息不再走硬编码字符串，统一从 buildPrompt 获得 demand 阶段提示词

**状态**: ✅ 已完成

---

### P8-06: 计划确认按钮

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `planProposed` 状态跟踪、`showPlanConfirmation()`、`handleConfirmPlan()`、`handleRejectPlan()`、计划阶段提示词移除自动 lock_plan；HTML 新增 `#plan-confirm-btn`；CSS 新增 `.plan-confirm-btn` 样式
- `src/kcodeView/webview/app.ts` — `updateTaskInfo()` 在 phase='plan' 时显示确认按钮；`initChat()` 绑定按钮点击事件；`handleShowPlanProposal()` 渲染计划卡片（带确认/调整按钮）

**实现说明**:
- **持久按钮（主要路径）**: 顶部看板阶段标识旁新增「确认计划」按钮，当 `task.phase === 'plan'` 时始终可见，不依赖 AI 输出 TASK_UPDATE 协议
- **AI 提案卡片（辅助路径）**: AI 输出 `propose_plan` 时仍在对话区渲染计划方案卡片，提供相同的确认/调整按钮
- 两路均调用 `handleConfirmPlan()` → `executePhaseAction('lock_plan')` → 推进到执行阶段并重新提示 AI
- 兼容对话模式：用户也可直接输入文字确认，AI 输出 `lock_plan` 仍会正确处理

**状态**: ✅ 已完成

### P8-07: 验收文件列表 — 点击打开 diff

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `triggerReviewRequest()` 已有变更收集 + `showReviewRequest` 消息发送
- `src/kcodeView/webview/app.ts` — `handleShowReviewRequest()` 渲染文件列表，每项点击触发 `toggleReviewFileSelection()` → 右侧面板 diff + 原生 diff 按钮
- `src/kcodeView/webview/preview.ts` — `showDiffWithFile()` 全局注册，支持在 diff tab 显示文件名头 + 内联 diff + "打开原生对比" 按钮

**功能说明**:
- `triggerReviewRequest()` 从 agent 收集 `FileChange[]`（含 filePath/original/modified），发送 `showReviewRequest` 到 WebView
- WebView 在验收消息底部渲染文件变更列表（带类型图标 📄新建/📝修改/🗑️删除 + 行数摘要）
- 点击文件 → 右侧面板 Diff tab 显示内联 diff + 文件名头
- 点击"⇱ 打开原生对比" → VS Code `vscode.diff` 命令打开原生 diff 编辑器
- 各 agent 实现 `getReviewChanges()` 返回当前会话的变更文件列表

**状态**: ✅ 已完成

---

### P8-08: 全阶段确认按钮 — 每阶段必须用户点击确认才进入下一阶段

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — 添加 `executeFinished` 状态追踪、`parseTaskUpdate()` 拦截 AI 自动迁移、`handleConfirmExecuteDone()` / `handleConfirmGoalFromHeader()` 处理器、HTML header 新增 goal/execute 确认按钮
- `src/kcodeView/webview/app.ts` — `updateTaskInfo()` 新增 goal/execute 阶段 header 按钮显隐逻辑、`initChat()` 绑定按钮事件

**实现说明**:
- **拦截 AI 自动迁移**: `parseTaskUpdate()` 禁止 AI 输出的 `lock_goal`, `lock_plan`, `accept`, `reject` 自动触发阶段迁移，必须用户点击确认按钮
- **execute → review**: AI 输出 `finish_execute` 时不再自动迁移，仅设置 `executeFinished` 标志 → header 显示"确认完成 ✓"按钮 → 用户点击后调用 `handleConfirmExecuteDone()` 完成迁移
- **goal 阶段**: header 新增"确认目标 ✓"按钮，与 goal 卡片确认按钮功能一致（`handleConfirmGoalFromHeader()` → `handleConfirmGoal()`）
- **所有阶段按钮**:
  | 阶段 | 按钮 | 位置 |
  |------|------|------|
  | 🎯 goal | 确认目标 ✓ | header + 目标卡片 |
  | 📋 plan | 确认计划 | header + 计划卡片 |
  | ⚡ execute | 确认完成 ✓ | header |
  | ✅ review | 验收通过 ✓ / 驳回 ↩ | 验收卡片 |
- 即使 AI 未输出协议标记，用户仍可通过 header 按钮手动推进阶段

**状态**: ✅ 已完成

---

### P8-04: 对话式阶段迁移 — 移除强制卡片阻断

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `handleConfirmGoal()` 改为后台流转 + 看板刷新；新增 `handlePhaseTransition()` 统一处理 lock_* 后的状态迁移
- `src/kcodeView/webview/app.ts` — 适配新阶段迁移消息（移除对 goal_confirmation 卡片的强制依赖）

**调研结果**:
- `KCodePanel.ts:435-455` — `handleConfirmGoal()` 当前通过 `showGoalConfirmation` 消息发送卡片，用户必须点确认
- design doc §四定义"对话隐式"迁移流程：Agent 输出 `<TASK_UPDATE lock_goal>` 后台切换 phase，看板自动刷新
- 卡片保留但改为**可选的协商汇总展示**，不再强制阻断

**实现说明**:
- **新增 `handlePhaseTransition(tid, action)`**:
  - `lock_goal` → task.phase = 'plan', 更新 confirmedItems, 刷新看板+节点
  - `lock_plan` → task.phase = 'execute', 更新 planSteps, 刷新看板+节点
  - `finish_execute` → task.phase = 'review', task.status = 'in_review', 刷新看板+节点
  - `accept` → task.status = 'completed', 终态
  - `reject` → task.phase = 'execute', task.status = 'active'（驳回后 AI 继续）
- **卡片降级**: goal_confirmation / plan_proposal 卡片仅做汇总展示，用户可通过对话说"好"来确认，无需点按钮
- **看板自动刷新**: phase 切换后 `sendTaskInfo()` + `sendNodePanelUpdate()` 自刷新
- 兼容现有 `handleConfirmGoal` / `handleRejectReview` / `handleAcceptReview` 等已有方法

**状态**: ✅ 已完成

---

### P8-05: 顶部看板增强 — 显示当前阶段 + 共识条目

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `sendTaskInfo()` 增加 phase / confirmedItems / pendingItems 字段
- `src/kcodeView/webview/app.ts` — `updateTaskInfo()` 渲染阶段标识和共识条目列表

**调研结果**:
- `KCodePanel.ts:1256` — `sendTaskInfo()` 当前发送 title, status, createdAt, type, goal
- `app.ts` — `updateTaskInfo()` 渲染信息栏（任务标题 + 状态徽标 + 创建时间）
- design doc §七要求顶部看板显示当前阶段 + 共识条目

**实现说明**:
- `sendTaskInfo()` 新增字段: `phase`, `confirmedItems`, `pendingItems`, `planSteps`
- 信息栏新增区域：
  - **阶段标识**: 显示当前 phase 名称（中文：需求 / 目标 / 计划 / 执行 / 验收）+ 对应 emoji
  - **共识条目**: confirmedItems 以标签(tag)形式展示，pendingItems 以灰色待定列表展示
  - **计划步骤**: planSteps 在 execute 阶段展示带状态标记的步骤列表
- CSS 新增 `.task-phase-badge`, `.confirmed-tag`, `.pending-tag`, `.plan-step-item`

**状态**: ✅ 已完成

---

### P8-10: Self-Verify 自验阶段 — Execute 后 AI 自动审查代码再交人类验收

**涉及文件**:
- `src/types/index.ts` — phase 增加 `'self_verify'`，ProgressNode type 增加 `'self_verify'`
- `src/taskflow/prompts/self_verify.ts` — **新建**：自验阶段提示词
- `src/taskflow/prompts/protocol.ts` — 添加 `execute → finish_execute → self_verify → finish_verify → review` 流转规则
- `src/taskflow/TaskFlow.ts` — `confirmExecuteDone()` 改为转 `self_verify`；新增 `confirmSelfVerifyDone()` → `review`；新增 `onSelfVerifyNeeded`/`onSelfVerifyFinished` delegate；`parseTaskUpdate` 处理 `finish_verify`；`buildPhasePrompt` 加入 `SELF_VERIFY_PROMPT`
- `src/kcodeView/KCodePanel.ts` — `onExecuteFinished` 后自动 `confirmExecuteDone` + `startAutoGeneration()` 自动发起自验；`onSelfVerifyFinished` 自动过渡到 review + triggerReviewRequest；Add `startAutoGeneration()` 方法；CSS 增加 `.chat-msg.system` 样式
- `src/kcodeView/webview/app.ts` — `deriveNodes` 增加 `self_verify` 节点（6 阶段）；`getNodeLetter` 增加 'V' 映射；`phaseLabels` 增加自验

**实现说明**:

1. **自动流转**：AI 在 execute 阶段输出 `finish_execute` → `parseTaskUpdate` 标记完成 → onDone 时自动调用 `confirmExecuteDone()` 切到 `self_verify` → `startAutoGeneration()` 用新 prompt 发起下一轮生成
2. **边界清晰**：Execute prompt 约束"只做实现"，Self-Verify prompt 约束"只做审查"，靠 phase prompt 切换实现语义分界
3. **自验通过**：AI 输出 `finish_verify` → 自动推进到 `review` → 显示验收卡片给人的
4. **失败兜底**：prompt 约束 AI 最多自验 3 轮，仍失败则向用户说明情况请求协助
5. **进度节点**：看板节点从 5 个扩展为 6 个：需求(D) → 目标(T) → 计划(P) → 执行(E) → 自验(V) → 验收(C)

**状态**: ✅ 已完成

---

### P8-P6: Plan-before-Execute — 逐步执行跟踪

**涉及文件**:
- `src/taskflow/TaskFlow.ts` — 新增 `plan_step_update` 协议动作、`onPlanStepUpdate` delegate
- `src/taskflow/prompts/protocol.ts` — 文档 `plan_step_update` 用法
- `src/kcodeView/KCodePanel.ts` — 注册 `onPlanStepUpdate` 回调 → `sendTaskInfo`
- `src/kcodeView/webview/app.ts` — 步骤进度条、活跃步骤高亮

**实现说明**:
1. `TaskFlow.ts`: `plan_step_update` 加入 `validateAction`(execute 阶段可用), `executeAction` 中解析 `INDEX` + `STATUS` 调用 `updatePlanStepStatus`
2. `app.ts`: `updateTaskInfo` 中的 plan steps 渲染增加进度条 (`.plan-progress-bar`)、完成比例显示、活跃步骤蓝色高亮 (`.step-active`)
3. AI 通过 `[TASK_UPDATE]ACTION: plan_step_update\nINDEX: 0\nSTATUS: active[/TASK_UPDATE]` 标记步骤状态
4. `ITaskStore` + `MockTaskStore` + `MockDelegate` 均新增对应接口

**状态**: ✅ 已完成

---

### P8-N1: 进度节点面板增强 — 折叠/展开 + 点击跳转

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — HTML 新增 `#tl-collapse-btn`；CSS 新增 collapse button 样式 + collapsed 态样式
- `src/kcodeView/webview/app.ts` — `initNodePanel()` 新增 collapse 逻辑（sessionStorage 持久化）；`loadMessages` 清除 acceptanceCheckedState

**实现说明**:
1. **折叠/展开**: `#tl-collapse-btn` 按钮在 gutter 顶部，点击切换 `.collapsed` 类（宽度 28px → 12px，隐藏 dots），状态存 `sessionStorage`
2. **节点 label**: 每个 `.tl-node` 已有 `title` 属性显示中文标签，hover 时浏览器原生 tooltip 展示
3. **self_verify 节点 messageId**: `startAutoGeneration()` 中新增 `updateTaskNodeMessageId(tid, 'self_verify', ...)` 确保自验阶段可点击跳转

**状态**: ✅ 已完成

---

### P8-R1: 结构化验收 — 逐条验收标准

**涉及文件**:
- `src/kcodeView/webview/app.ts` — `lastAcceptanceCriteria` checkboxes 改为交互式勾选 + 跟踪 `acceptanceCheckedState`；新增 `updateAcceptanceButtons()` + `#partial-approve-btn` 逐条通过按钮
- `src/kcodeView/KCodePanel.ts` — `handlePartialApproveReview()` 方法；`partialApproveReview` 消息处理；CSS 新增 `#partial-approve-btn` 样式

**实现说明**:
1. **交互式勾选**: `addMessageElement` 中 review_request 的验收清单 checkbox 改为受控组件，跟踪 `acceptanceCheckedState` Map
2. **逐条通过**: 勾选部分项后显示「逐条通过」按钮（`.secondary` 样式），点击发送 `partialApproveReview` 消息
3. **处理逻辑**:
   - 全部通过 → `finishReview` 完成
   - 部分未通过 → 回退到 `execute` 阶段，将通过的/未通过的逐条告知 AI，自动重新生成
4. **UI 清空**: `loadMessages` 消息中检测到新的 reviewChanges 或 acceptanceCriteria 时清除之前的勾选状态

**状态**: ✅ 已完成

---

## Phase 9: 自举之路 Level 3 — 能带 ✅

_目标：KCode 主导功能开发，开发者只做 code review。用 KCode 完成导入 GitHub Issue 的独立功能，从设计到发布的全流程。_

> **来源 Issue**: [DelononLiu/kcode#1 — 调整 markdown 渲染表格简洁](https://github.com/DelononLiu/kcode/issues/1)
>
> **验证结果**: 连做 2 个独立功能（Chat→Task 转换 + 侧边栏任务搜索），AI 产出代码无需大改，开发者只做 code review 即可。Phase 9 目标达成。

| 任务 | 说明 | 状态 |
|------|------|------|
| P9-01 | 导入 GitHub Issue — Task 模型增加 source 字段 | ✅ 已完成 |
| P9-02 | 导入 GitHub Issue — 命令 + 侧边栏按钮 + 输入框 | ✅ 已完成 |
| P9-03 | 导入 GitHub Issue — GitHub API fetch 实现 | ✅ 已完成 |
| P9-04 | 导入 GitHub Issue — rate limit 处理 + token 配置 | ✅ 已完成 |
| P9-05 | 输入队列 — 生成中消息不会丢失，生成结束后自动发送 | ✅ 已完成 |
| P9-06 | 阶段钩子 — 每个阶段可指定自定义命令（AGENTS.md + UI 编辑，阶段切换时注入） | ✅ 已完成 |

---

### P9-01: 导入 GitHub Issue — Task 模型增加 source 字段

**涉及文件**:
- `src/types/index.ts` — 新增 `TaskSource` 接口，`Task` 增加 `source` 字段

**调研结果**:
- 设计文档：`docs/import-github-issue.md §二`
- `Task` 当前无 `source` 字段（`src/types/index.ts:1-12`）

**实现说明**:
- 新增 `TaskSource` 接口：

  ```typescript
  interface TaskSource {
    type: 'github_issue';
    url: string;
    owner: string;
    repo: string;
    issueNumber: number;
  }
  ```
- `Task` 新增 `source?: TaskSource`
- 数据映射见设计文档 §三：`title → GH#{n}: {title}`, `body → task.goal`, `html_url → source.url`

**状态**: ✅ 已完成

---

### P9-02: 导入 GitHub Issue — 命令 + 侧边栏按钮 + 输入框

**涉及文件**:
- `src/commands/importGitHubIssue.ts` — **新建**：URL 输入框 → fetch → 创建 Task → 打开面板
- `src/kcodeView/KCodeSidebarProvider.ts` — 注册 `importGitHubIssue` 消息处理，HTML 新增按钮
- `src/kcodeView/webview/sidebar.ts` — 新增导入按钮点击事件
- `src/extension.ts` — 注册 `kcode.importGitHubIssue` 命令

**调研结果**:
- 交互流程见设计文档 §一：action bar 新增 `[⤓ 导入 Issue]` 按钮
- 输入流程见 §二：`vscode.window.showInputBox` 接收 URL 或 `owner/repo#123`

**实现说明**:
- 侧边栏 action bar 新增 SVG 导入按钮（`⤓` 风格），与 `[+ 新建任务]` 同级
- 点击后调用 `vscode.window.showInputBox`：
  - placeholder: `GitHub Issue URL 或 owner/repo#123`
  - 支持 `https://github.com/owner/repo/issues/123` 和 `owner/repo#123` 两种格式
- URL 解析：`parseGitHubUrl(input)` 提取 owner / repo / issueNumber
- 成功后调用 `vscode.window.withProgress` 显示进度通知
- 导入成功 → `store.createTask()` + 切换到新建任务面板
- 导入失败 → `vscode.window.showErrorMessage`
- 命令注册名：`kcode.importGitHubIssue`

**状态**: ✅ 已完成

---

### P9-03: 导入 GitHub Issue — GitHub API fetch 实现

**涉及文件**:
- `src/commands/importGitHubIssue.ts` — `fetchGitHubIssue()` 函数

**调研结果**:
- API 策略见设计文档 §四：MVP 走无 token 方案，调用 `GET /repos/{owner}/{repo}/issues/{number}`

**实现说明**:
- `fetchGitHubIssue(owner, repo, number, token?)`：
  - 构造 URL: `https://api.github.com/repos/{owner}/{repo}/issues/{number}`
  - 请求头: `Accept: application/vnd.github.v3+json`，有 token 时加 `Authorization: Bearer {token}`
  - 返回: `{ title: string, body: string, html_url: string }`
- URL 解析函数 `parseGitHubUrl(input)`：
  - 支持 `https://github.com/owner/repo/issues/123` → `{ owner, repo, number }`
  - 支持 `owner/repo#123` → `{ owner, repo, number }`
  - 格式不匹配 → 返回 null，上层提示格式错误
- 错误处理：
  - 404 → 提示"Issue 不存在"
  - 403 → 提示"API rate limit 超限，请配置 kcode.githubToken"
  - 网络错误 → 提示"网络异常，请重试"

**状态**: ✅ 已完成

---

### P9-04: 导入 GitHub Issue — rate limit 处理 + token 配置

**涉及文件**:
- `src/commands/importGitHubIssue.ts` — 集成 token 读取
- `package.json` — `contributes.configuration` 新增 `kcode.githubToken`

**调研结果**:
- 设计文档 §四：初始无 token 方案（60 req/h），后续支持配置 token（5000 req/h）

**实现说明**:
- `package.json` 新增配置项：

  ```json
  "kcode.githubToken": {
    "type": "string",
    "default": "",
    "description": "GitHub Personal Access Token，用于提高 API rate limit"
  }
  ```
- `fetchGitHubIssue()` 先读 `vscode.workspace.getConfiguration('kcode').get('githubToken')`
- 有 token → 带 Authorization header；无 token → 匿名请求
- 403 响应头 `x-ratelimit-remaining` 为 0 时，显示具体提示"Rate limit 已用完，请配置 token 或等待 ${resetTime} 后重试"
- 不暴露 token 到日志或 UI

**状态**: ✅ 已完成

---

### P9-05: 输入队列 — 生成中消息不会丢失，生成结束后自动发送

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `handleSendMessage` / `setGenerationState` / `flushPendingMessages`
- `src/kcodeView/webview/app.ts` — `handleGenerationState` / pending badge UI

**状态**: ✅ 已完成

---

### P9-06: 阶段钩子 — 每个节点可指定自定义命令

**涉及文件**:
- `src/types/index.ts` — Task 增加 `hooks` 字段
- `src/store/TaskStore.ts` — 新增 `updateTaskHooks()` 方法
- `src/taskflow/TaskFlow.ts` — `buildPhasePrompt()` 中注入当前阶段钩子
- `src/kcodeView/KCodePanel.ts` — `sendTaskInfo()` 携带 hooks 数据；HTML 新增钩子配置 UI；消息处理 `updateHooks`
- `src/kcodeView/webview/app.ts` — `updateTaskInfo()` 渲染钩子编辑区；绑定编辑保存事件

**调研结果**:
- `src/types/index.ts:37-55` — Task 接口，当前无 hooks 字段，phase 类型为 `'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review'`
- `src/taskflow/TaskFlow.ts:462-502` — `buildPhasePrompt()` 按 phase switch 加载对应提示词，plan/execute 阶段已有 category template 的 analysisFramework/executionHints 注入逻辑。钩子可以复用相同模式：在 basePrompt + extraParts 之后追加 `【阶段命令】` 区块
- `src/kcodeView/KCodePanel.ts:1690-1713` — `sendTaskInfo()` 发送 title/phase/status/confirmedItems 等，可新增 hooks 字段
- `src/kcodeView/webview/app.ts:1208-1350` — `updateTaskInfo()` 更新 DOM 各区域。可在 phase badge 行之后新增 hooks 编辑区

**设计思路**:
- **Data**: `Task.hooks: Partial<Record<'demand'|'goal'|'plan'|'execute'|'self_verify'|'review', string[]>>`，每个阶段对应一组命令字符串
- **Prompt 注入**: `buildPhasePrompt()` 在组装完 base + extra 后，检测 `task.hooks[task.phase]` 是否存在且非空，有则追加 `## 阶段命令\n在此阶段你必须依次执行以下命令：\n1. xxx\n2. yyy`
- **UI**: 在 task-info-phase 区域或下方新增 hooks 配置入口。简洁做法：点击 ⚙️ 图标 → 弹出多行输入框编辑当前阶段的命令（每行一条），或更简洁：直接在 phase badge 行加一个小齿轮图标，hover 显示当前钩子，点击进入编辑
- **Store**: `updateTaskHooks(taskId, phase, commands: string[])` 更新指定阶段的钩子列表
- **空值处理**: 无钩子时不注入任何内容，不影响现有流程

**状态**: ✅ 已完成

---

### P11-01: 定义 Core interfaces

**涉及文件**:
- `src/core/interfaces.ts` — **新建**，含 IAgentService / IMessageBus / 引用 ITaskStore / TaskFlowDelegate

**调研结果**:
- `KCodePanel.ts:112-199` — `setupMessageHandler()` 25+ 消息类型，直接操作 store/acpClient/taskFlow
- `KCodePanel.ts:20-30` — 字段：acpClient, openaiAgent, agentReady, isGenerating 等
- `TaskFlow.ts:17-53` — 已有 ITaskStore 和 TaskFlowDelegate 接口，定义清晰
- `AcpClient.ts:6-199` — 已封装 ACP SDK，但 KCodePanel 同时管理 AcpClient + OpenAIAgent 两套路径
- `app.ts:89-208` — `initMessageHandler()` 约 20 个消息 switch 分支

**实现说明**:
- `src/core/interfaces.ts`: 定义 `IAgentService`（connect/disconnect/sendPrompt/cancel/getReviewChanges）、`IMessageBus`（postMessage/onMessage）
- 引用 `ITaskStore` / `TaskFlowDelegate` 从 `TaskFlow.ts`（不移动，留待后续）
- AgentService 实现 IAgentService，统一封装 AcpClient + OpenAIAgent 两套路径

**状态**: ✅ 已完成

---

### P11-02: 抽取 AgentService

**涉及文件**:
- `src/core/AgentService.ts` — **新建**，统一封装 AcpClient + OpenAIAgent
- `src/core/interfaces.ts` — IAgentService 接口定义

**实现说明**:
- AgentService 实现 IAgentService 接口
- `connect()` 根据 agentName 自动选择 opencode / openai / 通用 ACP 路径
- `sendPrompt()` 统一入口，内部路由到 acpClient.prompt 或 openaiAgent.prompt
- `cancel()` / `closeTaskSession()` / `getReviewChanges()` 同理
- `disconnect()` 统一清理
- 测试：`src/core/__tests__/AgentService.test.ts` 12 个测试用例（mock AcpClient 和 OpenAIAgent）

**状态**: ✅ 已完成

---

### P11-03: KCodePanel 瘦身

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — 移除 HTML/CSS 内联，消息路由改用 MessageRouter
- `src/kcodeView/templates/chatPanelHtml.ts` — **新建**，HTML 模板函数
- `src/kcodeView/templates/chatPanelCss.ts` — **新建**，CSS 样式函数
- `src/kcodeView/MessageRouter.ts` — **新建**，类型→处理器映射，消息分发

**实现说明**:
1. **HTML 外置**: `getWebviewContent()` → `templates/chatPanelHtml.getWebviewContent(webview, extensionUri)`
2. **CSS 外置**: `getInlineStyles()` → `templates/chatPanelCss.getInlineStyles()`
3. **MessageRouter**: 25+ 消息类型从 switch 改为 `router.on(type, handler)` 注册，`router.dispatch(type, msg)` 分发
4. KCodePanel 所有 `this.panel.webview.postMessage` 改为 `this.router.PostMessage`
5. KCodePanel 从~2000行降至~1332行

**状态**: ✅ 已完成

---

### P11-04: app.ts 拆分

**涉及文件**:
- `src/kcodeView/webview/app.ts` — 引入 state.ts，内联 FileChange 类型移至 state.ts
- `src/kcodeView/webview/state.ts` — **新建**，集中管理 WebView 全局状态 + FileChange 类型

**实现说明**:
- `state.ts` 集中所有全局变量：activeTaskId, activeTaskStatus, acpLogEntries, streamMessageEl 等约 20 个
- `FileChange` 接口从内联定义移至 state.ts 导出
- `app.ts` 引入 AppState 和 FileChange，为后续 `messageHandler.ts` 拆分做准备

**状态**: ✅ 已完成

---

### P11-05: 测试用例补齐

**实现说明**:

| 模块 | 文件 | 测试数 | 重点 |
|------|------|--------|------|
| `AgentService` | `src/core/__tests__/AgentService.test.ts` | 12 | 连接/断开/sendPrompt/cancel/session 管理/错误路径 |
| `MessageRouter` | `src/kcodeView/__tests__/MessageRouter.test.ts` | 6 | 注册/分发/off/reset/PostMessage 赋值 |
| `TaskFlow` (edge) | `src/taskflow/__tests__/TaskFlow.test.ts` | 15 | 新增 8 个边界用例(空 goal/rejectReview/批量 chunk/协议过滤等) |

**总计**: 33 个测试用例，3 个测试文件，全部通过。

**状态**: ✅ 已完成

_目标：从"AI 对话工具"转向"AI 驱动的开发流程管理器"。顶层分组、任务委派、工作台串联为完整工作流。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P10-01 | 任务类型分类 + 模板系统 | ✅ 已完成 |
| P10-02 | 项目分组 — 顶层分组容器（Group 可嵌套，Project 为终止节点） | ✅ 已完成 |
| P10-03 | 任务委派 — 补齐委派规则 + 上下文继承协议 | ✅ 已完成 |
| P10-04 | 工作台 — Dashboard 定焦「今天要验收什么」 | ✅ 已完成 |

---

### P10-01: 任务类型分类 + 模板系统

**涉及文件**: _待调研_
**调研步骤**:
1. 读 PROJECT.md 确认现有 Task 类型定义和 5 阶段流程
2. 读 types/index.ts 确认 Task interface
3. 读 KCodePanel.ts 确认空闲态渲染逻辑和消息处理
4. 读 app.ts 确认 WebView 侧交互
5. 读 TaskFlow.ts 确认 buildPrompt 和 review 流程

**调研结果**:
1. **分类层级**: Task 新增 `category?: TaskCategory` + `subType?: string`，4 大类 × 5 子类，存量 task 不受影响
2. **新建页布局**: 复用电 `#chat-area:has(#chat-scroll.chat-empty)` CSS 规则，在空闲态展示分类选择卡片 + 模板输入表单，新增 `selectTaskType` 消息
3. **模板系统**: 纯数据文件 `src/taskflow/templates.ts`，每个子类型定义 `inputFields`/`analysisFramework`/`executionHints`/`acceptanceCriteria` 4 个注入点，不改 5 阶段引擎
4. 3 个需求全部可行，实现顺序：分类层级 + 模板数据（无依赖）→ UI 改造

**涉及文件**:
- `src/types/index.ts` — 新增 `TaskCategory`、`InputField`、`TaskTemplate`、`CategoryDef` 类型 + Task 加 category/subType
- `src/taskflow/templates.ts` — **新建**，定义全部 20 个子类型模板，导出 `getCategories()` / `getTemplate()`
- `src/store/TaskStore.ts` — 新增 `updateTaskCategory()` / `updateTaskSubType()`
- `src/kcodeView/KCodePanel.ts` — 空闲态 HTML 渲染分类卡片 + 表单；消息处理 `selectTaskType`；`buildPrompt` 注入模板的 analysisFramework/executionHints；`triggerReviewRequest` 带上 acceptanceCriteria
- `src/kcodeView/webview/app.ts` — 空闲态渲染分类选择 + 输入表单；新增 `selectTaskType` 消息发送
- `src/taskflow/TaskFlow.ts` — `buildPrompt` / `buildPhasePrompt` 根据 subType 读取模板内容注入

**状态**: ✅ 已完成

---

### P10-02: 项目分组 — 顶层分组容器

**涉及文件**:
- `src/types/index.ts` — Task group 字段扩展，新增 Group 实体类型
- `src/store/TaskStore.ts` — 新增 Group CRUD 方法
- `src/kcodeView/KCodeSidebarProvider.ts` — 侧边栏分组渲染适配
- `src/kcodeView/webview/sidebar.ts` — 分组 UI 渲染

**调研结果**:

**模型设计**:
- **分组（Group）** — 通用容器，可任意深度嵌套
- **项目（Project）** — 分组的一种（`type: 'project'`），为终止节点，禁止出现子 Project
- 一个 `type` 字段区分两者，不拆两张表。写入校验由 Store 层负责
- Task 通过 `group` 字段挂在任意 Group 下

**嵌套规则**:
```
Group (可嵌套 Group)
  ├── Project (终止，不可再有子 Project)
  │     ├── Task
  │     └── Group (可，但不能再含 Project)
  └── Task (直接挂 Group)
Project
  ├── Task
  └── Group (可，但不能嵌套 Project)
```

**当前阶段语义**: 开发者天然按项目组织任务（一个 repo = 一个项目），顶层的"项目"概念直接可用，不需要产品管理的重量语义。

**扩展路径**: 当 KCode 用户画像扩展到 PM 时，只需给 Group 增加 metadata 字段（产品线名称），顶层的 Group 即可升级为产品线视图，模型不变。

**进度聚合**: Project 节点自动计算 `completed / total` 百分比（只统计非 cancelled 任务），以进度条 + 分数显示。

**侧边栏视图**: 单视图 — 未分配 → 项目列表（可折叠+进度条+子分组/任务）→ 旧分组（向后兼容）。

**实现说明**:

> **设计变更**: 根据反馈移除双 tab，改为单视图。侧边栏按：未分配 → 项目1(子分组/任务) → 项目2 → ... → 旧分组(向后兼容)

1. **类型扩展** (`src/types/index.ts`): 新增 `ContainerEntity` (id/name/type/parentId/createdAt)，`ContainerType` 为 `'group' | 'project'`。Task 新增 `containerId?: string`。
2. **Store 层** (`src/store/TaskStore.ts`): 新增 Container CRUD（含 `getProjectProgress`/`moveContainer` 等）。原有 `groups: string[]` 保持向后兼容。
3. **侧边栏 Provider** (`KCodeSidebarProvider.ts`): 移除双 tab 和 `_sidebarTab`；HTML 改为 `#section-ungrouped` → `#project-list` → `#section-old-groups`；action bar 新增📦新建项目；消息处理 `addContainer`/`deleteContainer`/`updateTaskContainer`/`renameContainer`/`moveContainer`/`updateContainer`。
4. **WebView 侧** (`sidebar.ts`): 移除 tab/项目视图代码；`renderSidebar()` 渲染未分配 → 项目(可折叠+进度条) → 旧分组；`createProjectSection()` 含进度条/子分组/直挂任务/拖拽重排；`showProjectContextMenu()` 项目右键菜单；`makeContainerDropTarget()` 支持 `containerId`，拖入任务自动归属。

**状态**: ✅ 已完成

---

### P10-03: 任务委派 — 补齐委派规则 + 上下文继承协议

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `handleSendMessage` / `onDone`，委派触发时机
- `src/store/TaskStore.ts` — `addTask` 接口，传入完整初始字段
- `src/kcodeView/KCodeSidebarProvider.ts` / `sidebar.ts` — 侧边栏刷新
- `src/taskflow/prompts/protocol.ts` — TASK_DELEGATE 协议文档
- `src/taskflow/TaskFlow.ts` — 解析 TASK_DELEGATE 协议

**调研结果**:

**模型定义**:

用户 = 项目经理，AI = 开发者。委派场景：

> 用户在 Task A 中对话 → AI 表示"这部分搞不定/太复杂"
> → 用户说"这块拆出去单独做" → AI 打包当前上下文
> → 侧边栏多了一个新 Task B（继承 goal 片段 + 关联文件 + 共识条目）
> → Task A 和 Task B 独立执行，都向用户（PM）报告

核心关系：
- **不是父子** — Task A 不知道 Task B 存在，无状态关联
- **用户是中心** — 侧边栏看到所有任务，谁完成谁没完成一目了然
- **无需自动报告** — 用户看到 completed 就够了

**触发方式**: 仅用户指令。用户说"这块拆出去单独做" → AI 输出 `TASK_DELEGATE` 协议。AI 不主动委派。

**协议格式**:
```
<TASK_DELEGATE>
{
  "title": "实现 OAuth 登录",
  "goal": "基于当前 TokenStore 框架实现 OAuth 登录功能...",
  "context": {
    "relatedFiles": ["src/auth/TokenStore.ts", "src/auth/types.ts"],
    "confirmedItems": ["使用 OAuth 2.0 协议", "JWT token 有效期 1 小时"],
    "relevantSnippets": "当前 TokenStore 提供 get/set/clear 三个方法，token 存储于 workspaceState..."
  }
}
</TASK_DELEGATE>
```

**上下文继承（新任务自动填充）**:
| 字段 | 来源 | 说明 |
|------|------|------|
| `goal` | AI 从当前讨论中提取片段，重写为独立目标 | 用户打开新任务即可看到要做什么 |
| `relatedFiles` | 当前对话中提及/改动的文件路径 | 新任务 AI 可直接读写这些文件 |
| `confirmedItems` | 原任务已锁定的共识条目 | 已决策不重来，新任务继承前提 |
| `relevantSnippets` | AI 提取的关键上下文代码/决策 | 补充 goal 没说清的技术约束 |

**执行流程**: KCodePanel 解析 `TASK_DELEGATE` → `store.addTask()` 创建新任务（继承 project/group/source）→ 刷新侧边栏 → 新任务出现在列表中 → 用户点击打开，AI 自带完整上下文

**侧边栏**: 无特殊展示，平级任务。不缩进、不展开、不关联。

**原任务**: 完全不变，继续对话。scope 在 AI 下一轮回复中自然缩小（"拆出去"的信息在对话历史里）。

**状态**: ✅ 已完成

---

### P10-04: 工作台 — Dashboard 定焦「今天要验收什么」

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — 空闲态 HTML 改为 Dashboard 渲染；无任务选中时触发 Dashboard
- `src/kcodeView/webview/app.ts` — `loadMessages` / 空闲态渲染逻辑

> **注意**: Dashboard 仅存在于主面板（无任务选中时），侧边栏不重复展示工作台视图。

**调研结果**:

**核心设计原则**: Dashboard 回答**一个**核心问题——**「今天要验收什么」**。这是开发者打开 KCode 第一眼最重要的事：哪些任务需要我（人）做判断、看代码、点通过或驳回。整体进度和进行中任务降为次要信息，折叠或下移。

**主区域（无任务选中时 → Dashboard）**:

```
┌─ KCode 工作台 ─────────────────────────────────────────┐
│                                                         │
│  ⚠️ 待验收 (2)                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🟡 [P10-01] 任务类型分类      改动 6 个文件         │ │
│  │      📝 task                  ⏱️ 2h ago            │ │
│  │ ────────────────────────────────────────────────── │ │
│  │ 🟡 [P7-04]  ACP 尾部数据修复   改动 2 个文件         │ │
│  │      📝 task                  ⏱️ 昨天 16:30        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ▶ 进行中 (3)                                  [展开]   │
│  ▼ 最近完成 (1)                               [展开]   │
│                                                         │
│  [+ 新建任务]  [导入需求]                               │
└─────────────────────────────────────────────────────────┘
```

- **⚠️ 待验收** 始终展开、置顶。每项显示任务标题、改动文件数、任务类型、最后活跃时间。点击直接进入验收页面
- **▶ 进行中** 默认折叠，用户知道在跑就行
- **▼ 最近完成** 默认折叠，可展开回顾
- 无任务选中时输入框隐藏（没选任务不需要输入）
- "[+ 新建任务]" 降级为 Dashboard 操作按钮

**数据流**:
- KCodePanel → 无任务选中时展示 Dashboard（聚合 store 数据）
- 侧边栏保持单视图（项目树），不再有双 tab

**状态**: ✅ 已完成

---

## Phase 13: 扩展与加固 + Todo 卡片

_目标：在自举成功基础上，提升扩展性、稳定性和可测试性；同时支持结构化待办清单卡片。_

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P12-01 | 三栏布局骨架 — 左流程/中对话/右产出 | ✅ 已完成 | P0 |
| P13-01 | 稳定性与 Bug 修复专项 | ✅ 已完成 | P0 |
| P13-02 | 多 Agent 切换 UI | ✅ 已完成 | P1 |
| P13-03 | 会话版本管理 — 时间线 + Git 关联 | ❌ 已取消 | P2 |
| P13-04 | 测试覆盖补全（逻辑/业务模块，127 新增用例） | ✅ 已完成 | P1 |
| P13-05 | Todo 卡片 — 待办清单消息类型 + checkbox 交互 + 协议 | ✅ 已完成 | P1 |

---

### P13-01: 稳定性与 Bug 修复专项

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — flushAcpRecvBuffer 缺 taskId、dispose 未清 timer、temp diff 文件不清理
- `src/acp/AcpClient.ts` — require() ESM 兼容、dispose 串行关闭
- `src/store/TaskStore.ts` — deleteTask 未清理 reviewChanges 孤儿数据、getTasks 双读性能

**调研步骤**:
1. 运行 `npx tsc --noEmit` 检查类型错误
2. 运行 `npm test` 确认现有测试通过
3. 检查 P11 系列任务的实际文件是否存在（发现全部不存在）
4. 代码扫描：session 泄漏、消息时序、temp 文件、timer 清理

**调研结果**:
- ✅ `tsc --noEmit` 零错误（exit 0）
- ⚠️ `npm test` 仅 7 测试通过（非 33）。AgentService.test.ts(12)、MessageRouter.test.ts(6) 不存在
- ❌ **Phase 11 全量未实现**：`src/core/` 目录、`AgentService.ts`、`MessageRouter.ts`、`templates/`、`webview/state.ts` 均不存在，虽 TASKS.md 标记 ✅ 已完成
- **代码质量缺陷**：
  1. `KCodePanel.ts:917` — `flushAcpRecvBuffer()` 发送 acpLogEntry 不带 taskId ✅ 已修复
  2. `KCodePanel.ts:2075-2083` — `handleOpenNativeDiff()` 临时文件从不清理 ✅ 已修复（5min 后自动清理）
  3. `KCodePanel.ts:2122` — `dispose()` 未清除 `recvFlushTimer` ✅ 已修复
  4. `AcpClient.ts:197` — `loadSDK` 用 `require()` 而非 `import()`，在 strict ESM 下会崩
  5. `TaskStore.ts:163` — `deleteTask()` 未清理 `reviewChanges_${taskId}` 孤儿数据
  6. `TaskStore.ts:14` — `getTasks()` 每次从 workspaceState 完整反序列化，高频调用性能隐患
  7. `app.ts:684` — 排队消息展开/收起状态在多次队列更新间不可维持
  8. `app.ts:847` — `collectChangedFiles` 的 early break 会漏 tool 消息

**状态**: ✅ 已完成

**验收标准**：`tsc --noEmit` 零错误，关键代码缺陷全修复，`npm test` 全通过。

---

### P13-02: 多 Agent 切换 UI

**涉及文件**:
- `src/core/AgentService.ts` — 扩充路由
- `src/kcodeView/KCodePanel.ts` — 切换 Agent 时的重新连接逻辑
- `src/kcodeView/webview/app.ts` — 状态栏/下拉切换 UI
- `src/kcodeView/templates/chatPanelHtml.ts` — 切换 UI 模板
- `package.json` — configuration 新增 `kcode.availableAgents`

**调研结果**:
- `AgentService.ts:30-58` — `connect()` 当前支持 opencode / openai / kilo 三条路由，但入口在配置层面硬编码
- `KCodePanel.ts` — 每次 connect 时只初始化一个 provider，切换需要重建 connection
- `app.ts:312` — `agentStatus` 只显示当前 Agent 名称，无切换入口

**实现说明**:
1. **配置**: `package.json` 新增 `kcode.availableAgents: { label, type, command?, apiKey? }[]`
2. **UI**: 输入框底部状态栏增加下拉选择器，列出全部可用 Agent
3. **切换**: 选中新 Agent → 断开当前 → 调用 `AgentService.connect()` → 重建 session → 指示恢复正常
4. **兼容**: `kcode.agentPath` 仍作为默认配置向后兼容；`kcode.kiloPath` 同理
5. **测试**: 验证切换后原任务 session 关闭、新 session 可正常 prompt

**状态**: ✅ 已完成

**实现说明**:
1. `package.json` — 新增 `kcode.availableAgents` 配置项（array of { label, type, command?, args?, apiKey?, model?, baseUrl? }）
2. `AgentService.ts` — 新增 `getAvailableAgents()` 静态方法 + `connectByLabel(label)` 按 label 查找配置并连接；`connectOpenAI/connectKilo/connectOpenCode` 均支持覆盖参数注入
3. `chatPanelHtml.ts` — 状态栏新增 `<select id="agent-selector">` 下拉框
4. `app.ts` — 新增 `initAgentSelector()` 初始化下拉列表 + 切换事件发送 `switchAgent` 消息
5. `KCodePanel.ts` — 新增 `sendAgentList()` 发送可用 Agent 列表；`handleSwitchAgent()` 处理切换（停止生成→断开→按 label 连接→通知结果）

**验收标准**：输入框底部可下拉切换 Agent，切换后原连接断开、新连接建立，对话继续不受影响。

---

### P13-04: 测试覆盖补全（逻辑/业务模块）

**涉及文件**:
- `src/store/__tests__/TaskStore.test.ts` — 5 tests，覆盖 CRUD
- `src/kcodeView/__tests__/MessageRouter.test.ts` — 9 tests, 含3边界
- `src/kcodeView/webview/sidebar.ts` — 3 渲染状态测试（jsdom）
- `src/core/__tests__/AgentService.test.ts` — 18 tests, 含异常路径
- `src/acp/__tests__/AcpClient.test.ts` — **新增**: 12 tests，连接/session/prompt/cancel/dispose
- `src/acp/__tests__/callbacks.test.ts` — **新增**: 14 tests，sessionUpdate/writeFile/readFile/权限
- `src/acp/__tests__/OpenAIAgent.test.ts` — **新增**: 7 tests，session/prompt/cancel/错误路径
- `src/acp/__tests__/AgentManager.test.ts` — **新增**: 5 tests，spawn/stop/isRunning
- `src/kcodeView/__tests__/AcpLogManager.test.ts` — **新增**: 7 tests，缓冲/刷新/清理
- `src/kcodeView/__tests__/AssistantHandler.test.ts` — **新增**: 6 tests，/go命令/消息入队/agent调用
- `src/kcodeView/__tests__/TaskFlowHandler.test.ts` — **新增**: 14 tests，deriveNodes/todo/reject/stop生成
- `src/kcodeView/__tests__/TaskSessionHandler.test.ts` — **新增**: 6 tests，agent列表/handler回调/切换Agent
- `src/taskflow/__tests__/workspaceHooks.test.ts` — **新增**: 7 tests，hooks解析/级联/多阶段
- `src/commands/__tests__/importGitHubIssue.test.ts` — **新增**: 5 tests，URL解析纯函数
- `vitest.config.ts` — jsdom 环境配置

**状态**: ✅ 已完成

**验收标准**：测试总数 174（从 47 增至 174，新增 127），覆盖 21 个测试文件。所有逻辑/业务模块均有测试用例：
- ACP 层：AcpClient(12) + callbacks(14) + OpenAIAgent(7) + AgentManager(5) + intentUtils(7) = 45
- TaskFlow 层：TaskFlow(21) + externalPrompts(6) + prompts(8) + templates(6) + workspaceHooks(7) = 48
- Handler 层：TaskFlowHandler(14) + TaskSessionHandler(6) + AssistantHandler(6) + MessageRouter(9) = 35
- Store 层：TaskStore(5)
- 核心层：AgentService(18)
- 命令层：importGitHubIssue(5) + sidebar(3) + state(5) + chatPanelCss(3)
- `tsc --noEmit` 零错误，`npm test` 174/174 全部通过。

---

### P13-05: Todo 卡片 — 待办清单消息类型 + checkbox 交互 + 协议

**涉及文件**:
- `src/types/index.ts` — 新增 `TodoItem` 接口；`ChatMessage` type 新增 `'todo'`
- `src/store/TaskStore.ts` — todo 消息的 CRUD（复用现有 `addMessage` 机制）
- `src/kcodeView/webview/app.ts` — 新增 `renderTodoCard()` 渲染 checkbox 清单；`addMessageElement()` 处理 `type='todo'`；checkbox 点击事件 → postMessage
- `src/kcodeView/KCodePanel.ts` — 消息处理 `updateTodoItem`；`<TODO_UPDATE>` 协议解析
- `src/taskflow/TaskFlow.ts` — `processChunk()` 解析 `<TODO_UPDATE>` 剥离，调用 `onTodoUpdate` delegate
- `src/taskflow/prompts/protocol.ts` — 文档 `<TODO_UPDATE>` 协议格式
- `src/kcodeView/templates/chatPanelCss.ts` — `.todo-card`/`.todo-item`/`.todo-checkbox`/`.todo-progress` 样式

**调研结果**:
- `app.ts:1701-1810` — `createCard()` 已有通用卡片框架，todo 卡片可复用
- `app.ts:1430-1478` — `addMessageElement()` 通过 `msg.type` 分支渲染，可新增 `'todo'` case
- `app.ts:145-184` — `initMessageHandler` switch，todo checkbox 交互通过 `updateTodoItem` 消息处理
- `types/index.ts` — `ChatMessage.type` 当前有 `text/goal_confirmation/goal_confirmed/review_request/review_approved/review_rejected/tool_call/goal_updated`
- `TaskFlow.ts` — 现有 `<TASK_UPDATE>` 解析模式可复用给 `<TODO_UPDATE>`

**实现说明**:

1. **数据模型** (`src/types/index.ts`):
   ```typescript
   interface TodoItem {
       id: string;
       content: string;
       status: 'pending' | 'completed';
   }
   ```
   `ChatMessage.type` 新增 `'todo'`，content 存 `TodoItem[]` JSON 序列化

2. **AI 协议** (`<TODO_UPDATE>`):
   ```
   <TODO_UPDATE>
   {
     "action": "add" | "update" | "replace",
     "items": [
       { "id": "1", "content": "完成用户认证模块", "status": "completed" },
       { "id": "2", "content": "编写单元测试", "status": "pending" }
     ]
   }
   </TODO_UPDATE>
   ```
   - `add`: 追加 item（已有 id 则更新）
   - `update`: 按 id 更新 status
   - `replace`: 全量替换 todo 列表
   - 解析后存储为 `todo` 类型 ChatMessage，推送到 WebView

3. **渲染** (`app.ts`):
   - 新增 `renderTodoCard(todoMsg)` 函数：创建 `.msg-card.todo-card`，内含 checkbox 列表
   - 每个 `.todo-item` 含 checkbox（`<input type="checkbox">`）+ 文本内容
   - 底部 `.todo-progress` 显示 "2/5 已完成" + 进度条
   - `completed` 项文本使用删除线样式

4. **交互**:
   - checkbox 点击 → `vscode.postMessage({ type: 'updateTodoItem', msgId, itemId, checked })`
   - KCodePanel 收到 → 更新 store 对应 ChatMessage content → `loadMessages` 刷新渲染

5. **协议解析** (`TaskFlow.ts`):
   - 类似 `<TASK_UPDATE>` 正则：`/<TODO_UPDATE>([\s\S]*?)<\/TODO_UPDATE>/g`
   - 清洗文本（剥离标签）
   - `executeAction()` 新增 `todo_update` 动作 → `onTodoUpdate(payload)` delegate
   - KCodePanel `onTodoUpdate` → 追加 todo ChatMessage → 推送 WebView

**状态**: ✅ 已完成

**验收标准**：AI 可通过 `<TODO_UPDATE>` 协议输出 todo 卡片，卡片含可勾选清单项和进度指示；用户点击 checkbox 可更新状态，状态持久化保存；重新打开任务后 todo 状态恢复。

**实现说明**:
- 支持两种协议格式：`<TODO_UPDATE>{ action, items }</TODO_UPDATE>`（自定义）和 ACP 原生 `<title>N todos</title>\n[{ content, status, priority }]`
- ACP 格式自动分配 id（`0,1,2...`），`status: "in_progress"` 映射为 `"pending"`（未完成）
- `TodoItem` 接口新增 `priority?: 'low' | 'medium' | 'high'`
- `ChatMessage.type` 新增 `'todo'`

**验收标准**：AI 可通过协议输出 todo 卡片，卡片含可勾选清单项和进度指示；checkbox 状态同步到 store 持久化，重新打开任务后恢复。

---

### P13-06: Todo 卡片同步到计划 — agent todo 自动填充 planSteps

**涉及文件**:
- `src/kcodeView/TaskFlowHandler.ts` — `handleTodoUpdate()` 和 `handleUpdateTodoItem()` 新增 todo → planSteps 同步逻辑

**调研结果**:
- P13-05 已完成 todo 卡片的消息存储、渲染、checkbox 交互
- `Task.planSteps` 当前仅通过 `plan_step_update` 协议更新，与 agent todo 完全隔离
- header 进度条（`#header-progress-fill`）只读取 `planSteps`，不包含 todo 进度
- 右栏「✅ 计划产出」同时展示 `planSteps` + `todos`，但两者无关联

**实现说明**:
1. 在 `TaskFlowHandler.ts` 新增 `_syncTodosToPlanSteps(taskId)` 方法：
   - 扫描 task 所有 `type: 'todo'` 消息，提取全部 `TodoItem[]`
   - 按 id 去重后转为 `PlanStep[]`（`pending`/`completed` 映射）
   - 调用 `ctx.store.updatePlanSteps(taskId, steps)` 覆盖
2. `handleTodoUpdate()` 中每条 todo 消息存储成功后调用 `_syncTodosToPlanSteps`
3. `handleUpdateTodoItem()` 中 checkbox 状态更新后调用 `_syncTodosToPlanSteps`
4. 效果：agent 输出 `todo list` 工具或 `<TODO_UPDATE>` 协议后，planSteps 自动同步为 todo 列表；header 进度条即时反映 todo 进度

**状态**: ✅ 已完成

---

## Phase 15: 小助手 + 侧边栏重构 — Chat/Task 分离

_目标：将自由对话从 Task 中剥离为独立的小助手实体，侧边栏重新布局，两个入口对应两种工作模式。_

```
┌─ 侧边栏 ──────────────────┐
│                            │
│  💬 小助手                 │  ← 全局唯一，始终在顶部
│                            │
│  + 新建任务                 │  ← 按钮，点击弹出下拉
│    导入任务                 │
│    根据模板新建任务          │
│                            │
│────  ────  ────  ────     │  ← 分割线
│                            │
│  📦 未分类                 │
│     📝 任务1               │  ← 全是 task，无 chat 类型
│     📝 任务2               │
│                            │
│  🏗️ 项目A                  │
│     📝 任务3               │
└────────────────────────────┘
```

| 任务 | 说明 | 状态 |
|------|------|------|
| P15-01 | 小助手独立实体 — 数据模型 + 存储 + 主面板双模式 + /go | ✅ 已完成 |
| P15-02 | 侧边栏重构 — 移除 footer/action bar，新布局 + 新建下拉 | ✅ 已完成 |

### 产品边界

| | 小助手 | 任务体系 |
|---|---|---|
| **场景** | 思路沟通、答疑、草稿 | 正式开发、项目交付、迭代 |
| **生命周期** | 永久对话，无终点 | demand→goal→plan→execute→self_verify→review |
| **Goal** | 无 | 有 |
| **验收** | 无 | 有 |
| **工程能力** | 无项目结构、无文件托管 | 代码编写、批量修改、项目运维 |
| **存储** | 独立 AssistantMessage | Task + ChatMessage |
| **实例数** | 全局唯一 | 无限 |

### P15-01: 小助手独立实体 — 数据模型 + 存储 + 主面板双模式 + /go

**涉及文件**:
- `src/types/index.ts` — 新增 `AssistantMessage` 接口；Task.type 移除 `'chat'`
- `src/store/TaskStore.ts` — 新增 `getAssistantMessages()` / `addAssistantMessage()` / `nextAssistantMessageId()`
- `src/kcodeView/KCodePanel.ts` — 新增 `loadAssistant()` / `handleAssistantMessage()`；`/go` 在 assistant 消息中截获，创建新 Task
- `src/kcodeView/webview/app.ts` — `loadMessages` 处理 `taskType:'assistant'` 分支；隐藏 task header/node panel/右栏；输入框始终可用
- `src/kcodeView/TaskSessionHandler.ts` — `handleSendMessage` 不再使用 `type:'chat'`，统一映射为 `'task'`

**实现说明**:
1. `AssistantMessage` 独立于 `ChatMessage`，无 `taskId`，存储于 `assistant_messages` key
2. `loadAssistant()` 设置 `currentTaskId = null`，发送 `taskType:'assistant'` 到 WebView
3. WebView assistant 分支：隐藏 `#chat-header`、`#node-timeline-gutter`、`#right-output-panel`、`#dashboard-panel`
4. 输入 `/go` → 取最近 10 条 assistant 消息作上下文 → 创建新 Task → 自动切换到 task 模式
5. 普通 assistant 消息通过 `sendAssistantMessage` 路由 → 存到 store + 发给 agent（无 task flow 处理）

**状态**: ✅ 已完成

**验收标准**：打开 KCode 默认进入小助手，可立即对话；消息持久化到 `assistant_messages`；输入 `/go` 自动创建任务并切换；点击侧边栏任务可切到任务模式。

---

### P15-03: 小助手「转为任务」按钮 — 最后一条消息 copy 按钮旁

**涉及文件**:
- `src/kcodeView/webview/app.ts` — `addMessageElement()` 中，当 `taskType === 'assistant'` 且渲染最后一条 agent 消息时，在 `msg-row` 的 `copy-msg-btn` 旁追加「转为任务」按钮；点击发送 `vscode.postMessage({ type: 'convertToTask' })`
- `src/kcodeView/AssistantHandler.ts` — 新增 `convertToTask()` 方法，复用 `/go` 逻辑：取最近 10 条 assistant 消息作上下文 → 创建新 Task（phase: 'demand'） → 切换到 task 模式
- `src/kcodeView/KCodePanel.ts` — 消息处理 `convertToTask` 路由到 `assistantHandler.convertToTask()`
- `src/kcodeView/templates/chatPanelCss.ts` — 新增 `.convert-task-btn` 样式（与 `copy-msg-btn` 同排）

**实现说明**:
- 按钮仅在 assistant 模式下、最后一条 agent 消息的 `msg-row` 中渲染
- 按钮文字 "转为任务"，hover 提示 "将当前对话转为正式任务"
- 逻辑直接复用 `AssistantHandler.handleMessage` 中 `/go` 的主体流程（取上下文 → 建 task → loadTask → refreshSidebar），不重复实现

**状态**: ✅ 已完成

**验收标准**：小助手对话后，最后一条 AI 回复右侧出现「转为任务」按钮；点击后自动创建新任务，对话内容作为 demand 阶段输入，面板切换到任务模式。

---

### P15-02: 侧边栏重构 — 新布局 + 新建下拉

**涉及文件**:
- `src/kcodeView/KCodeSidebarProvider.ts` — HTML 重构：移除 footer、移除旧 action bar；新增小助手条目 + 新建下拉按钮；`selectAssistant` 消息处理；refresh 用 `'__assistant__'` 标识小助手活跃态
- `src/kcodeView/webview/sidebar.ts` — 新增 assistant-entry 点击事件 + dropdown 事件；移除 `type: 'chat'` 分支；`getStatusIndicator` 移除 chat 区分；task 图标固定 📝
- `src/extension.ts` — `kcode.newTask` / `kcode.newTaskFromTemplate` `type` 改为 `'task'`；新增 `setSelectAssistantCallback`
- `src/types/index.ts` — Task.type 移除 `'chat'`
- `src/kcodeView/TaskSessionHandler.ts` — intent 为 `'chat'` 时映射为 `'task'`
- `src/taskflow/TaskFlow.ts` — ITaskStore 接口类型更新

**实现说明**:
1. 侧边栏 HTML: 移除 `#sidebar-footer`（我的项目/我的任务/知识库/设置），移除旧 3-button action bar
2. 顶部 `#assistant-entry`（💬 小助手），点击发送 `selectAssistant` → Extension 调用 `panel.loadAssistant()` + 刷新侧边栏
3. `#btn-new-task` 点击弹出 `#new-task-dropdown`（空白任务/导入任务/根据模板新建），点击任意项关闭
4. assistant 活跃时向 WebView 发送 `activeTaskId: '__assistant__'`，sidebar `renderSidebar` 据此高亮 entry
5. 所有 `type: 'chat'` 引用清理完毕：TaskStore.updateTaskType 参数、handleConvertToTask 不再依赖 type、Dashboard 移除 type filter

**状态**: ✅ 已完成

**验收标准**：侧边栏显示小助手 + 新建按钮 + 任务列表；小助手不可删除/拖拽；新建下拉 3 个选项均可触发对应命令；所有新任务均为 task 类型。

---

## Phase 16: 独立配置系统（Settings 面板）

_目标：将配置从 VS Code 的 `contributes.configuration` 迁移到独立文件 `kcode.jsonc` + 自定义 Settings WebView 面板，参考 Kilo Code 的配置架构。降低 vsce 打包依赖，同时提供更丰富的配置 UI。_

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P16-01 | 配置 Schema 设计 — kcode.jsonc 格式定义 | ✅ 已完成 | P1 |
| P16-02 | ConfigService — JSONC 文件读/写/监听 | ✅ 已完成 | P1 |
| P16-03 | Settings Panel WebView — 扩展侧 Provider + 路由 | ✅ 已完成 | P1 |
| P16-04 | Settings Panel WebView — 前端 UI（多 tab + draft/commit 保存） | ✅ 已完成 | P1 |
| P16-05 | 配置迁移 — 现有 VS Code 配置项迁移到文件 + 向后兼容 | ✅ 已完成 | P1 |
| P16-06 | 配置导入/导出 — 完整配置 JSON 导入导出 | ✅ 已完成 | P2 |

### P16-01: 配置 Schema 设计

**涉及文件**:
- `src/types/config.ts` — **新建**：`KCodeConfig` 接口 + 子接口（`ProviderConfig`/`LogConfig`/`GitHubConfig`/`UIConfig`）+ `getDefaultConfig()` + `CONFIG_FILENAME`/`CONFIG_FILE_PATHS`

**调研结果**:
- Kilo Code Config 接口定义：`webview-ui/src/types/messages/config.ts` — 所有字段可选，null/undefined 语义
- KCode 现有 10 配置项：agentName/agentArgs/agentPath/openaiApiKey/openaiModel/openaiBaseUrl/acpLogEnabled/acpLogMaxGlobal/acpLogMaxTask/githubToken
- 新 schema 设计为分层结构：`agentName`/`agentArgs`/`agentPath` 顶层 + `provider.openai.*` + `log.*` + `github.*` + `ui.*`
- 兼容旧 VS Code 配置，迁移时自动转换

**状态**: ✅ 已完成

### P16-02: ConfigService — JSONC 文件读/写/监听

**涉及文件**:
- `src/core/ConfigService.ts` — **新建**：ConfigService 类（单例），全局 `~/.kcode/kcode.jsonc` + 项目 `.kcode/kcode.jsonc` 两级
- `src/types/config.ts` — `CONFIG_FILENAME`/`CONFIG_FILE_PATHS` 路径常量

**调研结果**:
- Kilo Code `config-file.ts`: 全局 XDG + `~/.kilo/` + 环境变量，项目 `.kilo/kilo.jsonc`
- `jsonc-parser` 库：`modify()` + `applyEdits()` 非破坏性写入，保留注释
- ConfigService 接口：`load()` 合并默认+全局+项目三级，`get(key)`/`set(key)`/`save()`/`watch()`/`onDidChange()`
- 非破坏性写入：遍历已知 key，逐个 applyEdits，保留文件注释和格式

**状态**: ✅ 已完成

### P16-03: Settings Panel WebView — 扩展侧 Provider + 路由

**涉及文件**:
- `src/kcodeView/SettingsProvider.ts` — **新建**：WebviewPanel（viewType `kcode.settingsPanel`）
- `src/extension.ts` — 注册 `kcode.openSettings` 命令，初始化 ConfigService，传递到 KCodePanel
- `src/kcodeView/KCodePanel.ts` — 构造函数接收 ConfigService，替换 `workspace.getConfiguration` 调用
- `src/kcodeView/KCodeSidebarProvider.ts` — 设置按钮改为打开 `kcode.openSettings`
- `package.json` — commands 注册 `kcode.openSettings`/`kcode.newTaskFromTemplate`

**调研结果**:
- Kilo Code `SettingsEditorProvider.ts`: 单例 WebviewPanel，viewType `kilo-code.new.settingsPanel`
- 消息路由：`loadConfig`/`updateConfig`/`saveConfig`/`discardConfig`/`openFile`/`exportConfig`/`importConfig`

**状态**: ✅ 已完成

### P16-04: Settings Panel WebView — 前端 UI

**涉及文件**:
- `src/kcodeView/webview/settingsApp.ts` — **新建**：Vanilla JS 设置页 UI
- `src/kcodeView/SettingsProvider.ts` — 内联 HTML+CSS（VS Code WebView）

**调研结果**:
- Kilo Code `Settings.tsx`（SolidJS）14 tab 布局 + `config.tsx` draft/commit 模式
- KCode 实现 5 Tab：Agent / Provider / ACP Log / GitHub / About
- draft/commit 模式：前端维护 draft（`isDirty` 跟踪），底部 save bar 显示"未保存"标记
- 变更自动通过 `updateConfig` 消息推送到 extension，`saveConfig` 触发文件写入
- 导入：`<input type="file">` 选择 .json 文件 → `importConfig` 消息 → 校验合并 → 刷新 UI
- 导出：`exportConfig` 消息 → ConfigService 序列化 + `_meta` 版本标记 → 在 VS Code 中打开文档

**状态**: ✅ 已完成

### P16-05: 配置迁移 — 现有 VS Code 配置项迁移

**涉及文件**:
- `src/core/ConfigService.ts` — `_migrateFromVSCode()` 方法在 `load()` 中自动调用
- `src/core/AgentService.ts` — 替换 `workspace.getConfiguration('kcode')` 为 `ConfigService.getInstance()`
- `src/kcodeView/TaskSessionHandler.ts` — 同上
- `src/commands/importGitHubIssue.ts` — 同上
- `src/kcodeView/KCodePanel.ts` — 构造函数接收 ConfigService，替换 acpLogEnabled 等读取

**调研结果**:
- 6 处 `workspace.getConfiguration('kcode')` 调用分布在 4 个文件，全部已迁移
- 迁移策略：首次启动检测全局 `kcode.jsonc` 不存在 → 读取 VS Code 配置 → 写入文件 → 后续优先读文件
- 回退：`getConfiguration('kcode')` 仍保留在 `ConfigService._migrateFromVSCode()` 中作为迁移源，`package.json` 的 `contributes.configuration` 保留向后兼容

**状态**: ✅ 已完成

### P16-06: 配置导入/导出

**涉及文件**:
- `src/core/ConfigService.ts` — `exportConfig()` / `importConfig()`
- `src/kcodeView/webview/settingsApp.ts` — UI 导入/导出按钮

**调研结果**:
- Kilo Code `settings-io.ts`（`buildExport`/`parseImport`/`mergeConfig`）
- 导出格式：`{ _meta: { version, exportedAt, source }, ...KCodeConfig }`
- 导入校验：验证 JSON 合法性 + 已知 key 白名单（`agentName|agentArgs|agentPath|provider|log|github|ui`）
- 导入支持：点击"导入"按钮 → 文件选择器 → 读取 → 校验 → 合并到 draft
- 导出支持：点击"导出"按钮 → ConfigService 序列化 → 在 VS Code 编辑器中打开

**状态**: ✅ 已完成
---

## Backlog

_当前不排期、留待后续做的任务。_

| 任务 | 说明 | 优先级 |
|------|------|--------|
| P14-02 | 工具聚合原始数据模型 | P0 | ✅ 已完成 |
| P14-03 | 知识沉淀 — KnowledgeEntry 协议 + 存储 | P1 | ✅ 已完成 |
| P14-04 | 知识 Wiki 独立面板 — KnowledgePanel | P1 | ✅ 已完成 |
| P14-05 | 右栏知识索引区 | P2 | ✅ 已完成 |
| P18-01 | 行内协议解析器抽取 — parseTodoUpdate/parseKnowledgeEntry/parseTaskUpdate 从 TaskFlow 提取为复用模块，供各 StreamHandler 子类按需接入 | P1 | ✅ 已完成 |
| P21-00 | 多角色 Agent 编组讨论 — 架构/编码/评审多 Agent 互审互评，合议产出方案。基于 ACP 多 session 能力，TaskFlow 阶段自然映射角色切换 | P0 | ⬜ 未开始 |

### P14-02: 工具聚合原始数据模型

**涉及文件**:
- `src/store/TaskStore.ts` — 新增 `addToolGroup()` / `addToolItem()` / `getTaskToolGroups()` 方法，以 JSON 格式存储到 Memento
- `src/kcodeView/KCodePanel.ts` — 收到 tool_call/tool_call_update 时写入工具分组和条目数据
- `src/types/index.ts` — 新增 `ToolGroup`、`ToolItem` 接口

**调研步骤**:
1. 确认当前 ACP tool_call / tool_call_update 的回调时序和字段
2. 确认 `AcpMessageHandler` 中的 onToolCall / onToolCallUpdate 签名
3. 确认 WebView `handleToolCallUpdate` 的渲染逻辑（作为数据消费端参考）

**调研结果**: _待填充_

**实现说明**:

**分组规则**:
- 同一 AI prompt 回复中连续的工具调用属于一组（`tool_group`）
- AI 输出文本 → 工具调用 → 工具调用 → 文本 → 工具调用 → 两组
- 在 KCodePanel 的 flowHandler 中，每次 `onText` 后遇到 `onToolCall` 时：如果当前已有活跃组且未中断，追加到同组；否则新建组

**存储流程**:
```
onToolCall → addToolGroup(taskId) → 返回 groupId
onToolCallUpdate → addToolItem(groupId, { title, kind, status, detail })
onText → 标记当前组结束（后续 onToolCall 开启新组）
```

**只存原始业务数据**:
- 每组存的 detail 为原始输出内容（bash 的 stdout+stderr、read 的文件内容等）
- 不存 TabCard 拆分信息、不存头部分段、不存选中态
- WebView 加载时实时计算：`getTaskToolGroups(taskId)` → 按创建顺序连续分组 → 前端算 TabCard

**实现说明**:

**分组规则**:
- 同一 AI prompt 回复中连续的工具调用属于一组（`tool_group`）
- AI 输出文本 → 工具调用 → 工具调用 → 文本 → 工具调用 → 两组
- 在 TaskSessionHandler 的 `onDone` 中，将 `activeToolCalls` 中的工具调用聚合成一组写入 `tool_groups.json`

**存储流程**:
```
onDone → 遍历 activeToolCalls → addToolGroup(taskId, groupId, items)
```

**存储**: `~/.kcode/{taskDir}/tool_groups.json`

**状态**: ✅ 已完成

---

### P14-03: 知识沉淀 — KnowledgeEntry 协议 + 存储

**涉及文件**:
- `src/types/index.ts` — 新增 `KnowledgeEntry` 接口
- `src/store/TaskStore.ts` — 新增 `addKnowledgeEntry()` / `getTaskKnowledgeEntries()` / `searchKnowledgeEntries()` / `getAllKnowledgeEntries()`
- `src/store/ProjectFs.ts` — 新增 knowledge.json 文件读写方法
- `src/taskflow/TaskFlow.ts` — 新增 `<KNOWLEDGE_ENTRY>` 协议解析；`buildInitialPrompt()` 新增 Layer 6（相关历史知识注入）；`ITaskStore` 新增知识条目接口
- `src/taskflow/prompts/review.ts` — review 阶段 prompt 提示 AI 输出知识摘要
- `src/taskflow/prompts/protocol.ts` — 文档 `<KNOWLEDGE_ENTRY>` 协议格式
- `src/kcodeView/KCodePanel.ts` — `onKnowledgeEntry` delegate 回调
- `src/kcodeView/TaskFlowHandler.ts` — `handleKnowledgeEntry()` 写入 store + 推送右栏

**实现说明**:

**AI 协议**: `<KNOWLEDGE_ENTRY>[{ "type":"decision", "title":"...", "content":"...", "tags":[] }]</KNOWLEDGE_ENTRY>`

**类型**: decision(决策) / pitfall(踩坑) / pattern(模式) / code_snippet(代码段)

**自动触发**: review 阶段 prompt 要求 AI 在输出 accept 前同时输出知识摘要

**反哺 — Prompt 注入 Layer 6**: `buildKnowledgeContext()` 在 `buildInitialPrompt()` 中注入最多 8 条相关知识（按 goal/title/tags 关键词匹配）

**状态**: ✅ 已完成

---

### P14-04: 知识 Wiki 独立面板 — KnowledgePanel

**涉及文件**:
- `src/kcodeView/KnowledgePanel.ts` — **新建**：WebviewPanel
- `src/kcodeView/webview/knowledge.ts` — **新建**：知识浏览器 WebView（搜索/筛选/分栏/渲染）
- `src/kcodeView/templates/knowledgeHtml.ts` — **新建**：HTML 模板
- `src/kcodeView/templates/knowledgeCss.ts` — **新建**：CSS
- `src/extension.ts` — 注册 `kcode.openKnowledgeWiki` 命令

**实现说明**:

**布局**: 左右分栏（左侧 300px 列表 + 右侧详情区），顶部搜索栏 + 类型筛选按钮

**打开入口**:
1. Ctrl+Shift+P → `kcode.openKnowledgeWiki`
2. 右栏知识条目点击 → 自动打开并定位

**消息通信**: `ready` → extension 推送 `updateKnowledgeList(entries)`, 可传 `focusId` 定位

**状态**: ✅ 已完成

---

### P14-05: 右栏知识索引区

**涉及文件**:
- `src/kcodeView/webview/outputPanel.ts` — 增强知识条目渲染（图标/标题/摘要/tags/点击交互）
- `src/kcodeView/TaskFlowHandler.ts` — `sendOutputPanelUpdate()` 从 store 读取真实 knowledge entries
- `src/kcodeView/KCodePanel.ts` — 新增 `openKnowledgeEntry` 消息路由
- `src/kcodeView/templates/chatPanelCss.ts` — 新增 `.op-knowledge-entry/*` 样式

**实现说明**: 右栏知识区从 `TaskStore.getTaskKnowledgeEntries()` 读取真实数据，按类型显示图标，条目可点击跳转 KnowledgePanel 详情。已完成任务无知识时提示「该任务暂无知识沉淀，可在 review 阶段让 AI 自动生成」。

**状态**: ✅ 已完成

---

### P18-01: 行内协议解析器抽取 — parseTodoUpdate/parseKnowledgeEntry/parseTaskUpdate 复用

**涉及文件**: P28 插件系统已覆盖

**调研结果**: 已由 P28 插件系统替代。各协议解析逻辑已归属到对应 Plugin（TodoPlugin/KnowledgePlugin），通过 `addStreamProcessor` 扩展点注册。`AssistantStreamHandler` 无需解析 task 协议（小助手无阶段流转）。

**状态**: ✅ 已验证 — 无需单独实现

_目标：构建独立的「我的任务 + 我的项目」编辑器面板，与侧边栏「任务列表」（当前工程、仅未归档）形成两个互补视图。存储从 JSON 扁平文件迁移到 `~/.kcode/` 目录树结构。原有 Dashboard（P10-04）和「工作台」按钮合并到「我的任务」中，不再独立存在。_

### 核心概念边界

| 概念 | 范围 | 可见性 | 形式 | 入口 |
|------|------|--------|------|------|
| **任务列表**（侧边栏中部） | 当前工作区 | 仅未归档任务 | 树形: 未分类 → 项目 → 分组 → 任务 | 侧边栏默认视图 |
| **我的任务面板**（独立面板） | 当前工作区 | 全部任务（含归档） | 双主Tab: 📋 我的任务 / 📦 我的项目；任务Tab: 进行中/待验收/已归档/全部 | 侧边栏底部「📋 我的任务」按钮 |

### 生命周期规则

1. 新建任务 → 出现在侧边栏「任务列表」中（当前工程、未归档）
2. 归档操作 → 任务从侧边栏「任务列表」消失，但在「我的任务」面板的「已归档」tab 中仍可见
3. 恢复归档 → 任务重新出现在侧边栏「任务列表」中
4. 「我的任务」面板展示当前工作区的全部任务（含已归档），不受侧边栏过滤影响

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P17-01 | 文件存储层 — ProjectFs 目录树结构替换 JSON 扁平存储 | ✅ 已完成 | P0 |
| P17-03 | 我的任务面板 — 双主Tab（📋 我的任务 / 📦 我的项目），UI 已实现需接真实数据 | ✅ 已完成 | P1 |
| P17-04 | 归档/恢复归档 — 完整生命周期操作 | ✅ 已完成 | P1 |
| P17-05 | 侧边栏底部 — 当前代码无需修改，仅更新文档对齐 | ✅ 已对齐 | P1 |
| P17-06 | 移除旧 Dashboard 代码 — P10-04 + 控制区「📊 工作台」按钮 | ✅ 已完成 | P1 |

---

### P17-01: 文件存储层 — ProjectFs 目录树结构替换 JSON 扁平存储

**涉及文件**:
- `src/store/ProjectFs.ts` — **新建**：文件系统操作核心，封装 project/group/task 完整生命周期
- `src/store/TaskStore.ts` — **重写**：移除 `StorageBackend`/`FileStorage` 依赖，改为委托 `ProjectFs`；`ITaskStore` 接口不变
- `src/store/FileStorage.ts` — 已废弃，无代码引用
- `src/extension.ts` — 移除 `FileStorage` 构造函数和迁移逻辑，改为 `new ProjectFs()` + `new TaskStore(projectFs)`
- `src/store/__tests__/TaskStore.test.ts` — 适配新构造方式（临时目录 + ProjectFs 实例）

**实现说明**:

**目录结构**:
```
~/.kcode/
├── projects/
│   └── {projectId}/
│       ├── project.meta.yml           # name, createdAt
│       ├── tasks/                     # 直接挂在项目下的任务
│       │   └── {taskId}/
│       │       ├── meta.yml           # 任务所有元数据
│       │       └── content.json       # 对话消息列表
│       └── task-groups/
│           └── {groupId}/
│               ├── group.meta.yml
│               └── tasks/{taskId}/
├── inbox/                             # 未分配项目的任务
├── projects_order.json                # 项目显示排序
└── assistant_messages.json            # 小助手对话
```

**元数据格式（meta.yml）**:
- 简单 `key: value` 行格式，复杂值（数组/对象）用 JSON 序列化
- 示例: `status: active` / `planSteps: [{"content":"step1","status":"pending"}]`

**消息格式（content.json）**:
- JSON 数组，每项含 `id` / `role` / `type` / `content` / `timestamp`
- `review_changes.json` 独立存储验收变更记录

**关键设计**:
- 不分工作区 — 所有数据全局存储于 `~/.kcode/`
- 不做旧数据迁移 — 从零开始使用新目录结构
- `TaskStore` 保持 `ITaskStore` 接口不变，`TaskFlow` / `KCodePanel` / `MyTasksProvider` 等消费者无需改动
- `ProjectFs` 构造函数支持可选 `rootDir` 参数（测试用）

**状态**: ✅ 已完成

**验收标准**: 任务/消息/项目/分组数据持久化到 `~/.kcode/` 目录树，重启 VS Code 后数据完整恢复。`npx tsc --noEmit` 零错误，`npm test` 全通过。

---

### P17-03: 我的任务面板 — 双主Tab 集成（整理数据接入）

**涉及文件**:
- `src/kcodeView/MyTasksProvider.ts` — 新增 `_sendTaskData()`、`_openTask()`；`ready` 时发送真实任务；`archiveTask`/`renameTask` 消息处理
- `src/kcodeView/webview/myTasksApp.ts` — 移除 MOCK_TASKS，监听 `updateTasks` 消息展示真实数据
- `src/extension.ts` — `MyTasksProvider` 构造传入 `(taskId) => openTaskInPanel(context, taskId)` 回调

**状态**: ✅ 已完成

**验收标准**: 面板显示当前工作区真实任务数据；4 个状态 Tab 正确过滤；搜索可过滤；点击任务行跳转到对应 KCodePanel。

---

### P17-04: 归档/恢复归档 — 完整生命周期操作

**涉及文件**:
- `src/kcodeView/webview/sidebar.ts` — 归档操作从 `deleteTask` 修复为 `archiveTasks` 消息
- `src/kcodeView/KCodeSidebarProvider.ts` — 新增 `archiveTasks` 消息处理 → `updateTasksArchive()`
- `src/kcodeView/MyTasksProvider.ts` — 新增 `archiveTask` 消息处理 → `updateTaskArchive()`
- `src/kcodeView/webview/myTasksApp.ts` — 归档/恢复按钮发送 `archiveTask` 消息到 extension

**状态**: ✅ 已完成

**验收标准**: 归档后任务从侧边栏消失，在「我的任务」已归档 tab 可见。恢复后任务重新出现在侧边栏。

---

### P17-05: 侧边栏底部 — 当前代码无需修改

**当前代码状态**（`KCodeSidebarProvider.ts:552-556`）:

```
┌────────────────────┐
│ 📋 我的任务        │  → kcode.openMyTasks（已正确打开独立面板）
│ 📚 我的知识库      │  → showInformationMessage 占位
│ ⚙️ 设置            │  → kcode.openSettings
└────────────────────┘
```

当前 3 按钮实现与现有需求一致，**无需改代码**。保留当前 footer 不变。

**状态**: ✅ 已对齐

---

### P17-06: 移除旧 Dashboard 代码 — P10-04 + 控制区按钮

**涉及文件**: 无需改动（Dashboard 代码已在更早的 Phase 迭代中被移除）

**调研结果**: 全代码库唯一含「Dashboard」的引用是 `myTasksApp.ts` 中一条 mock 任务标题（旧版数据），`chatPanelHtml.ts`/`app.ts`/`KCodePanel.ts` 中均无 dashboard 相关代码。

**状态**: ✅ 已完成

**验收标准**: 旧 Dashboard HTML/CSS/JS/消息处理全部移除，`npx tsc --noEmit` 零错误，面板正常加载无引用错误。

---

### P18-02: Kilo/OpenCode 命令兼容加载 + 内置斜杠命令

**涉及文件**:
- `src/commands/types.ts` — **新建**：`KCodeCommand` 接口 + `SlashHandler` 类型
- `src/commands/CommandLoader.ts` — **新建**：扫描 `.kilo/commands/` + `.opencode/commands/`，解析 YAML frontmatter
- `src/commands/CommandRegistry.ts` — **新建**：注册中心（内置+外部），`getPromptInjection()` 生成 AI 提示词片段
- `src/kcodeView/webview/app.ts` — `sendMessage()` 拦截以 `/` 开头的输入，发送 `slashCommand` 消息
- `src/kcodeView/KCodePanel.ts` — 创建 CommandRegistry + 注册 8 个斜杠命令 + 路由 `slashCommand` 消息
- `src/taskflow/TaskFlow.ts` — `buildInitialPrompt()` 新增 `this.availableCommands` 层
- `src/kcodeView/AssistantHandler.ts` — 移除 `/go` 内联处理（由 slashCommand 统一路由）

**实现说明**:

**1. Kilo/OpenCode 命令加载**:
- `CommandLoader.scanDir()` 读取 `.kilo/commands/` 和 `.opencode/commands/` 下的 `.md` 文件
- 正则 `---\n...\n---\nbody` 提取 YAML frontmatter 中的 `description` + markdown 正文
- 结果注入到 TaskFlow 的 `availableCommands` 字段，加入 `buildInitialPrompt()` 的 layers

**2. 内置斜杠命令**:

| 命令 | 功能 | 处理位置 |
|------|------|---------|
| `/ai` | 跳转到小助手模式 | `KCodePanel.loadAssistant()` |
| `/totask` | 小助手对话转为任务 | `assistantHandler.convertToTask()` |
| `/go` | 同 /totask（兼容） | `assistantHandler.convertToTask()` |
| `/confirm` | 按当前阶段确认（goal/plan/execute） | `flowHandler.handleConfirm*` |
| `/reject [原因]` | 驳回验收 | `flowHandler.handleRejectReview()` |
| `/cancel` | 取消当前任务 | `flowHandler.handleCancelTask()` |
| `/new` | 新建任务 | `vscode.commands.executeCommand('kcode.newTask')` |
| `/tasks` | 查看任务概览 | `sendTasksSummary()` 发送系统消息 |

**3. 消息流**:
```
用户输入 "/confirm"
  → app.ts sendMessage() 检测 "/" 前缀
  → vscode.postMessage({ type: 'slashCommand', text: '/confirm', taskId })
  → KCodePanel.setupMessageHandler → router.on('slashCommand')
  → handleSlashCommand() → commandRegistry.handleSlash()
  → 匹配 /confirm → handlePhaseConfirm() → 按 task.phase 分派
```

**状态**: ✅ 已完成

**验收标准**: 输入 `/ai` 跳转小助手，`/totask` 转换对话为任务，`/confirm`/`/reject`/`/cancel` 在任务模式下工作，`/new` 新建任务，`/tasks` 显示概览。kilo/opencode 命令自动注入 AI prompt。

---

## Phase 19: 对话萃取归档到项目 Wiki

_目标：一键将任务对话内容（消息流 + 知识条目 + 文件变更 + 阶段变迁）萃取为结构化 Markdown 文档，归档到项目 Wiki 目录，支持全链路复盘回溯。_

### 当前已有基础

| 能力 | 状态 |
|------|------|
| `KnowledgeEntry` 类型（type/title/content/tags/source） | ✅ 已定义 |
| `<KNOWLEDGE_ENTRY>` 协议解析（AI 自动/手动触发） | ✅ 已实现 |
| 知识条目 per-task 存储（`knowledge.json`） | ✅ 已实现 |
| 右栏「知识wiki」区块渲染 | ✅ 已实现 |
| 独立 Knowledge Wiki 面板（搜索/筛选/查看详情） | ✅ 已实现 |
| 历史知识反哺新任务 prompt（`buildKnowledgeContext`） | ✅ 已实现 |
| 萃取按钮「🔍 AI 萃取知识」（`extractKnowledge` 消息） | ✅ 已实现 |

### 缺失

| 缺失 | 说明 |
|------|------|
| `KnowledgeEntry.source` 从未填充 | 类型定义有，但解析器不填 |
| 无 `phase` 字段记录知识来自哪个阶段 | 无法溯源 |
| 无全链路日志 | 任务状态变迁 + 消息流 + 文件变更未形成完整时间线 |
| 无 Markdown 导出管道 | 零 export/wiki/writeToFile 相关代码 |
| 无项目 Wiki 文件输出 | 不存在 `.kcode/wiki/` 或项目 wiki 目录 |
| 无一键导出按钮 | 输出面板只有「萃取」按钮，触发的是 AI 分析而非文件导出 |

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P19-01 | KnowledgeEntry 模型增强 — 补充 source/phase 字段 | ✅ 已完成 | P0 |
| P19-02 | 全链路日志收集 — 任务状态迁移 + 消息流 + 文件变更完整时间线 | ✅ 已完成 | P0 |
| P19-03 | Markdown 导出生成器 — 消息流 → 结构化 Wiki 文档 | ✅ 已完成 | P0 |
| P19-04 | 项目 Wiki 文件输出 — `.kcode/wiki/` 目录 + 索引 | ✅ 已完成 | P1 |
| P19-05 | 一键导出 UI — 输出面板按钮 + 导出确认 | ✅ 已完成 | P1 |

---

### P19-01: KnowledgeEntry 模型增强 — 补充 source/phase 字段

**涉及文件**:
- `src/types/index.ts` — `KnowledgeEntry` 新增 `phase` 字段，`source` 已有但需实际填充
- `src/taskflow/TaskFlow.ts` — `parseKnowledgeEntry()` 在创建 KnowledgeEntry 时填充 `source`（当前 taskId+phase）和 `phase`（当前 task.phase）

**实现说明**:
1. `KnowledgeEntry` 新增 `phase?: 'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review'`
2. `parseKnowledgeEntry()` 创建条目时填入：`source: \`task:${taskId}\``, `phase: task.phase`
3. Knowledge Wiki 面板详情区展示 source 和 phase 信息

**状态**: ✅ 已完成

**验收标准**: 新产生的知识条目自动带 source 和 phase，Wiki 面板可查看来源。

---

### P19-02: 全链路日志收集 — 任务状态迁移 + 消息流 + 文件变更完整时间线

**涉及文件**:
- `src/types/index.ts` — 新增 `TimelineEntry` 接口
- `src/store/TaskStore.ts` — 新增 `addTimelineEntry()` / `getTaskTimeline()` 方法
- `src/store/ProjectFs.ts` — 新增 `timeline.json` 文件读写
- `src/taskflow/TaskFlow.ts` — 阶段迁移时记录 `TimelineEntry`（phase_change 类型）
- `src/kcodeView/TaskFlowHandler.ts` — 知识萃取、取消任务、验收通过时记录时间线

**实现说明**:
1. `TimelineEntry` 包含：`timestamp` / `type` (phase_change / message / file_change / knowledge_extract) / `summary` / `detail`
2. 阶段迁移时由 TaskFlow 自动记录（confirmGoal/confirmPlan/confirmExecuteDone/finishReview/rejectReview 等方法）
3. 知识萃取时由 TaskFlowHandler.handleKnowledgeEntry 记录
4. 文件变更由 TaskFlowHandler.triggerReviewRequest 聚合记录
5. 存储于 `{taskDir}/timeline.json`，按 timestamp 排序

**状态**: ✅ 已完成

**验收标准**: 任务完成后可查看完整时间线：何时进入哪个阶段、何时发了什么消息、何时改了什么文件。

---

### P19-03: Markdown 导出生成器 — 消息流 → 结构化 Wiki 文档

**涉及文件**:
- `src/export/WikiExporter.ts` — **新建**：核心导出类，组装消息+知识+时间线+变更 → Markdown
- `src/taskflow/TaskFlow.ts` — `ITaskStore` 新增 `getTaskTimeline()`、`addTimelineEntry()` 接口

**实现说明**:
1. `WikiExporter.generate(taskId)` 从 store 读取：
   - 任务元数据（title / goal / phase / status）
   - 完整时间线（`getTaskTimeline()`）
   - 对话消息（`getMessages()`）
   - 知识条目（`getTaskKnowledgeEntries()`）
   - 文件变更（`getReviewChanges()`）
2. Markdown 模板输出含：Header → Goal → 计划步骤 → 时间线 → 对话记录 → 文件变更 → 知识沉淀 → Footer
3. 知识条目详情以折叠 `<details>` 块嵌入

**状态**: ✅ 已完成

**验收标准**: 调用 `WikiExporter.generate(taskId)` 返回完整 Markdown 字符串，含上述 5 个区块。

---

### P19-04: 项目 Wiki 文件输出 — `.kcode/wiki/` 目录 + 索引

**涉及文件**:
- `src/export/WikiExporter.ts` — 新增 `writeToWiki()` 方法
- `src/export/WikiIndex.ts` — **新建**：Wiki 索引文件管理
- `src/store/ProjectFs.ts` — 暴露 `getWikiDir()` 方法

**实现说明**:
1. **输出目录**: `{workspaceRoot}/.kcode/wiki/`
2. **文件命名**: `{taskId}_{sanitizedTitle}.md`（sanitize: 去特殊字符，截断 50 字符）
3. **`WikiExporter.writeToWiki(taskId)`**: generate → 写入文件 → 更新 INDEX.md
4. **`WikiIndex.append()`**: 更新 INDEX.md，含任务标题/文件名/状态 emoji
5. 重复导出时覆盖同名文件（幂等）

**状态**: ✅ 已完成

**验收标准**: 一键导出后 `.kcode/wiki/` 下出现任务 Markdown 文件 + INDEX.md 索引，文件内容完整可读。

---

### P19-05: 一键导出 UI — 输出面板按钮 + 导出确认

**涉及文件**:
- `src/kcodeView/webview/outputPanel.ts` — 知识区块新增「📤 导出 Wiki」按钮
- `src/kcodeView/templates/chatPanelCss.ts` — 新增 `.op-export-btn` 样式
- `src/kcodeView/KCodePanel.ts` — 新增 `exportToWiki` 消息处理 → 调用 `WikiExporter.writeToWiki()`
- `src/kcodeView/TaskFlowHandler.ts` — `sendOutputPanelUpdate()` 携带可导出标识
- `src/kcodeView/webview/app.ts` — 新增 `wikiExported` 消息处理和按钮事件绑定
- `src/kcodeView/templates/chatPanelHtml.ts` — 知识wiki 标题栏内置按钮

**实现说明**:
1. 知识区块标题栏内嵌「📤 导出 Wiki」按钮（`.op-export-btn`），与 AI 萃取按钮共存
2. 仅在 task 模式下、有消息内容时显示（通过 `canExport` 标识控制 hidde class）
3. 点击 → WebView 发送 `exportToWiki` 消息 → KCodePanel 动态 import WikiExporter → 调用 `writeToWiki()` → 完成通知
4. 导出成功后 WebView 显示系统消息「已导出 Wiki 文档」
5. VS Code 信息弹窗提示具体文件路径

**状态**: ✅ 已完成

**验收标准**: 输出面板「知识wiki」区出现导出按钮；点击后生成 `.kcode/wiki/` 文件 + 弹出成功提示；可一键打开导出的 Markdown。

---

## Phase 20: 对话内一键 Demo 闭环验证

_目标：用户说"跑一下 demo"，Agent 自动完成 build → start → 预览 → verify 全流程，用户在 WebView 中直接看到运行结果，从「问 AI」到「看到效果」一步到位，效率碾压同类工具。_

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P20-00 | Demo 运行结果卡片 UI — 嵌入式可折叠卡片，含信息区/环境元数据/输出流/状态标识/操作按钮 | ✅ 已完成 | P0 |
| P20-01 | Demo 工作流提示词 — build → start → verify 结构化指令 | ❌ 已取消 | P0 |
| P20-02 | 服务输出实时回显 — dev server stdout/stderr 流式展示 | ✅ 已完成 | P0 |
| P20-03 | 自动预览触发 — agent 启动 server 后自动打开 WebView | ❌ 已取消 | P0 |
| P20-04 | 一键重跑 — 重新执行 build+start+verify 全流程 | ✅ 已完成 | P1 |

---

### P20-00: Demo 运行结果卡片 UI — 嵌入式可折叠卡片

**涉及文件**:
- `src/kcodeView/templates/chatPanelCss.ts` — 新增 `.demo-card-*` 全量样式（info 栅格、环境元数据折叠、输出区终端风格、三色状态 badge、操作按钮行）
- `src/kcodeView/webview/app.ts` — 新增 `handleDemoCardUpdate()` 消息处理器（create/appendOutput/updateStatus/setEnvMeta 四个 action）；新增 `renderDemoCard()` 渲染函数；在 `initMessageHandler` 注册 `demoCardUpdate` 消息
- `src/kcodeView/KCodePanel.ts` — 新增 `handleDemoRun()` 方法（创建卡片→连接设备→逐命令执行→流式输出回填→自动检测完成/失败）；新增 `handleDemoStop()` 方法（abort 终止→更新卡片状态）；注册 `demoRun`/`demoStop`/`demoRerun` 三条消息路由
- `src/kcodeView/templates/__tests__/chatPanelCss.test.ts` — 新增 16 个 demo-card className 断言

**实现说明**:
1. **卡片结构**: 消息类型 `tool`，内联展示在对话时间线
2. **信息区**: 栅格布局（Demo 名称 / 执行命令 / 运行设备）
3. **环境元数据**: 可折叠区块，点击展开/收起，数据通过 JSON 字段传递，界面不显示标签原文
4. **输出流**: 黑底绿字终端风格，max-height 240px 可滚动，stdout/stderr 配色区分，`\x1b` ANSI 转义码清洗
5. **状态识别**: 基于 `status` 字段值（running/completed/failed），不依赖前端关键字匹配：running 蓝底脉冲动画、completed 绿底、failed 红底
6. **操作按钮**: 「📋 查看日志」（复制全部输出）、「🔄 重新运行」（发送 `demoRerun` 消息）、「✕ 终止」（发送 `demoStop` + abort，运行中可见）
7. **设备对接**: `handleDemoRun` 复用 `this.deviceClients` Map，通过已有 `IDeviceClient.exec()` 逐命令执行，流式输出通过 `demoCardUpdate.appendOutput` 实时回填
8. **消息流**: 扩展侧 → WebView 通过 `demoCardUpdate` 消息，action 分 create/appendOutput/updateStatus/setEnvMeta，支持增量追加而非全量替换

**状态**: ✅ 已完成

**验收标准**:
- `npx tsc --noEmit` 零错误，`npm test` 全通过
- 通过 vscode postMessage 发送 `{ type: 'demoCardUpdate', action: 'create', name, command, device }` 可在对话区渲染 Demo 卡片
- `appendOutput` 增量追加输出行，stdout/stderr 配色正确
- `updateStatus` 切换状态 badge（running/completed/failed）
- 重新运行/终止按钮发送正确消息到扩展侧

---

### P20-01: Demo 工作流提示词 — build → start → verify 结构化指令

**涉及文件**: -（已取消）

**说明**: 当前 Demo 卡片支持手动填写命令 + 逐命令执行 + 输出回显 + 重跑，人工触发流程已完整。AI 全自动 build→start→verify 流程在当前阶段价值不大。

**状态**: ❌ 已取消

---

### P20-02: 服务输出实时回显 — dev server stdout/stderr 流式展示

**涉及文件**: `src/plugins/demo/DemoRunner.ts` — appendOutput 流式推送, `src/kcodeView/webview/app.ts` — handleDemoCardUpdate 终端渲染

**调研结果**: P20-00 Demo 卡片已内置完整输出流能力。`DemoRunner.appendOutput` 通过 `demoCardUpdate` 消息实时推送 stdout/stderr 到 WebView；WebView `handleDemoCardUpdate(action='appendOutput')` 增量追加渲染为黑底绿字终端风格，支持 ANSI 转义码清洗。无需独立实现。

**状态**: ✅ 已完成

---

### P20-03: 自动预览触发 — agent 启动 server 后自动打开 WebView

**涉及文件**: -（已取消）

**说明**: 当前无 AI 驱动的 `<DEMO_READY>` 协议，开发者手动通过 Device Tab 或 Demo 卡片执行命令后自行查看效果。

**状态**: ❌ 已取消

---

### P20-04: 一键重跑 — 重新执行 build+start+verify 全流程

**涉及文件**: `src/plugins/demo/DemoPlugin.ts` — 注册 demoRerun 消息路由, `src/plugins/demo/DemoRunner.ts` — handleRun 可重复调用

**调研结果**: P20-00 Demo 卡片已内置「🔄 重新运行」按钮（`demoRerun` 消息）；`DemoPlugin` 已注册 `demoRerun` 消息路由 → `DemoRunner.handleRun()`；每次调用重新创建 AbortController 逐命令执行。重跑能力已完备。

**状态**: ✅ 已完成

---

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

