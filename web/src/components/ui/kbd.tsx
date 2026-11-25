import { cn } from "cn"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-space-5 w-fit min-w-space-5 items-center justify-center gap-space-1 rounded-sm bg-muted px-space-1 font-sans text-xs font-medium text-muted-foreground select-none",
        "[&_svg:not([class*='size-'])]:size-space-3",
        "[[data-slot=tooltip-content]_&]:bg-background [[data-slot=tooltip-content]_&]:text-background ",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-space-1", className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
