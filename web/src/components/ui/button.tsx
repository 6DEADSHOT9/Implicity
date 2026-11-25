import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-space-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:focus-ring-token focus-visible:ring-ring disabled:pointer-events-none  aria-invalid:border-destructive aria-invalid:ring-destructive  [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-icon",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary",
        destructive:
          "bg-destructive text-primary-foreground hover:bg-destructive focus-visible:ring-destructive  ",
        outline:
          "border-token bg-background  hover:bg-accent hover:text-accent-foreground   ",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary",
        ghost:
          "hover:bg-accent hover:text-accent-foreground ",
        link: "text-primary  hover:underline",
      },
      size: {
        default: "h-control px-space-4 py-space-2 has-[>svg]:px-space-3",
        xs: "h-control gap-space-1 rounded-md px-space-2 text-xs has-[>svg]:px-space-1 [&_svg:not([class*='size-'])]:size-space-3",
        sm: "h-control gap-space-1 rounded-md px-space-3 has-[>svg]:px-space-2",
        lg: "h-control rounded-md px-space-6 has-[>svg]:px-space-4",
        icon: "size-control",
        "icon-xs": "size-control rounded-md [&_svg:not([class*='size-'])]:size-space-3",
        "icon-sm": "size-control",
        "icon-lg": "size-control",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
