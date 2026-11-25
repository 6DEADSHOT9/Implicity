import type { z } from "zod";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function MediaPlayer({ title, mediaType, source, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "MediaPlayer", "default");
  const mediaProps = { controls: true, preload: "none" as const, "aria-label": title, className: "h-full w-full rounded-md object-contain" };
  return <Card ref={root}><CardHeader><CardTitle className="text-heading-4">{title}</CardTitle></CardHeader><CardContent>{state === "loading" ? <p aria-busy="true">Loading media</p> : state === "error" ? <p role="alert">Media could not be loaded</p> : state === "empty" ? <p>No media available</p> : <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-md bg-muted">{mediaType === "audio" ? <audio {...mediaProps}>{source && <source src={source} />}</audio> : <video {...mediaProps}>{source && <source src={source} />}</video>}</AspectRatio>}</CardContent></Card>;
}
