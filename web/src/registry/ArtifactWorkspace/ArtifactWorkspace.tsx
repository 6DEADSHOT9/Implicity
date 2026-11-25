import type { CSSProperties } from "react";
import type { z } from "zod";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
const surface: CSSProperties = { color: "var(--foreground)", backgroundColor: "var(--card)", padding: "var(--space-4)", borderRadius: "var(--radius)" };
export function ArtifactWorkspace({ title, content, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "ArtifactWorkspace", "default");
  return <article ref={root} aria-label={title} style={surface}><h2>{title}</h2>{state === "loading" ? <p aria-busy="true">Loading document</p> : state === "error" ? <p role="alert">Document could not be loaded</p> : state === "empty" ? <p>No content</p> : <div>{content}</div>}</article>;
}
