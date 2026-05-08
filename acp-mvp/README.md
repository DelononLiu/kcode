# ACP MVP — OpenCode 接入验证

验证 ACP (Agent Client Protocol) 通过 stdio 接入 OpenCode 的协议流程。

## 测试结果

| 步骤 | 协议方法 | 状态 |
|------|----------|------|
| 启动 | `opencode acp --port 0 --cwd <path>` | ✅ stdio 子进程模式 |
| 初始化 | `initialize` → 协商版本、能力 | ✅ v1, OpenCode v1.14.33 |
| 创建会话 | `session/new` → 返回 sessionId | ✅ |
| 发送提示 | `session/prompt` → 流式响应 | ✅ streaming chunks |
| 工具调用 | `session/update` (tool_call/tool_call_update) | ✅ |
| 计划更新 | `session/update` (plan) | ✅ |
| 取消 | `session/cancel` (notification) | ✅ |
| 关闭会话 | `session/close` | ⚠️ OpenCode 暂不支持 |
| 断开 | SIGTERM → 子进程退出 | ✅ |

## 项目结构

```
acp-mvp/
├── src/
│   ├── acp-client.ts          # ACP 客户端封装 — 管理连接/会话/提示流程
│   ├── client-handler.ts      # Client 侧处理器 — 处理 Agent 发来的请求
│   ├── fake-agent-server.ts   # Fake ACP Agent — 无需真实 OpenCode 即可测试
│   ├── test-opencode.ts       # 对真实 OpenCode 的端到端测试
│   ├── test-fake.ts           # 对 Fake Agent 的端到端测试
│   └── types.ts               # 共享类型定义
├── package.json
├── tsconfig.json
└── README.md
```

## 运行测试

### 1. 依赖安装

```bash
cd acp-mvp
npm install
```

### 2. 测试 Fake Agent（无需 OpenCode）

```bash
npx tsx src/test-fake.ts "你好，介绍一下你自己"
```

预期：完整的 ACP 协议流（初始化 → 创建会话 → 发送提示 → 流式响应 → 完成）

### 3. 测试真实 OpenCode

```bash
# 确保 opencode 已安装且在 PATH 中
npx tsx src/test-opencode.ts "Hello" /tmp
```

预期：成功通过 stdio 与 OpenCode ACP 服务器建立连接并交互

## 代码架构

### ACP 协议流程

```
Client (acp-client.ts)                    Agent (OpenCode)
      │                                         │
      ├── initialize ──────────────────────►    │
      │◄─── protocolVersion + capabilities ─────┤
      │                                         │
      ├── session/new ─────────────────────►    │
      │◄─── sessionId ──────────────────────────┤
      │                                         │
      ├── session/prompt ────────────────►      │
      │◄─── session/update (plan) ──────────────┤
      │◄─── session/update (agent_message_chunk)─┤
      │◄─── session/update (tool_call) ─────────┤
      │◄─── session/prompt response ────────────┤
      │                                         │
      ├── session/cancel (optional) ────►       │
      ├── session/close (optional) ────►        │
      │                                         │
```

### Agent → Client 的请求

Client handler 处理 Agent 发来的请求：

- `session/update` — 流式更新（文本块、工具调用、计划）
- `session/request_permission` — 请求权限（MVP 阶段自动允许）
- `fs/read_text_file` — 读文件
- `fs/write_text_file` — 写文件

## 测试结论

- `opencode acp --port 0 --cwd <path>` 使用 **stdio 传输**，JSON-RPC 通过 stdin/stdout 通信
- ACP 协议在 stdio 模式下运行正常，完整流（初始化 → 会话 → 提示 → 流式更新）已验证通过
- 适用于 VS Code Extension 插件的 ACP 集成：使用 `@agentclientprotocol/sdk` 的 `ClientSideConnection` 管理连接生命周期
