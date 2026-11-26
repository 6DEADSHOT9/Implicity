import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "../../hooks/use-mobile";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../components/ui/resizable";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "../../components/ui/sidebar";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { panelOpen: boolean; slots?: { main?: React.ReactNode[]; navigation?: React.ReactNode[]; panel?: React.ReactNode[] } };
const sidebarWidth = 256;
const resizeHandleWidth = 44;
const mainMinWidth = 320;
const panelMinWidth = 288;

export function AppShell({ panelOpen, slots = {} }: Props) {
  const isMobile = useIsMobile();
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === "undefined" ? 1200 : window.innerWidth);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const seenRef = useSeen({ component: "AppShell", defaultState: panelOpen ? "docked" : "default" });
  emitRef.current = emit;
  useEffect(() => { emitRef.current("component_shown", { component: "AppShell", default_state: panelOpen ? "docked" : "default" }); }, []);
  const main = <div className="min-w-0 p-space-4">{slots.main}</div>;
  const availablePanelWidth = Math.max(viewportWidth - sidebarWidth - resizeHandleWidth, 1);
  const dockedMainMinSize = Math.ceil(mainMinWidth / availablePanelWidth * 100);
  const dockedPanelMinSize = Math.ceil(panelMinWidth / availablePanelWidth * 100);
  const narrow = isMobile || dockedMainMinSize + dockedPanelMinSize > 100;
  const mainMinSize = narrow ? 52 : dockedMainMinSize;
  const panelMinSize = narrow ? 24 : dockedPanelMinSize;
  return <div ref={seenRef} className="min-w-0">
    <SidebarProvider keyboardShortcut={false} className="min-h-svh min-w-0 max-[907px]:flex-col">
      <Sidebar className="h-svh max-[907px]:h-auto max-[907px]:w-full" collapsible="none"><SidebarContent>{slots.navigation}</SidebarContent></Sidebar>
      <SidebarInset className="min-h-0 min-w-0 flex-1">
        <ResizablePanelGroup orientation={narrow ? "vertical" : "horizontal"} className="min-h-svh min-w-0">
          <ResizablePanel defaultSize={panelOpen ? "70" : "100"} minSize={panelOpen ? String(mainMinSize) : "100"}>{main}</ResizablePanel>
          {panelOpen && <><ResizableHandle withHandle className="w-control after:w-control aria-[orientation=horizontal]:h-control aria-[orientation=horizontal]:after:h-control" /><ResizablePanel defaultSize="30" minSize={String(panelMinSize)}><div className="min-w-0 p-space-3">{slots.panel}</div></ResizablePanel></>}
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  </div>;
}
