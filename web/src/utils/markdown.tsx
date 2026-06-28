import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { cn } from "@/utils/classname";

export function MarkdownView(props: {
  source: string;
  className?: string;
}) {
  const { source, className } = props;

  if (!source.trim()) {
    return (
      <p className={cn("text-sm italic text-muted", className)}>
        No description provided.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none prose-a:text-accent-strong prose-headings:font-display prose-headings:tracking-tight",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
