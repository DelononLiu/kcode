export default function TextMessage({
  content,
  streaming,
}: {
  content: string
  streaming?: boolean
}) {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[80%]">
        <div className="text-sm whitespace-pre-wrap">{content}</div>
        {streaming && (
          <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
        )}
      </div>
    </div>
  )
}
