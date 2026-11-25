import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
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
  const seenRef = useSeen({ component: "ProjectPanel", defaultState: initialState.current });
  useEffect(() => {
    emitRef.current("component_shown", { component: "ProjectPanel", default_state: initialState.current });
  }, []);

  return <section ref={seenRef} aria-label={title} className="flex flex-col gap-space-4 bg-card p-space-4 text-card-foreground">
    <h2 className="text-heading-3">{title}</h2>
    <Tabs value={activeTab} onValueChange={(value) => onTabChange?.(value as typeof activeTab)} orientation="vertical">
      <TabsList>
        {tabs.map(({ id, label }) => <TabsTrigger key={id} value={id} className="bg-muted text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground" style={{ minHeight: "var(--target-min-size)" }}>{label}</TabsTrigger>)}
      </TabsList>
      {tabs.map(({ id }) => <TabsContent key={id} value={id} className="min-w-0 focus-visible:focus-ring-token focus-visible:ring-ring">
        {slots?.[id]?.length ? <ItemGroup aria-label={id}>
          {slots[id]?.map((child, index) => <Item key={`${id}-${index}`} role="listitem"><ItemContent>{child}</ItemContent></Item>)}
        </ItemGroup> : <Empty role="status"><EmptyTitle className="text-heading-4">No {id}</EmptyTitle></Empty>}
      </TabsContent>)}
    </Tabs>
  </section>;
}
