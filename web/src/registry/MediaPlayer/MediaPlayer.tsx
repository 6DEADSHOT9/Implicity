import type { z } from "zod";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function MediaPlayer({ title, mediaType, sourceKind, source, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "MediaPlayer", "default");
  return <Card ref={root}><CardHeader><CardTitle className="text-heading-4">{title}</CardTitle></CardHeader><CardContent>{state === "loading" ? <p aria-busy="true">Loading media</p> : state === "error" ? <p role="alert">Media could not be loaded</p> : state === "empty" ? <p>No media available</p> : <div className="space-y-space-3"><AspectRatio ratio={mediaType === "video" ? 16 / 9 : 4 / 1} className="grid place-items-center overflow-hidden rounded-md bg-muted"><p role="img" aria-label={`${sourceKind === "youtube" ? "YouTube" : "Attached file"} ${mediaType} preview`}>{sourceKind === "youtube" ? "YouTube video" : `Attached ${mediaType}`}{source ? ` · ${new URL(source).hostname}` : ""}</p></AspectRatio><div className="flex items-center gap-space-3" aria-label={`${title} playback controls`}><Button size="icon" variant="outline" disabled aria-label="Play">▶</Button><Slider aria-label="Playback position" disabled value={[0]} max={100} /><span>0:00</span></div></div>}</CardContent></Card>;
}
