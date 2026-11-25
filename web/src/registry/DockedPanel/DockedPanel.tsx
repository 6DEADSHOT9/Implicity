import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
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

  const changeOpen = (next: boolean) => {
    if (next !== open) emit(next ? "panel_opened" : "panel_closed", { component: "DockedPanel" });
    onOpenChange?.(next);
  };
  const panelTabs = <>
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="w-full flex-wrap">
        {tabs.map((tab) => <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>)}
      </TabsList>
      {tabs.map((tab) => <TabsContent key={tab} value={tab}>{activeTab === tab ? slots?.main : null}</TabsContent>)}
    </Tabs>
  </>;

  if (isMobile || !docked) {
    return <Sheet open={open} onOpenChange={changeOpen}>
      <SheetTrigger asChild><Button variant="outline">{open ? title : `Open ${title}`}</Button></SheetTrigger>
      <SheetContent side="right" aria-label={title}>
        <header className="flex items-center justify-between gap-space-2 px-space-4 pt-space-4">
          <SheetTitle className="text-heading-3">{title}</SheetTitle>
          <Button variant="outline" onClick={() => {
            emit(docked ? "panel_undocked" : "panel_docked", { component: "DockedPanel" });
            onDockChange?.(!docked);
          }}>{docked ? "Undock" : "Dock"}</Button>
        </header>
        <SheetDescription>Panel contents</SheetDescription>
        {open && panelTabs}
      </SheetContent>
    </Sheet>;
  }

  if (!open) return <Button variant="outline" onClick={() => changeOpen(true)}>Open {title}</Button>;

  return <ResizablePanelGroup id="docked-panel-group" defaultLayout={{ "workspace-pane": 64, "docked-panel-pane": 36 }} orientation="horizontal" className="min-w-panel">
    <ResizablePanel id="workspace-pane" minSize="30%">
      <div aria-hidden="true" className="h-full bg-muted" />
    </ResizablePanel>
    <ResizableHandle withHandle />
    <ResizablePanel id="docked-panel-pane" minSize={288} maxSize="70%" className="overflow-auto">
      <section aria-label={title} className="flex h-full flex-col gap-space-4 bg-card p-space-4 text-card-foreground">
        <div className="flex items-center justify-between gap-space-2">
          <h2 className="text-heading-3">{title}</h2>
          <Button variant="outline" onClick={() => {
            emit("panel_undocked", { component: "DockedPanel" });
            onDockChange?.(false);
          }}>Undock</Button>
          <Button variant="outline" onClick={() => changeOpen(false)}>Close</Button>
        </div>
        {panelTabs}
      </section>
    </ResizablePanel>
  </ResizablePanelGroup>;
}
