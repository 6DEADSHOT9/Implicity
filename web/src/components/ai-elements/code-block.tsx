import type { ComponentProps } from "react";
import { cn } from "cn";

export function CodeBlock({ className, ...props }: ComponentProps<"pre">) {
  return <pre data-slot="code-block" className={cn("max-h-content-height overflow-auto rounded-md bg-code-background p-space-4 font-mono text-code-foreground", className)} {...props} />;
}
