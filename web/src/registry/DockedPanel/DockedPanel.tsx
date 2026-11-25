import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { token } from "../token";
import { useCapture } from "../capture";
import { events } from "./events";

export function DockedPanel({ title, tabs, activeTab, open, docked, slots, onTabChange, onOpenChange, onDockChange }: {
  title: string;
  tabs: readonly string[];
  activeTab: string;
  open: boolean;
  docked: boolean;
  slots?: { main?: ReactNode[] };
  onTabChange?: (tab: string) => void;
  onOpenChange?: (open: boolean) => void;
  onDockChange?: (docked: boolean) => void;
}): ReactElement {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const defaultState = !open ? "closed" : docked ? "open_docked" : "open_undocked";
  const initialState = useRef(defaultState);
  useEffect(() => {
    emitRef.current("component_shown", { component: "DockedPanel", default_state: initialState.current });
    const timer = window.setTimeout(() => emitRef.current("component_seen", { component: "DockedPanel", default_state: initialState.current, seconds_visible: 3 }), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  return <section aria-label={title} className="flex flex-col gap-3 rounded-md bg-card p-4 text-card-foreground" data-docked={docked} data-open={open}>
    <header className="flex items-center justify-between gap-3"><h2>{title}</h2><span>{docked ? "Docked" : "Floating"}</span>
      <button type="button" style={{ minHeight: token("--target-min-size") }} onClick={() => { emit(docked ? "panel_undocked" : "panel_docked", { component: "DockedPanel" }); onDockChange?.(!docked); }}>{docked ? "Undock" : "Dock"}</button>
      <button type="button" style={{ minHeight: token("--target-min-size") }} onClick={() => { emit(open ? "panel_closed" : "panel_opened", { component: "DockedPanel" }); onOpenChange?.(!open); }}>{open ? "Close" : "Open"}</button>
    </header>
    {open && <div role="group" aria-label={`${title} tabs`} className="flex gap-2">
      {tabs.map((tab) => <button key={tab} type="button" aria-pressed={tab === activeTab} style={{ minHeight: token("--target-min-size") }} onClick={() => onTabChange?.(tab)}>{tab}</button>)}
    </div>}
    {open && <div>{slots?.main}</div>}
  </section>;
}
