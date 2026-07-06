import { ChevronDown } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'

export default function RoundSummary({
  roundGroup,
  thinking,
  tools,
}: {
  roundGroup: string
  thinking: number
  tools: Record<string, number>
}) {
  const expanded = useChatStore((s) => s.expandedRounds[roundGroup])
  const toggle = () => useChatStore.getState().toggleRound(roundGroup)

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 text-xs text-muted-foreground py-1 px-2 hover:bg-muted/50 rounded-md w-full mb-2"
    >
      <ChevronDown
        className={`w-3.5 h-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
      />
      {thinking > 0 && <span>💭 {thinking} 次思考</span>}
      {Object.keys(tools).length > 0 && (
        <span>🔧 {Object.keys(tools).length} 个工具</span>
      )}
      <span className="ml-auto">{expanded ? '收起' : '显示全部'}</span>
    </button>
  )
}
