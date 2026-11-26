import type { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function Metric({ label, value, progress, context, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "Metric", state);
  return <Card ref={root} aria-label={label}>{state === "loading" ? <CardContent><p aria-busy="true">Loading metric</p></CardContent> : state === "error" ? <CardContent><p role="alert">Metric could not be loaded</p></CardContent> : <><CardHeader><CardTitle className="text-heading-4">{label}</CardTitle></CardHeader><CardContent className="space-y-space-2"><p className="text-heading-2">{state === "empty" ? "—" : <data value={value}>{value}</data>}</p>{context && <p className="text-muted-foreground">{context}</p>}{state !== "empty" && progress && <Progress aria-label={`${label} progress`} value={progress.value} max={progress.max} />}</CardContent></>}</Card>;
}
