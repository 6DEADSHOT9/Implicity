import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-space-1 overflow-hidden rounded-full border-token border-transparent px-space-2 py-space-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-token focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive  [&>svg]:pointer-events-none [&>svg]:size-space-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary",
        destructive:
          "bg-destructive text-primary-foreground focus-visible:ring-destructive   [a&]:hover:bg-destructive",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary  [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
