---
description: 分析改动并提交 git commit
agent: general
---

根据 AGENTS.md 中的 Git 提交规范执行：

## 调研阶段
并行执行：
1. `!git status` - 查看工作区状态
2. `!git diff` - 查看具体改动

## 分析
- 检查是否有敏感文件（如 .env、credentials.json），如果有则警告不要提交

## 消息格式
```
<type>: <简短描述>

[可选正文说明为什么改]
```

**类型**：`feat` — 新功能 | `fix` — 修复 bug | `refactor` — 重构 | `docs` — 文档 | `chore` — 构建/工具

**规则**：简短描述不超过 50 字，使用中文

## 执行
- `git add` 将所有修改和未跟踪的文件加入暂存区（排除敏感文件后）
- 执行 `git commit -m "<消息>"`，消息包含类型、简短描述和可选的正文（说明 why）

## 原则
- 不要自动 push
- 如果提交被 hook 拒绝，修复问题后重新提交（不要 amend）
- 不需要用户确认，直接完成整个流程
