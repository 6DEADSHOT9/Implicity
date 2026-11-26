import { useEffect, useRef } from "react";
import { useIsMobile } from "../../hooks/use-mobile";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../components/ui/resizable";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "../../components/ui/sidebar";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { panelOpen: boolean; slots?: { main?: React.ReactNode[]; navigation?: React.ReactNode[]; panel?: React.ReactNode[] } };

export function AppShell({ panelOpen, slots = {} }: Props) {
  const isMobile = useIsMobile();
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const seenRef = useSeen({ component: "AppShell", defaultState: panelOpen ? "docked" : "default" });
  emitRef.current = emit;
  useEffect(() => { emitRef.current("component_shown", { component: "AppShell", default_state: panelOpen ? "docked" : "default" }); }, []);
  const main = <div className="min-w-0 p-space-4">{slots.main}</div>;
  return <div ref={seenRef} className="min-w-0">
    <SidebarProvider keyboardShortcut={false} className="min-h-svh min-w-0 max-md:flex-col">
      <Sidebar className="h-svh max-md:h-auto max-md:w-full" collapsible="none"><SidebarContent>{slots.navigation}</SidebarContent></Sidebar>
      <SidebarInset className="min-h-0 min-w-0 flex-1">
        <ResizablePanelGroup orientation={isMobile ? "vertical" : "horizontal"} className="min-h-svh min-w-0">
          <ResizablePanel defaultSize={panelOpen ? "70" : "100"} minSize={panelOpen ? "52" : "100"}>{main}</ResizablePanel>
          {panelOpen && <><ResizableHandle withHandle className="w-control after:w-control aria-[orientation=horizontal]:h-control aria-[orientation=horizontal]:after:h-control" /><ResizablePanel defaultSize="30" minSize="24"><div className="min-w-0 p-space-3">{slots.panel}</div></ResizablePanel></>}
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  </div>;
}
