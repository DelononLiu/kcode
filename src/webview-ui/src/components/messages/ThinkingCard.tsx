import { Brain } from 'lucide-react'

export default function ThinkingCard({ content }: { content: string }) {
  return (
    <div className="flex justify-start mb-2">
      <div className="bg-muted/50 rounded-xl px-3 py-2 text-xs text-muted-foreground flex items-start gap-2 max-w-[80%]">
        <Brain className="w-4 h-4 mt-0.5 shrink-0" />
        <span className="line-clamp-2">{content || '思考中...'}</span>
      </div>
    </div>
  )
}
