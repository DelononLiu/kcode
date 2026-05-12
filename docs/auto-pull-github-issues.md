# 自动拉取 GitHub Issue 批量创建任务 — 设计方案

## 动机

现有 P9（import-github-issue）支持粘贴单条 Issue URL 导入创建 Task。本需求在其基础上扩展为：

1. **批量拉取**：从指定 GitHub 仓库拉取 open issues 列表，用户勾选后批量创建 Task
2. **增量同步**（后续）：自动检测新 issue，免手动操作

核心目标：减少"从 Issue 到 Task"的手动劳动，让 KCode 成为 GitHub Issue 驱动的开发工作流入口。

---

## 交互流程

### 触发入口

与单条导入按钮并列，侧边栏 action bar 新增两个按钮：

```
┌──────────────────┐
│  [+ 新建任务]      │
│  [⤓ 导入 Issue]   │  ← 已有：单条 URL 导入
│  [📥 拉取 Issues]  │  ← 新增：批量拉取
└──────────────────┘
```

`📥 拉取 Issues` 按钮的行为：

1. **首次使用**：弹出 `showInputBox` 询问仓库地址
   ```
   GitHub 仓库 (owner/repo)
   ┌────────────────────────────────┐
   │ 例: vuejs/core 或 full URL    │
   │                               │
   │ 最近使用的仓库:                │
   │ ● vuejs/core                  │
   │ ● microsoft/vscode            │
   └────────────────────────────────┘
   ```
2. **已有配置**：直接进入 Issue 列表选择界面
3. 仓库地址存入 `kcode.githubRepo` 配置，支持切换

### Issue 选择列表

使用 **Quick Pick**（`vscode.window.showQuickPick`）多选界面：

```
┌─────────────────────────────────────────────────┐
│  KCode: 从 vuejs/core 导入 Issue (3/20 已选)    │
│─────────────────────────────────────────────────│
│  ☐ #4321 feat: support Vite 6                    │
│  ☐ #4319 fix: hydration mismatch in SSR          │
│  ☑ #4318 refactor: extract compiler helpers      │
│  ☐ #4315 chore: upgrade deps                     │
│  ☐ #4312 feat: new reactivity API                │
│  ...                                             │
│                                                 │
│  选中 3 条，点击 OK 导入                          │
│  [全选] [反选] [仅显示未导入]                     │
│  ─────────────────                              │
│  ⚡ 点击 Issue 可预览详情                       │
└─────────────────────────────────────────────────┘
```

**Quick Pick 实现要点**：

- 每行格式：`#[number] [title]`，颜色 badge 表示 labels
- 已导入过的 issue 显示 `⏺` 前缀标记
- 支持多选（`canPickMany: true`）
- 底部分组支持全选/反选操作
- 选中后回车确认 → 显示进度通知 → 批量创建 Task

### 进度反馈

```
┌─────────────────────────────────────────┐
│  📥 正在导入 GitHub Issues...    3/20   │
│  ████████░░░░░░░░░░░░░░░░░░░           │
│                                         │
│  ✅ #4321 feat: support Vite 6          │
│  ✅ #4319 fix: hydration mismatch       │
│  ⏳ #4318 refactor: extract helpers     │
│  ⬜ #4315 chore: upgrade deps           │
│  ...                                    │
└─────────────────────────────────────────┘
```

使用 `vscode.window.withProgress` + 逐条进度报告。

### 导入结果

- 导入成功的 Task 自动插入侧边栏列表，与其他任务混排
- 标题格式同单条导入：`GH#{n}: {title}`
- 自动聚焦到第一个新建 Task 的面板
- 若失败（如网络错误、rate limit），显示错误通知且不影响已成功的导入

---

## 数据结构改动

### TaskSource 扩展（在 P9-01 基础上）

`src/types/index.ts` 已有 `TaskSource` 设计：

```typescript
interface TaskSource {
  type: 'github_issue';
  url: string;          // html_url
  owner: string;
  repo: string;
  issueNumber: number;
}
```

批量导入时每个 Task 独立 source 字段，互不干扰。

### 新增持久化状态：已导入 Issue 索引

```typescript
// 存储在 workspaceState 中，key: 'importedIssues'
interface ImportedIssueIndex {
  [repoKey: string]: number[];  // "owner/repo" → [已导入的 issue 号]
}
```

用途：
- 去重：避免同一 Issue 被重复导入
- 视觉标记：Quick Pick 中标记已导入项
- 增量同步基础

### 配置项扩展

`package.json` 的 `contributes.configuration` 新增：

```json
"kcode.githubRepo": {
  "type": "string",
  "default": "",
  "description": "批量拉取 Issue 的 GitHub 仓库 (格式: owner/repo)"
},
"kcode.githubIssueLabels": {
  "type": "array",
  "items": { "type": "string" },
  "default": [],
  "description": "按标签过滤 Issue（空=全部）"
}
```

`kcode.githubToken` 已在 P9-04 中设计，同时服务于单条和批量场景。

---

## 技术设计

### API 调用

使用 Node.js 原生 `https` 模块（不引入额外依赖），与 P9-03 共用 `fetchGitHubIssue` 函数族。

**新增函数**：

