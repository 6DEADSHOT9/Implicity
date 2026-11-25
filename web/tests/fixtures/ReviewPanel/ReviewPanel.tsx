import type { ReactElement, ReactNode } from "react";
import "./responsive.css";

export function ReviewPanel({ count, fail, slots }: { count: number; fail?: boolean; slots?: { main?: ReactNode[] } }): ReactElement {
  if (fail) throw new Error("synthetic Skeleton render failure");
  return <section className="review-panel" data-count={count}><strong>{count}</strong>{slots?.main}<output data-match-media>{window.matchMedia("(min-width: 900px)").matches ? "wide" : "narrow"}</output><h2 data-preview-heading style={{ fontFamily: "inherit" }}>Preview heading</h2></section>;
}
