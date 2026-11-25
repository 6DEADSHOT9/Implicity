import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-control w-full min-w-0 rounded-md border-token border-input bg-transparent px-space-3 py-space-1 text-base  transition-colors outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-control  file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed  md:text-sm ",
        "focus-visible:border-ring focus-visible:focus-ring-token focus-visible:ring-ring",
        "aria-invalid:border-destructive aria-invalid:ring-destructive ",
        className
      )}
      {...props}
    />
  )
}

export { Input }
