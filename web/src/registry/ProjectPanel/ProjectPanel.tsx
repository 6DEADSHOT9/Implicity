import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

export function ProjectPanel({ title, tabs, activeTab, slots, onTabChange }: {
  title: string;
  tabs: readonly { id: "decisions" | "constraints" | "files"; label: string }[];
  activeTab: "decisions" | "constraints" | "files";
  slots?: { decisions?: ReactNode[]; constraints?: ReactNode[]; files?: ReactNode[] };
  onTabChange?: (tab: "decisions" | "constraints" | "files") => void;
}): ReactElement {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const initialState = useRef(activeTab);
  const layoutContainer = useRef<HTMLDivElement>(null);
  const layoutProbe = useRef<HTMLSpanElement>(null);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const seenRef = useSeen({ component: "ProjectPanel", defaultState: initialState.current });
  useEffect(() => {
    emitRef.current("component_shown", { component: "ProjectPanel", default_state: initialState.current });
  }, []);

  useLayoutEffect(() => {
    const container = layoutContainer.current;
    const probe = layoutProbe.current;
    if (!container || !probe) return;
    const update = () => setOrientation(getComputedStyle(probe).display === "none" ? "horizontal" : "vertical");
    const observer = new ResizeObserver(update);
    update();
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return <div ref={layoutContainer} className="@container/project-panel w-full min-w-0">
    <section ref={seenRef} aria-label={title} className="relative flex min-w-0 max-w-full flex-col gap-space-4 bg-card p-space-4 text-card-foreground">
    <span ref={layoutProbe} aria-hidden="true" className="absolute hidden @sm/project-panel:block" />
    <h2 className="text-heading-3">{title}</h2>
    <Tabs value={activeTab} onValueChange={(value) => onTabChange?.(value as typeof activeTab)} orientation={orientation} className="min-w-0">
      <TabsList style={orientation === "horizontal" ? { height: "auto" } : undefined} className="w-fit max-w-project-tabs shrink-0 items-stretch group-data-[orientation=horizontal]/tabs:h-auto group-data-[orientation=horizontal]/tabs:w-full group-data-[orientation=horizontal]/tabs:max-w-full group-data-[orientation=horizontal]/tabs:flex-wrap group-data-[orientation=horizontal]/tabs:justify-start">
        {tabs.map(({ id, label }) => <TabsTrigger key={id} value={id} className="min-w-0 max-w-full whitespace-normal wrap-anywhere bg-muted text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground group-data-[orientation=horizontal]/tabs:flex-none" style={{ minHeight: "var(--target-min-size)" }}>{label}</TabsTrigger>)}
      </TabsList>
      {tabs.map(({ id }) => <TabsContent key={id} value={id} className="min-w-0 focus-visible:focus-ring-token focus-visible:ring-ring">
        {slots?.[id]?.length ? <ItemGroup aria-label={id}>
          {slots[id]?.map((child, index) => <Item key={`${id}-${index}`} role="listitem" className="min-w-0"><ItemContent className="min-w-0 wrap-anywhere">{child}</ItemContent></Item>)}
        </ItemGroup> : <Empty role="status"><EmptyTitle className="text-heading-4">No {id}</EmptyTitle></Empty>}
      </TabsContent>)}
    </Tabs>
    </section>
  </div>;
}
