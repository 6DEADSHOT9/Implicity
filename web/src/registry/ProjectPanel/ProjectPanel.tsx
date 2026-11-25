import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { token } from "../token";
import { useCapture } from "../capture";
import { events } from "./events";

export function ProjectPanel({ title, tabs, activeTab, slots, onTabChange }: {
  title: string;
  tabs: readonly ("decisions" | "constraints" | "files")[];
  activeTab: "decisions" | "constraints" | "files";
  slots?: { decisions?: ReactNode[]; constraints?: ReactNode[]; files?: ReactNode[] };
  onTabChange?: (tab: "decisions" | "constraints" | "files") => void;
}): ReactElement {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const initialState = useRef(activeTab);
  useEffect(() => {
    emitRef.current("component_shown", { component: "ProjectPanel", default_state: initialState.current });
    const timer = window.setTimeout(() => emitRef.current("component_seen", { component: "ProjectPanel", default_state: initialState.current, seconds_visible: 3 }), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  const content = slots?.[activeTab];
  return <section aria-label={title} className="flex flex-col gap-3 rounded-md bg-card p-4 text-card-foreground">
    <h2>{title}</h2>
    <div role="group" aria-label={`${title} sections`} className="flex flex-wrap gap-2">
      {tabs.map((tab) => <button key={tab} type="button" aria-pressed={tab === activeTab} style={{ minHeight: token("--target-min-size") }} onClick={() => onTabChange?.(tab)}>{tab}</button>)}
    </div>
    <div role="region" aria-label={activeTab}>{content?.length ? content : <p role="status">No {activeTab}</p>}</div>
  </section>;
}