```typescript
// src/commands/importGitHubIssue.ts

interface GitHubIssueItem {
  number: number;
  title: string;
  body: string;
  html_url: string;
  labels: { name: string; color: string }[];
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

/**
 * 拉取仓库的所有 open issues（支持分页）
 * @param owner 仓库所有者
 * @param repo 仓库名
 * @param token 可选 token
 * @param options 过滤选项
 */
async function fetchGitHubIssues(
  owner: string,
  repo: string,
  token?: string,
  options?: { labels?: string[]; since?: string; state?: 'open' | 'closed' | 'all' }
): Promise<GitHubIssueItem[]>
```

**分页策略**：

```
GET /repos/{owner}/{repo}/issues?state=open&per_page=100&page={page}

- per_page = 100（最大）
- 逐页请求，解析 Link header 判断是否有下一页
- 最多拉取 5 页（500条），超出提示用户加标签过滤
- 无 token：60 req/h，一次拉取 100 条约 1 次请求，足够日常使用
- 有 token：5000 req/h，无瓶颈
```

**去重检查**：

```
GET /repos/{owner}/{repo}/issues/{number}  // 单条获取详情时
↓
对比 importedIssues 索引，已存在的跳过（或标记已导入）
```

### 与 P9-03 代码复用

| 能力 | 单条导入 | 批量拉取 | 复用方式 |
|------|---------|---------|---------|
| URL 解析 | `parseGitHubUrl()` | 仓库地址解析 | 复用 |
| Issue fetch | `fetchGitHubIssue()` | `fetchGitHubIssues()` | 新增函数，复用 HTTP 工具 |
| 去重 | 无（一次一条） | 需要 | 新增 `ImportedIssueIndex` |
| Task 创建 | 单个 `store.addTask()` | 循环 `store.addTask()` | 复用 |
| 配置读取 | `kcode.githubToken` | + `kcode.githubRepo` | 扩展 |

### 增量同步方案（后续）

```
┌────────────────────────────────────────┐
│  增量同步策略                            │
│                                        │
│  触发方式：                              │
│  1. 手动点击"刷新"                         │
│  2. KCode 激活时自动检查（可选）             │
│  3. 定时轮询（后续）                      │
│                                        │
│  流程：                                  │
│  GET /repos/{owner}/{repo}/issues        │
│  → 对比 importedIssues 索引              │
│  → 新 issue → 自动创建 Task              │
│  → 更新索引                              │
└────────────────────────────────────────┘
```

MVP 仅做手动批量导入。增量同步作为 Phase 10 或后续迭代。

### Rate Limit 处理

复用 P9-04 方案：

| 场景 | 处理 |
|------|------|
| 匿名请求 (60 req/h) | 一次批量拉取 1-2 次请求，够用 |
| 403 + `x-ratelimit-remaining: 0` | 提示"API rate limit 已用完，请配置 kcode.githubToken 或稍后重试" |
| 有 token (5000 req/h) | 正常使用 |

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/commands/importGitHubIssue.ts` | 新增 `fetchGitHubIssues()` 分页拉取、`showIssuePicker()` Quick Pick 界面、`parseGitHubRepo()` 仓库解析 |
| `src/store/TaskStore.ts` | 新增 `getImportedIssues() / addImportedIssue()` 索引存取 |
| `src/types/index.ts` | （P9-01 已完成 TaskSource 接口） |
| `src/kcodeView/KCodeSidebarProvider.ts` | HTML action bar 新增 `[📥 拉取 Issues]` 按钮；消息处理新增 `pullGitHubIssues` |
| `src/kcodeView/webview/sidebar.ts` | 新增拉取按钮点击事件 |
| `src/extension.ts` | 注册 `kcode.pullGitHubIssues` 命令 |
| `package.json` | 新增配置项 `kcode.githubRepo`、`kcode.githubIssueLabels` |

---

## 实现步骤（建议）

### Step 1: 数据层
- `TaskStore` 增加 `ImportedIssueIndex` 存取方法
- 测试：存取、去重

### Step 2: API 层
- `importGitHubIssue.ts` 新增 `fetchGitHubIssues()` 分页实现
- 测试：mock GitHub API 验证分页和去重

### Step 3: UI 层
- `KCodeSidebarProvider` + `sidebar.ts` 新增批量拉取按钮
- Quick Pick 多选界面实现
- 进度反馈

### Step 4: 集成
- 串联 API → 选择 → 批量创建 Task 全流程
- 错误处理、rate limit 提示

---

## 验收标准

1. 点击 `[📥 拉取 Issues]` → 输入 `owner/repo` → 展示 open issues 列表可多选
2. 选中多条确认 → 批量创建 Task，标题格式 `GH#{n}: {title}`
3. 已导入的 issue 在再次拉取时标记为已导入
4. 单条导入（P9）和批量拉取可同时使用，共享去重索引
5. 无 token 情况下正常使用，rate limit 超限时给出友好提示

---

## 后续扩展

- **增量同步**：KCode 启动时自动检查新 issue
- **标签过滤 UI**：Quick Pick 提供标签作为筛选条件
- **Issue 详情预览**：在右侧面板展示 issue body
- **多仓库支持**：同时配置多个仓库，统一管理
- **自定义查询**：支持 GitHub search syntax（如 `is:issue label:bug`）
- **PR 导入**：将 PR 也作为 Task 来源
