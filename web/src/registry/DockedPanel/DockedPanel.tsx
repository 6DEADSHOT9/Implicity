import { useCallback, useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";
import tokens from "../../../../contracts/looks/tokens.json" with { type: "json" };

export function DockedPanel({ title, tabs, activeTab, open, docked, slots, onTabChange, onOpenChange, onDockChange }: {
  title: string;
  tabs: readonly { id: string; label: string }[];
  activeTab: string;
  open: boolean;
  docked: boolean;
  slots?: Partial<Record<string, ReactNode[]>>;
  onTabChange?: (tab: string) => void;
  onOpenChange?: (open: boolean) => void;
  onDockChange?: (docked: boolean) => void;
}): ReactElement {
  const isMobile = useIsMobile();
  const id = useId();
  const groupId = `${id}-panel-group`;
  const workspaceId = `${id}-workspace-pane`;
  const panelId = `${id}-docked-panel-pane`;
  const displayState = !open ? "closed" : isMobile || !docked ? "open_undocked" : "open_docked";
  const initialState = useRef(displayState);
  const seenRef = useSeen({ component: "DockedPanel", defaultState: initialState.current });
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dockButtonRef = useRef<HTMLButtonElement>(null);
  const setOpenButtonRef = useCallback((node: HTMLButtonElement | null) => {
    openButtonRef.current = node;
    if (displayState === initialState.current) seenRef(node);
  }, [displayState, seenRef]);
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const previous = useRef({ open, docked, isMobile });
  useEffect(() => {
    emitRef.current("component_shown", { component: "DockedPanel", default_state: initialState.current });
  }, []);
  useEffect(() => {
    const before = previous.current;
    if (before.open !== open) {
      emit(open ? "panel_opened" : "panel_closed", { component: "DockedPanel" });
      requestAnimationFrame(() => (open ? closeButtonRef : openButtonRef).current?.focus());
    } else if (before.docked !== docked && before.isMobile === isMobile && !isMobile && open) {
      emit(docked ? "panel_docked" : "panel_undocked", { component: "DockedPanel" });
      requestAnimationFrame(() => dockButtonRef.current?.focus());
    }
    previous.current = { open, docked, isMobile };
  }, [open, docked, isMobile, emit]);

  const matchesInitialState = displayState === initialState.current;
  const panelTabs = <Tabs value={activeTab} onValueChange={onTabChange}>
    <TabsList className="max-w-full flex-wrap">
      {tabs.map(({ id, label }) => <TabsTrigger key={id} value={id} className="bg-muted text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground" style={{ minHeight: "var(--target-min-size)" }}>{label}</TabsTrigger>)}
    </TabsList>
    {tabs.map(({ id }) => <TabsContent key={id} value={id} className="min-w-0 focus-visible:focus-ring-token focus-visible:ring-ring">{activeTab === id ? slots?.[id] : null}</TabsContent>)}
  </Tabs>;

  const controls = <div className="flex flex-wrap gap-space-2">
    {!isMobile && <Button ref={dockButtonRef} variant="outline" className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground" style={{ minHeight: "var(--target-min-size)" }} onClick={() => onDockChange?.(!docked)}>{docked ? "Undock" : "Dock"}</Button>}
    <Button ref={closeButtonRef} variant="outline" className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground" style={{ minHeight: "var(--target-min-size)" }} onClick={() => onOpenChange?.(!open)}>Close</Button>
  </div>;

  if (isMobile || !docked) {
    return <Sheet open={open} onOpenChange={(next) => onOpenChange?.(next)}>
      <SheetTrigger asChild><Button ref={setOpenButtonRef} variant="outline" className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground" style={{ minHeight: "var(--target-min-size)" }}>{open ? title : `Open ${title}`}</Button></SheetTrigger>
      <SheetContent ref={open && matchesInitialState ? seenRef : undefined} side="right" aria-label={title} showCloseButton={false} className="overflow-y-auto p-0">
        <div data-panel-sheet-body className="flex min-w-0 flex-col gap-space-4 p-space-4">
          <header className="flex flex-wrap items-center justify-between gap-space-2">
            <SheetTitle className="text-heading-3">{title}</SheetTitle>
            {controls}
          </header>
          <SheetDescription className="visually-hidden">Panel for {title}</SheetDescription>
          {open && panelTabs}
        </div>
      </SheetContent>
    </Sheet>;
  }

  if (!open) return <Button ref={setOpenButtonRef} variant="outline" className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground" style={{ minHeight: "var(--target-min-size)" }} onClick={() => onOpenChange?.(true)}>Open {title}</Button>;

  return <ResizablePanelGroup id={groupId} defaultLayout={{ [workspaceId]: 64, [panelId]: 36 }} orientation="horizontal" className="min-w-panel">
    <ResizablePanel id={workspaceId} minSize="30%">
      <div aria-hidden="true" className="h-full bg-muted" />
    </ResizablePanel>
    <ResizableHandle withHandle aria-label="Resize workspace and panel" />
    <ResizablePanel id={panelId} minSize={tokens.derivedTokens.dimensions["--panel-min-width"]} maxSize="70%" className="overflow-auto">
      <section ref={matchesInitialState ? seenRef : undefined} aria-label={title} className="flex h-full flex-col gap-space-4 bg-card p-space-4 text-card-foreground">
        <div className="flex flex-wrap items-center justify-between gap-space-2">
          <h2 className="text-heading-3">{title}</h2>
          {controls}
        </div>
        {panelTabs}
      </section>
    </ResizablePanel>
  </ResizablePanelGroup>;
}
