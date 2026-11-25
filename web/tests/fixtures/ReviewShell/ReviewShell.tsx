import type { ReactElement, ReactNode } from "react";

export function ReviewShell({ title, slots }: { title?: string; slots?: { main?: ReactNode[] } }): ReactElement {
  return <div><header>{title}</header><main>{slots?.main}</main></div>;
}
