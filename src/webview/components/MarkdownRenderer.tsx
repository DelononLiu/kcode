import { useMemo } from "react";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

interface Props {
  content: string;
}

export function MarkdownRenderer({ content }: Props) {
  const html = useMemo(() => {
    try { return marked.parse(content) as string; }
    catch { return `<p>${content}</p>`; }
  }, [content]);

  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
