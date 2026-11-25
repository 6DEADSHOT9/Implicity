import { useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCapture } from "../capture";
import { events } from "./events";
import tokens from "../../../../contracts/looks/tokens.json" with { type: "json" };

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
  const id = useId();
  const groupId = `${id}-panel-group`;
  const workspaceId = `${id}-workspace-pane`;
  const panelId = `${id}-docked-panel-pane`;
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const defaultState = !open ? "closed" : docked ? "open_docked" : "open_undocked";
  const initialState = useRef(defaultState);
  const previous = useRef({ open, docked });
  useEffect(() => {
    emitRef.current("component_shown", { component: "DockedPanel", default_state: initialState.current });
  }, []);
  useEffect(() => {
    if (previous.current.open !== open) emit(open ? "panel_opened" : "panel_closed", { component: "DockedPanel" });
    if (previous.current.docked !== docked) emit(docked ? "panel_docked" : "panel_undocked", { component: "DockedPanel" });
    previous.current = { open, docked };
  }, [open, docked, emit]);

  const panelTabs =
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="w-full flex-wrap">
        {tabs.map((tab) => <TabsTrigger key={tab} value={tab} className="bg-muted text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground" style={{ minHeight: "var(--target-min-size)" }}>{tab}</TabsTrigger>)}
      </TabsList>
      {tabs.map((tab) => <TabsContent key={tab} value={tab} className="focus-visible:focus-ring-token focus-visible:ring-ring">{activeTab === tab ? slots?.main : null}</TabsContent>)}
    </Tabs>

  const controls = <div className="flex flex-wrap gap-space-2">
    <Button variant="outline" className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground" style={{ minHeight: "var(--target-min-size)" }} onClick={() => onDockChange?.(!docked)}>{docked ? "Undock" : "Dock"}</Button>
    <Button variant="outline" className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground" style={{ minHeight: "var(--target-min-size)" }} onClick={() => onOpenChange?.(!open)}>{open ? "Close" : "Open"}</Button>
  </div>;

  if (isMobile || !docked) {
    return <Sheet open={open} onOpenChange={(next) => onOpenChange?.(next)}>
      <SheetTrigger asChild><Button variant="outline" className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground" style={{ minHeight: "var(--target-min-size)" }}>{open ? title : `Open ${title}`}</Button></SheetTrigger>
      <SheetContent side="right" aria-label={title} showCloseButton={false} className="overflow-y-auto">
        <header className="flex flex-col gap-space-3 px-space-4 pt-space-4">
          <SheetTitle className="text-heading-3">{title}</SheetTitle>
          <div className="flex flex-wrap gap-space-2">{controls}</div>
        </header>
        <SheetDescription>Workspace tabs and content</SheetDescription>
        {open && panelTabs}
      </SheetContent>
    </Sheet>;
  }

  if (!open) return <Button variant="outline" className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground" style={{ minHeight: "var(--target-min-size)" }} onClick={() => onOpenChange?.(true)}>Open {title}</Button>;

  return <ResizablePanelGroup id={groupId} defaultLayout={{ [workspaceId]: 64, [panelId]: 36 }} orientation="horizontal" className="min-w-panel">
    <ResizablePanel id={workspaceId} minSize="30%">
      <div aria-hidden="true" className="h-full bg-muted" />
    </ResizablePanel>
    <ResizableHandle withHandle aria-label="Resize workspace and panel" />
    <ResizablePanel id={panelId} minSize={tokens.derivedTokens.dimensions["--panel-min-width"]} maxSize="70%" className="overflow-auto">
      <section aria-label={title} className="flex h-full flex-col gap-space-4 bg-card p-space-4 text-card-foreground">
        <div className="flex flex-wrap items-center justify-between gap-space-2">
          <h2 className="text-heading-3">{title}</h2>
          {controls}
        </div>
        {panelTabs}
      </section>
    </ResizablePanel>
  </ResizablePanelGroup>;
}
