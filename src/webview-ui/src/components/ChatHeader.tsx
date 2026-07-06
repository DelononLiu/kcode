import { Badge } from '@/components/ui/badge'
import { useChatStore } from '@/stores/chatStore'

const phaseLabels: Record<string, string> = {
  goal: '确认目标',
  plan: '制定计划',
  execute: '执行',
  self_verify: '自我验证',
  review: '验收',
}

export default function ChatHeader() {
  const viewMode = useChatStore((s) => s.viewMode)
  const phase = useChatStore((s) => s.activePhase)
  const title = useChatStore((s) => s.taskTitle)
  const connected = useChatStore((s) => s.agentConnected)
  const agentName = useChatStore((s) => s.agentName)
  const streaming = useChatStore((s) => s.streaming)

  return (
    <div className="border-b border-border px-4 py-2.5 flex items-center gap-3 min-h-[44px]">
      <span className="font-medium text-sm truncate">
        {viewMode === 'assistant' ? '小助手' : title || '任务'}
      </span>

      {viewMode === 'task' && phase && phaseLabels[phase] && (
        <Badge variant="outline">{phaseLabels[phase]}</Badge>
      )}

      {streaming && (
        <span className="text-xs text-blue-500 animate-pulse">生成中...</span>
      )}

      <span className="ml-auto text-xs flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            connected ? 'bg-green-500' : 'bg-muted-foreground'
          }`}
        />
        {connected ? agentName || '已连接' : '未连接'}
      </span>
    </div>
  )
}
