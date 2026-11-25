import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  return <section aria-label={title} className="flex flex-col gap-space-4 bg-card p-space-4 text-card-foreground">
    <h2 className="text-heading-3">{title}</h2>
    <Tabs value={activeTab} onValueChange={(value) => onTabChange?.(value as typeof activeTab)} orientation="vertical">
      <TabsList className="w-full flex-wrap">
        {tabs.map((tab) => <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>)}
      </TabsList>
      {tabs.map((tab) => <TabsContent key={tab} value={tab}>
        {slots?.[tab]?.length ? <ItemGroup aria-label={tab}>
          {slots[tab]?.map((child, index) => <Item key={`${tab}-${index}`} role="listitem"><ItemContent>{child}</ItemContent></Item>)}
        </ItemGroup> : <Empty role="status"><EmptyTitle className="text-heading-4">No {tab}</EmptyTitle></Empty>}
      </TabsContent>)}
    </Tabs>
  </section>;
}
