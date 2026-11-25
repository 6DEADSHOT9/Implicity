import type { CSSProperties } from "react";
import type { z } from "zod";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
const surface: CSSProperties = { color: "var(--foreground)", backgroundColor: "var(--card)", padding: "var(--space-4)", borderRadius: "var(--radius)" };
export function List({ items, ordered, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "List", "default");
  const Tag = ordered ? "ol" : "ul";
  return <section ref={root} aria-label="List" style={surface}>{state === "error" ? <p role="alert">List could not be loaded</p> : state === "empty" || !items.length ? <p>No items</p> : <Tag>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</Tag>}</section>;
}
