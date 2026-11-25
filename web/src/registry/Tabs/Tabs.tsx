import type { z } from "zod";
import type { ReactNode } from "react";
import { Tabs as TabsPrimitive, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function Tabs({ tabs, selected, state, slots, onAction }: Props & { slots?: Partial<Record<string, ReactNode[]>>; onAction?: (action: string, value?: string | number | boolean) => void }) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "Tabs", selected);
  return <section ref={root} style={{ minHeight: "var(--content-min-height)" }}>{state === "error" ? <p role="alert">Views could not be loaded</p> : state === "empty" ? <p>No views available</p> : <TabsPrimitive value={selected} onValueChange={(id) => { if (id !== selected) onAction?.("tab_select", id); }}><TabsList aria-label="Views">{tabs.map(({ id, label }) => <TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}</TabsList>{tabs.map(({ id }) => <TabsContent key={id} value={id}>{slots?.[id]}</TabsContent>)}</TabsPrimitive>}</section>;
}
