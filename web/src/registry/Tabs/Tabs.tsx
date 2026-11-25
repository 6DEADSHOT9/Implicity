import type { z } from "zod";
import { Tabs as TabsPrimitive, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function Tabs({ tabs, selected, state, onAction }: Props & { onAction?: (action: string, value?: string | number | boolean) => void }) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "Tabs", "default");
  const active = tabs.find(({ id }) => id === selected) ?? tabs[0];
  return <section ref={root} className="min-h-content-height">{state === "error" ? <p role="alert">Views could not be loaded</p> : state === "empty" || !active ? <p>No views available</p> : <TabsPrimitive value={active.id} onValueChange={(id) => { if (id !== active.id) onAction?.("tab_select", id); }}><TabsList aria-label="Views">{tabs.map(({ id, label }) => <TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}</TabsList>{tabs.map(({ id, content }) => <TabsContent key={id} value={id}>{content}</TabsContent>)}</TabsPrimitive>}</section>;
}
