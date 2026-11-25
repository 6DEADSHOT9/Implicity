import type { z } from "zod";
import { Card as CardPrimitive, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function Card({ title, description, content, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "Card", "default");
  return <CardPrimitive ref={root}><CardHeader><CardTitle className="text-heading-4">{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader><CardContent>{state === "loading" ? <div className="space-y-space-2" aria-busy="true"><Skeleton className="h-space-4 w-3/4" /><Skeleton className="h-space-4 w-1/2" /></div> : state === "error" ? <p role="alert">Content could not be loaded</p> : state === "empty" ? <Empty><EmptyHeader><EmptyTitle>No content</EmptyTitle><EmptyDescription>This card has no content yet.</EmptyDescription></EmptyHeader></Empty> : content}</CardContent></CardPrimitive>;
}
