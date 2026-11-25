import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";
import { Badge } from "./badge";
import { Separator } from "./separator";

function Marker({ label, children, actions, className, ...props }: Omit<ComponentProps<"aside">, "role" | "aria-label"> & { label: string; actions?: ReactNode }) {
  return <aside role="note" aria-label={label} {...props} data-slot="marker" className={cn("flex flex-col gap-space-2 text-sm text-foreground", className)}>
    <div className="flex items-center gap-space-3" aria-hidden="true">
      <Separator className="min-w-0 flex-1" />
      <Badge variant="secondary" className="min-w-0 max-w-full shrink truncate">{label}</Badge>
      <Separator className="min-w-0 flex-1" />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-space-2">
      <div>{children}</div>
      {actions}
    </div>
  </aside>;
}

export { Marker };
