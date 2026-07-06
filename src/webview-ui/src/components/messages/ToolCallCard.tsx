import type { ReactNode } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { Message } from '@/lib/types'

const kindIcons: Record<string, string> = {
  write: '📝',
  edit: '✏️',
  read: '📖',
  bash: '💻',
  thinking: '💭',
  default: '🔧',
}

const statusIcons: Record<string, ReactNode> = {
  running: <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-500" />,
}

export default function ToolCallCard({ toolCall, toolResult }: Message) {
  if (!toolCall) return null
  const icon = kindIcons[toolCall.kind] || kindIcons.default
  const statusIcon = statusIcons[toolCall.status] || null

  return (
    <div className="flex justify-start mb-2">
      <div className="bg-muted/40 rounded-xl px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 max-w-[80%]">
        <span>{icon}</span>
        <span className="font-medium text-foreground/80 truncate">
          {toolCall.title || toolCall.kind}
        </span>
        {statusIcon}
        {toolResult?.output && (
          <span className="text-muted-foreground truncate ml-1 max-w-[200px]">
            {toolResult.output.slice(0, 60)}
          </span>
        )}
      </div>
    </div>
  )
}
