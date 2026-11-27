import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useIsMobile } from "../../hooks/use-mobile";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../components/ui/resizable";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "../../components/ui/sidebar";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { panelOpen: boolean; slots?: { main?: React.ReactNode[]; navigation?: React.ReactNode[]; panel?: React.ReactNode[] } };
const mainMinWidth = 320;
const panelMinWidth = 288;

export function AppShell({ panelOpen, slots = {} }: Props) {
  const isMobile = useIsMobile();
  const groupRef = useRef<HTMLDivElement>(null);
  const mainSlotRef = useRef<HTMLDivElement>(null);
  const panelSlotRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ width: 0, handleWidth: 44, mainMin: mainMinWidth, panelMin: panelMinWidth });
  const narrow = isMobile || layout.width < layout.mainMin + layout.panelMin + layout.handleWidth;
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const measure = () => {
      const groupBounds = group.getBoundingClientRect();
      const mainStyle = mainSlotRef.current && getComputedStyle(mainSlotRef.current);
      const panelStyle = panelSlotRef.current && getComputedStyle(panelSlotRef.current);
      const controlHeight = getComputedStyle(group).getPropertyValue("--control-height").trim();
      const controlPixels = controlHeight ? parseFloat(controlHeight) * (controlHeight.endsWith("rem") ? parseFloat(getComputedStyle(document.documentElement).fontSize) : 1) : 44;
      const nextLayout = {
        width: groupBounds.width,
        handleWidth: controlPixels,
        mainMin: mainMinWidth + (mainStyle ? parseFloat(mainStyle.paddingLeft) + parseFloat(mainStyle.paddingRight) : 0),
        panelMin: panelMinWidth + (panelStyle ? parseFloat(panelStyle.paddingLeft) + parseFloat(panelStyle.paddingRight) : 0),
      };
      setLayout((current) => Object.keys(nextLayout).every((key) => current[key as keyof typeof current] === nextLayout[key as keyof typeof nextLayout]) ? current : nextLayout);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    const tokenObserver = new MutationObserver(measure);
    tokenObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    measure();
    return () => { observer.disconnect(); tokenObserver.disconnect(); };
  }, [narrow]);
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const seenRef = useSeen({ component: "AppShell", defaultState: panelOpen ? "docked" : "default" });
  emitRef.current = emit;
  useEffect(() => { emitRef.current("component_shown", { component: "AppShell", default_state: panelOpen ? "docked" : "default" }); }, []);
  return <div ref={seenRef} className="min-w-0">
    <SidebarProvider keyboardShortcut={false} className="flex h-svh min-h-0 min-w-0 flex-col md:flex-row">
      <Sidebar className="h-auto w-full md:h-svh md:w-sidebar" collapsible="none"><SidebarContent>{slots.navigation}</SidebarContent></Sidebar>
      <SidebarInset className="h-full min-h-0 min-w-0 flex-1">
        <ResizablePanelGroup key={narrow ? "stacked" : "docked"} elementRef={groupRef} orientation={narrow ? "vertical" : "horizontal"} className="h-full min-h-0 min-w-0">
          <ResizablePanel defaultSize={panelOpen ? "70" : "100"} minSize={panelOpen ? narrow ? "52" : layout.mainMin : "100"}><div ref={mainSlotRef} className="min-w-0 p-space-4">{slots.main}</div></ResizablePanel>
          {panelOpen && <><ResizableHandle withHandle className="w-control after:w-control aria-[orientation=horizontal]:h-control aria-[orientation=horizontal]:after:h-control" /><ResizablePanel defaultSize="30" minSize={narrow ? "24" : layout.panelMin}><div ref={panelSlotRef} className="min-w-0 p-space-3">{slots.panel}</div></ResizablePanel></>}
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  </div>;
}
