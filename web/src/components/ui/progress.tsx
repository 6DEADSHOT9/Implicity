"use client"

import * as React from "react"
import { cn } from "cn"

function Progress({ className, ...props }: React.ComponentProps<"progress">) {
  return (
    <progress data-slot="progress" className={cn("h-space-2 w-full accent-primary", className)} {...props} />
  )
}

export { Progress }
