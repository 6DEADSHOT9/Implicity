import type { z } from "zod";
import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function Checklist({ title, items, state, onAction }: Props & { onAction?: (action: string, value?: string | number | boolean) => void }) {
  const id = useId();
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "Checklist", state);
  return <section ref={root} className="space-y-space-3"><h2 className="text-heading-4">{title}</h2>{state === "error" ? <p role="alert">Checklist could not be loaded</p> : state === "empty" || !items.length ? <p>No items</p> : <ItemGroup>{items.map(({ label, checked }, index) => { const itemId = `${id}-${index}`; return <Item key={`${label}-${index}`} className="min-h-control"><ItemContent><Label htmlFor={itemId} className="flex min-h-control cursor-pointer items-center gap-space-3"><Checkbox id={itemId} checked={checked} onCheckedChange={() => onAction?.("checklist_toggle", index)} />{label}</Label></ItemContent></Item>; })}</ItemGroup>}</section>;
}
