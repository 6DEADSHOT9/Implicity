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
  return <section ref={root}>{state === "error" ? <p role="alert">Views could not be loaded</p> : state === "empty" || !active ? <p>No views available</p> : <TabsPrimitive value={active.id}><TabsList aria-label="Views">{tabs.map(({ id, label }, index) => <TabsTrigger key={id} value={id} onClick={() => onAction?.("tab_select", id)} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") onAction?.("tab_select", tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].id); }}>{label}</TabsTrigger>)}</TabsList>{tabs.map(({ id, content }) => <TabsContent key={id} value={id}>{content}</TabsContent>)}</TabsPrimitive>}</section>;
}
