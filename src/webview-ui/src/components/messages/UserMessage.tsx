export default function UserMessage({
  content,
  timestamp,
}: {
  content: string
  timestamp: number
}) {
  return (
    <div className="flex justify-end mb-3">
      <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        <span className="text-[10px] opacity-60 mt-1 block text-right">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}
