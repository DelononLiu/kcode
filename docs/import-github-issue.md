# 导入 GitHub Issue 设计方案

## 动机

支持从 GitHub Issue 直接导入创建 Task，减少手动复制粘贴。用户输入 Issue URL 即可自动获取标题、正文，预填入 task goal。

---

## 交互 UI

### 侧边栏入口

在 action bar 新增 `[⤓ 导入 Issue]` 按钮，与 `[+ 新建任务]` 同级。

```
┌──────────────────┐
│  [+ 新建任务]      │  ← 不变：直接建空白任务
│  [⤓ 导入 Issue]   │  ← 新增：弹出 URL 输入框
│  [打开右侧面板]    │
└──────────────────┘
```

SVG 图标使用 `⊕` 风格（圆形加号），保持轻量，不引入字体图标。

### 输入流程

1. 用户点击 `[⤓ 导入 Issue]`
2. Extension 端调用 `vscode.window.showInputBox`

```
┌────────────────────────────────────────────────┐
│  GitHub Issue URL 或 owner/repo#123             │
│                                                 │
│  https://github.com/vuejs/core/issues/9999      │
│                                                 │
│  ┌──────────┐  ┌──────────┐                    │
│  │  确定     │  │  取消    │                    │
│  └──────────┘  └──────────┘                    │
└────────────────────────────────────────────────┘
```

3. 用户粘贴 URL → 回车
4. `vscode.window.withProgress` 显示进度通知 `"正在导入 GitHub Issue..."`
5. 解析 URL → 调用 GitHub API → 创建 Task → 打开面板

### 侧边栏任务列表

导入的任务与其他任务混排，标题格式 `GH#{n}: {title}`，不加 badge，标题自解释：

```
▾ 任务
  · GH#42: feat: add dark mode
  · 重构用户模块
  · GH#15: fix login timeout
```

---

## 数据结构改动

新增 `TaskSource` 接口，`Task` 增加 `source` 字段：

```typescript
interface TaskSource {
  type: 'github_issue';
  url: string;          // 完整 URL
  owner: string;
  repo: string;
  issueNumber: number;
}

interface Task {
  // ... 现有字段
  source?: TaskSource;
}
```

### 数据映射

| GitHub Issue | → | KCode Task |
|---|---|---|
| `title` | → | `task.title` → `GH#{n}: {title}` |
| `body` | → | `task.goal` |
| `html_url` | → | `task.source.url` |
| `number`, `repo` | → | `task.source.owner/repo/number` |

---

## 认证策略

MVP 走**无 token 方案**：

- 调用 GitHub 公开 API `GET /repos/{owner}/{repo}/issues/{number}`
- 限制：60 req/h（IP based），日常开发足够
- 如果触发 rate limit，提示用户设置 `kcode.githubToken`

后续可通过 VS Code 配置项 `kcode.githubToken` 支持 authenticated 请求（5000 req/h）。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/types/index.ts` | 新增 `TaskSource` 接口，`Task.source` 字段 |
| `src/commands/importGitHubIssue.ts` | **新建**：输入框 → fetch → 创建 Task |
| `src/kcodeView/KCodeSidebarProvider.ts` | 注册 `importGitHubIssue` 消息处理，HTML 新增按钮 |
| `src/kcodeView/webview/sidebar.ts` | 新增导入按钮点击事件 |
| `src/extension.ts` | 注册 `kcode.importGitHubIssue` 命令 |

---

## 后续扩展

`source` 字段设计可扩展支持其他来源：

- `type: 'gitlab_issue'`
- `type: 'linear_task'`
- `type: 'jira_ticket'`
