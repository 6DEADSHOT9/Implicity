import type { ReactElement, ReactNode } from "react";

export function ReviewPanel({ count, fail, slots }: { count: number; fail?: boolean; slots?: { main?: ReactNode[] } }): ReactElement {
  if (fail) throw new Error("synthetic Skeleton render failure");
  return <section><strong>{count}</strong>{slots?.main}<h2 data-preview-heading style={{ fontFamily: "inherit" }}>Preview heading</h2></section>;
}
