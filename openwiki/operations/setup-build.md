# Setup, Build & Operations

## Prerequisites

- **Node.js** (recent LTS)
- **VS Code** ^1.96.0
- **TypeScript** (tsc compilation, not esbuild)

## Build Commands

```bash
npm install          # Install dependencies
npm run compile      # TypeScript → out/ (CommonJS, ES2021)
npm run watch        # Auto-compile on changes
npm run package      # Package as .vsix via @vscode/vsce
```

**Output**: `/out/extension.js` (entry point declared in `package.json`)

## VS Code Extension Manifest

```json
{
  "activationEvents": ["onView:kcode.viewsMain"],
  "main": "./out/extension.js",
  "contributes": {
    "viewsContainers": { "activitybar": [{ "id": "kcode" }] },
    "views": { "kcode": [{ "type": "webview", "id": "kcode.viewsMain" }] },
    "commands": [
      "kcode.open", "kcode.newTask", "kcode.importGitHubIssue"
    ]
  }
}
```

*Source: `/package.json`*

## Configuration (`kcode.jsonc`)

Two config levels:

| Level | Path | Precedence |
|-------|------|-----------|
| Global | `~/.kcode/kcode.jsonc` | Lower (fallback) |
| Project | `<workspace>/.kcode/kcode.jsonc` | Higher (overrides) |

### Key Configuration Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `agentName` | string | `''` | Agent identifier (kilo, opencode, claude, or custom) |
| `agentPath` | string | `''` | Custom agent executable path |
| `agentArgs` | string[] | `[]` | Additional agent arguments |
| `provider.openai.apiKey` | string | `''` | OpenAI-compatible API key |
| `provider.openai.model` | string | `deepseek-v4-flash` | Model name |
| `provider.openai.baseUrl` | string | `https://api.deepseek.com` | API endpoint |
| `provider.anthropic.apiKey` | string | `''` | Anthropic API key |
| `log.acpLogEnabled` | boolean | `false` | Enable ACP logging |
| `log.acpLogMaxGlobal` | number | `5000` | Max log lines globally |
| `log.acpLogMaxTask` | number | `2000` | Max log lines per task |
| `ui.language` | string | - | UI language |
| `devices` | array | `[]` | Saved device connections (SSH/ADB/Telnet/Local) |
| `plugins` | object | `{}` | Plugin enable/disable + per-plugin config |

### ConfigService (`/src/core/ConfigService.ts`)

- **Hot-reload**: File watcher auto-reloads on save
- **Merging**: Global + project files merged with project override
- **Singleton**: `ConfigService.getInstance()` / `ConfigService.setInstance()`
- **Type-safe**: `get<T>(key, defaultValue)` with string key path
- **Event-driven**: `onDidChange` event for UI refresh

## Testing

```bash
npx vitest run                    # Run all tests
npx vitest run --reporter verbose # Verbose output
```

Test files (matched by `src/**/*.test.ts`):

| File | What it tests |
|------|---------------|
| `/src/taskflow/__tests__/TaskFlow.test.ts` | 7 cases — state machine transitions |
| `/src/core/__tests__/` | Core service tests |
| `/src/core/plugin/__tests__/` | Plugin system integration |
| `/src/view/__tests__/` | View layer tests |
| `/src/view/webview/__tests__/` | WebView rendering tests |

*Source: `/vitest.config.ts`*

## Packaging

```bash
npm run package     # Creates kcode-0.2.0.vsix
```

The `.vsix` can be installed:
- VS Code Extensions panel → `...` → Install from VSIX...
- CLI: `code --install-extension kcode-0.2.0.vsix`

A pre-built `kcode-0.2.0.vsix` (5 MB) exists in the repository root.

## Scripts

| Script | Purpose |
|--------|---------|
| `/scripts/build-webview.js` | Build helper for WebView resources |
| `/scripts/install-gitnexus.sh` | Install GitNexus for OpenCode integration |

## Key Operations Guide

### Adding a New Plugin
1. Create plugin file in `/src/plugins/<name>/`
2. Implement `KCodePlugin` interface
3. Register in `PluginManager` (currently manual or filesystem scan)
4. Add config schema to `types/config.ts` if needed

### Adding a New VS Code Command
1. Create command file in `/src/commands/`
2. Register in `extension.ts` with `vscode.commands.registerCommand`
3. If needed in chat: add slash command in `Panel.ts` constructor

### Adding a New Message Renderer
1. Create renderer in `/src/view/webview/renderers/<name>.ts`
2. Register in `registry.ts`
3. Add dispatch case in `msgRenderer.ts`

### Debugging
- Run VS Code Extension Development Host
- Debug output via `vscode.window.createOutputChannel('KCode Debug')` (see `TaskViewBridgeV2.ts`)
- ACP logs to `~/.kcode/logs/{taskId}/{sessionId}.ndjson` (enable via `log.acpLogEnabled`)

### Environment Management
- `NodeManager` (`/src/env/NodeManager.ts`) locates Node.js binary path for agent processes
- Extension reads VS Code settings under `kcode.*` namespace via `vscode.workspace.getConfiguration`

## Change Guidance for Operations

1. **New dependency**: Update both `package.json` and `tsconfig.json` if build configuration changes
2. **Config key**: Add to `KNOWN_KEYS` in `/src/types/config.ts`, add to `PROJECT_SCOPED_KEYS` if project-specific
3. **Test**: Add test file as `src/**/*.test.ts` — vitest auto-discovers
4. **Build changes**: Update `tsconfig.build.json` if the output structure changes
5. **GitHub issue import**: Implemented in `/src/commands/importGitHubIssue.ts` — uses GitHub API token from config
