import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../components/ui/resizable";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "../../components/ui/sidebar";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { panelOpen: boolean; onPanelOpenChange?: (open: boolean) => void; slots?: { main?: React.ReactNode[]; navigation?: React.ReactNode[]; panel?: React.ReactNode[] } };

export function AppShell({ panelOpen, onPanelOpenChange, slots = {} }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const previous = useRef(panelOpen);
  const seenRef = useSeen({ component: "AppShell", defaultState: panelOpen ? "docked" : "default" });
  emitRef.current = emit;
  useEffect(() => { emitRef.current("component_shown", { component: "AppShell", default_state: panelOpen ? "docked" : "default" }); }, []);
  useEffect(() => {
    if (previous.current !== panelOpen) emit(panelOpen ? "panel_opened" : "panel_closed", { component: "AppShell" });
    previous.current = panelOpen;
  }, [emit, panelOpen]);
  const main = <div className="min-w-0 p-space-4">{slots.main}{!panelOpen && <Button type="button" variant="outline" onClick={() => onPanelOpenChange?.(true)}>Open panel</Button>}</div>;
  return <div ref={seenRef} className="min-w-0">
    <SidebarProvider className="min-h-svh min-w-0">
      <Sidebar role="navigation" aria-label="Workspace navigation" collapsible="none"><SidebarContent>{slots.navigation}</SidebarContent></Sidebar>
      <SidebarInset className="min-w-0">
        {panelOpen ? <ResizablePanelGroup orientation="horizontal" className="min-h-svh min-w-0">
          <ResizablePanel defaultSize={70} minSize={50}>{main}</ResizablePanel><ResizableHandle withHandle />
          <ResizablePanel defaultSize={30} minSize={20}><aside aria-label="Docked panel" className="min-w-0 p-space-3"><div className="flex items-center justify-between gap-space-2"><h2 className="min-w-0 break-words text-base font-semibold">Details</h2><Button type="button" variant="ghost" onClick={() => onPanelOpenChange?.(false)}>Close panel</Button></div>{slots.panel}</aside></ResizablePanel>
        </ResizablePanelGroup> : main}
      </SidebarInset>
    </SidebarProvider>
  </div>;
}
