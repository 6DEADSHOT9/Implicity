"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 items-center rounded-full border-token border-transparent  transition-all outline-none focus-visible:border-ring focus-visible:focus-ring-token focus-visible:ring-ring disabled:cursor-not-allowed  h-space-3 w-control data-[size=sm]:w-space-6 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input ",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-background ring-token transition-transform group-data-[size=default]/switch:size-icon group-data-[size=sm]/switch:size-space-3 data-[state=checked]:translate-x-full data-[state=unchecked]:translate-x-0  "
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
