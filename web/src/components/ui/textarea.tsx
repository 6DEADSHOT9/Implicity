import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex  min-h-content-height w-full rounded-md token-border border-input bg-transparent px-space-3 py-space-2 text-base  transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:focus-ring-token focus-visible:ring-ring disabled:cursor-not-allowed  aria-invalid:border-destructive aria-invalid:ring-destructive md:text-sm  ",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
