import type { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function ArtifactWorkspace({ title, content, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "ArtifactWorkspace", "default");
  return <Card ref={root} aria-label={title}><CardHeader><CardTitle className="text-heading-4">{title}</CardTitle></CardHeader><CardContent>{state === "loading" ? <p aria-busy="true">Loading document</p> : state === "error" ? <p role="alert">Document could not be loaded</p> : state === "empty" ? <p>No content</p> : <ScrollArea className="max-h-content-height">{content}</ScrollArea>}</CardContent></Card>;
}
