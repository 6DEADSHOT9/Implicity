import type { ReactNode } from "react";
import { Badge } from "./badge";
import { Separator } from "./separator";

function Marker({ label, children, actions }: { label: string; children: ReactNode; actions?: ReactNode }) {
  return <aside role="note" aria-label={label} data-slot="marker" className="flex flex-col gap-space-2 text-sm text-foreground">
    <div className="flex items-center gap-space-3" aria-hidden="true">
      <Separator className="min-w-0 flex-1" />
      <Badge variant="secondary">{label}</Badge>
      <Separator className="min-w-0 flex-1" />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-space-2">
      <div>{children}</div>
      {actions}
    </div>
  </aside>;
}

export { Marker };
