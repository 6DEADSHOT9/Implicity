import type { CSSProperties } from "react";
import type { z } from "zod";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
const surface: CSSProperties = { color: "var(--foreground)", backgroundColor: "var(--card)", padding: "var(--space-4)", borderRadius: "var(--radius)" };
export function CodeBlock({ code, language, variant, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "CodeBlock", "default");
  return <figure ref={root} style={surface}>{state === "error" ? <p role="alert">Code could not be loaded</p> : <><figcaption>{language} · {variant}</figcaption><pre tabIndex={0} aria-label={`${language} ${variant}`}><code>{state === "empty" ? "" : code}</code></pre></>}</figure>;
}
