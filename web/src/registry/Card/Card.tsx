import type { CSSProperties } from "react";
import type { z } from "zod";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
const surface: CSSProperties = { color: "var(--foreground)", backgroundColor: "var(--card)", padding: "var(--space-4)", borderRadius: "var(--radius)" };
export function Card({ title, description, content, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "Card", "default");
  return <article ref={root} style={surface}><h2>{title}</h2>{state === "loading" ? <p aria-busy="true">Loading</p> : state === "error" ? <p role="alert">Content could not be loaded</p> : state === "empty" ? <p>No content</p> : <>{description && <p>{description}</p>}{content && <p>{content}</p>}</>}</article>;
}
