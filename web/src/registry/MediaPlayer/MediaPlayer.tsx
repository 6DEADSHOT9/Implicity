import type { CSSProperties } from "react";
import type { z } from "zod";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
const surface: CSSProperties = { color: "var(--foreground)", backgroundColor: "var(--card)", padding: "var(--space-4)", borderRadius: "var(--radius)" };
export function MediaPlayer({ title, mediaType, source, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "MediaPlayer", "default");
  const mediaProps = { controls: true, preload: "none" as const, "aria-label": title, style: { width: "auto", minHeight: "var(--media-control-size)" } };
  return <figure ref={root} style={surface}><figcaption>{title}</figcaption>{state === "loading" ? <p aria-busy="true">Loading media</p> : state === "error" ? <p role="alert">Media could not be loaded</p> : state === "empty" ? <p>No media available</p> : mediaType === "audio" ? <audio {...mediaProps}>{source && <source src={source} />}</audio> : <video {...mediaProps}>{source && <source src={source} />}</video>}</figure>;
}
