import type { z } from "zod";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { Card, CardContent } from "@/components/ui/card";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function List({ items, ordered, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "List", "default");
  const MarkedList = ordered ? "ol" : "ul";
  return <Card ref={root} aria-label="List"><CardContent className="pt-space-6">{state === "error" ? <p role="alert">List could not be loaded</p> : state === "empty" || !items.length ? <p>No items</p> : <MarkedList className={ordered ? "list-decimal ps-space-6" : "list-disc ps-space-6"}>{items.map((item, index) => <Item asChild key={`${item}-${index}`}><li><ItemContent><ItemTitle>{item}</ItemTitle></ItemContent></li></Item>)}</MarkedList>}</CardContent></Card>;
}
