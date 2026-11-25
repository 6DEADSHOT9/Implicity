import type { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function Checklist({ title, items, state, onAction }: Props & { onAction?: (action: string, value?: string | number | boolean) => void }) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "Checklist", "default");
  return <section ref={root} className="space-y-space-3"><h2 className="text-heading-4">{title}</h2>{state === "error" ? <p role="alert">Checklist could not be loaded</p> : state === "empty" || !items.length ? <p>No items</p> : <ItemGroup>{items.map(({ label, checked }, index) => <Item key={`${label}-${index}`}><Checkbox id={`check-${index}`} checked={checked} onClick={() => onAction?.("checklist_toggle", index)} /><ItemContent><ItemTitle><Label htmlFor={`check-${index}`}>{label}</Label></ItemTitle></ItemContent></Item>)}</ItemGroup>}</section>;
}
