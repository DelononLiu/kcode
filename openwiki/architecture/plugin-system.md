# Plugin System

KCode's plugin system provides a clean extension mechanism via the `KCodePlugin` interface. Plugins activate only in **task mode** and are silent in assistant mode.

## Plugin Interface (`/src/core/plugin/PluginInterface.ts`)

```typescript
interface KCodePlugin {
    id: string;           // Globally unique, e.g. "kcode.myplugin"
    name: string;         // Human-readable name
    version: string;      // SemVer
    mode?: 'task' | 'assistant';  // Default: 'task' — silent in other mode
    dependencies?: string[];
    activate(api: PluginAPI): void | Promise<void>;
    deactivate(): void | Promise<void>;
}
```

## Extension Points (PluginAPI)

| Method | Trigger | Registration |
|--------|---------|-------------|
| `onMessage(type, handler)` | WebView sends matching message type | Type string matching |
| `onPhaseChanged(handler)` | Task phase transition | Always triggered |
| `onToolCall(kind, handler)` | Agent calls specific tool kind | Kind string (`'bash'`, `'read'`, `'write'`, `'todowrite'`, etc.) |
| `addStreamProcessor(processor)` | AI stream chunk received | Text transform chain (composable) |
| `addOutputPanelTab(id, label, renderer)` | Right panel tab creation | Returns HTML string |
| `registerPhaseHook(phase, hook)` | Entering/leaving a phase | `onEnter`/`onLeave` callbacks |

*Source: `/src/core/plugin/PluginInterface.ts`*

## Plugin Lifecycle (`/src/core/plugin/PluginManager.ts`)

Managed by `PluginManager`:

1. **Registration**: `register(plugin)` adds to internal map
2. **Config loading**: `loadConfig()` reads plugin state from `ConfigService` under `plugins` key
3. **Activation**: `enablePlugin(id)` resolves dependencies, calls `plugin.activate(api)`
4. **Dispatch**: `dispatchMessage()`, `dispatchPhaseChanged()`, `dispatchToolCall()` send events to active plugins
5. **Deactivation**: `disablePlugin(id)` calls `plugin.deactivate()` and removes from active set

### Mode Awareness

```typescript
getCurrentMode: () => 'task' | 'assistant'
```

Plugins with `mode: 'task'` (default) only receive events in task mode. Assistant mode silences all task-mode plugins.

## Extension Point Registry (`/src/core/plugin/ExtensionPointRegistry.ts`)

Stores handlers in a multi-map structure:

```typescript
type ExtensionPointType = 'message' | 'phaseChanged' | 'toolCall' | 'stream' | 'uiOutputPanel' | 'phaseHook';
```

Methods:
- `register(type, key, handler, pluginId)` — adds handler
- `getHandlers(type, key)` — returns matching handlers for dispatch
- `removePlugin(pluginId)` — removes all handlers for a plugin

## Built-in Plugins

| Plugin | File | Extension Points Used |
|--------|------|----------------------|
| **DevicePlugin** | `/src/plugins/device/DevicePlugin.ts` | `onMessage` (device:connect/disconnect/command), `onToolCall` (bash) |
| **DemoPlugin** | `/src/plugins/demo/DemoPlugin.ts` | `onMessage`, output panel tab |
| **SetupPlugin** | `/src/plugins/setup/SetupPlugin.ts` | Phase hooks, output panel tab |
| **TodoPlugin** | `/src/plugins/todo/TodoPlugin.ts` | `onToolCall` (todowrite, todoread, todocomplete), `addStreamProcessor` |
| **KnowledgePlugin** | `/src/plugins/knowledge/KnowledgePlugin.ts` | `onToolCall` (knowledge_add, knowledge_query) |
| **ReviewPlugin** | `/src/plugins/review/ReviewPlugin.ts` | Phase hooks, `onToolCall` |
| **DiffPlugin** | `/src/plugins/diff/DiffPlugin.ts` | `onToolCall` (diff), `onMessage` (openFile) |
| **DelegationPlugin** | `/src/plugins/delegate/DelegationPlugin.ts` | `onToolCall` (task_delegate) |
| **TemplatePlugin** | `/src/plugins/_template/TemplatePlugin.ts` | Scaffold for new plugins |

## Creating a Plugin

Copy the template (`/src/plugins/_template/TemplatePlugin.ts`):

```typescript
import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';

const plugin: KCodePlugin = {
    id: 'kcode.myplugin',
    name: 'My Plugin',
    version: '1.0.0',
    async activate(api: PluginAPI) {
        api.onMessage('customEvent', async (msg) => {
            // Handle WebView message
        });
        api.addOutputPanelTab('myTab', 'My Tab', (taskInfo) => {
            return `<div>Status: ${taskInfo?.phase}</div>`;
        });
    },
    async deactivate() {
        // Cleanup
    },
};
export default plugin;
```

## Plugin Configuration

Plugins enabled/disabled via `kcode.jsonc`:

```jsonc
{
  "plugins": {
    "kcode.myplugin": {
      "enabled": true,
      "config": { "customSetting": "value" }
    }
  }
}
```

Loaded by `PluginManager.loadConfig()` from `ConfigService` at the `plugins` key.

## Change Guidance

- **PluginInterface.ts**: Changing `PluginAPI` requires updating all built-in plugins and `PluginManager.createAPI()`
- **ExtensionPointRegistry.ts**: Modified when adding new extension point types
- **PluginManager.ts**: Activation/deactivation logic and config persistence
- **Tests**: `/src/core/plugin/__tests__/`
