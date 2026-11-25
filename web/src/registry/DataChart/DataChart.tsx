import { useMemo } from "react";
import type { z } from "zod";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { token } from "../token";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function DataChart({ title, labels, values, chartType, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "DataChart", "default");
  const data = useMemo(() => labels.map((label, index) => ({ label, value: values[index] ?? 0 })), [labels, values]);
  return <Card ref={root}><CardHeader><CardTitle className="text-heading-4">{title}</CardTitle></CardHeader><CardContent>{state === "loading" ? <p aria-busy="true">Loading chart</p> : state === "error" ? <p role="alert">Chart could not be loaded</p> : state === "empty" || !data.length ? <p>No data</p> : <div role="img" aria-label={title} className="w-full" style={{ height: token("--content-max-height") }}><ResponsiveContainer width="100%" height="100%">{chartType === "line" ? <LineChart data={data}><CartesianGrid stroke={token("--border")} /><XAxis dataKey="label" stroke={token("--muted-foreground")} /><YAxis stroke={token("--muted-foreground")} /><Tooltip contentStyle={{ backgroundColor: token("--popover"), color: token("--popover-foreground"), borderColor: token("--border") }} /><Line dataKey="value" stroke={token("--chart-1")} /></LineChart> : <BarChart data={data}><CartesianGrid stroke={token("--border")} /><XAxis dataKey="label" stroke={token("--muted-foreground")} /><YAxis stroke={token("--muted-foreground")} /><Tooltip contentStyle={{ backgroundColor: token("--popover"), color: token("--popover-foreground"), borderColor: token("--border") }} /><Bar dataKey="value" fill={token("--chart-1")} /></BarChart>}</ResponsiveContainer></div>}</CardContent></Card>;
}
