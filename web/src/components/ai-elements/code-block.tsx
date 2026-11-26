import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { cn } from "cn";

const CodeBlockContext = createContext({ code: "" });

export function CodeBlock({ code = "", language = "text", className, children, ...props }: ComponentProps<"div"> & { code?: string; language?: string; children: ReactNode }) {
  return <CodeBlockContext.Provider value={{ code }}><div data-slot="code-block" data-language={language} className={cn("overflow-hidden rounded-md bg-code-background font-mono text-code-foreground", className)} {...props}>{children}</div></CodeBlockContext.Provider>;
}

export function CodeBlockHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-block-header" className={cn("flex items-center justify-between border-b-token px-space-3 py-space-2 text-sm", className)} {...props} />;
}

export function CodeBlockTitle({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="code-block-title" className={cn("font-mono", className)} {...props} />;
}

export function CodeBlockContent({ className, children, ...props }: ComponentProps<"pre">) {
  const { code } = useContext(CodeBlockContext);
  return <div data-slot="code-block-container" className="max-h-content-height overflow-auto"><pre data-slot="code-block-content" className={cn("m-0 whitespace-pre bg-code-background p-space-4 font-mono text-code-foreground", className)} {...props}><code>{children ?? code}</code></pre></div>;
}
