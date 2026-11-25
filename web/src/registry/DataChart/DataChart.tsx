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
  const root = useSkeletonCapture(capture, "DataChart", state === "default" ? chartType : state);
  const data = useMemo(() => labels.map((label, index) => ({ label, value: values[index] })), [labels, values]);
  const axes = <>
    <CartesianGrid stroke={token("--border")} strokeDasharray={token("--border-width")} />
    <XAxis dataKey="label" stroke={token("--muted-foreground")} axisLine={{ stroke: token("--border"), strokeWidth: 1 }} tickLine={{ stroke: token("--border"), strokeWidth: 1 }} tickSize={8} tick={{ fill: token("--muted-foreground"), fontSize: token("--text-sm"), fontFamily: token("--font-body") }} />
    <YAxis width={32} stroke={token("--muted-foreground")} axisLine={{ stroke: token("--border"), strokeWidth: 1 }} tickLine={{ stroke: token("--border"), strokeWidth: 1 }} tickSize={8} tick={{ fill: token("--muted-foreground"), fontSize: token("--text-sm"), fontFamily: token("--font-body") }} />
    <Tooltip cursor={{ fill: token("--muted"), stroke: token("--border"), strokeWidth: 1 }} contentStyle={{ backgroundColor: token("--popover"), color: token("--popover-foreground"), borderColor: token("--border"), borderRadius: token("--radius"), borderWidth: token("--border-width"), padding: token("--space-3") }} itemStyle={{ color: token("--popover-foreground"), padding: token("--space-1"), fontFamily: token("--font-body") }} />
  </>;
  const plot = chartType === "line"
    ? <LineChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>{axes}<Line dataKey="value" stroke={token("--chart-1")} strokeWidth={token("--border-width")} dot={{ fill: token("--chart-1"), stroke: token("--chart-1"), strokeWidth: 1, r: 3 }} activeDot={{ fill: token("--chart-1"), stroke: token("--foreground"), strokeWidth: 1, r: 4 }} /></LineChart>
    : <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>{axes}<Bar dataKey="value" fill={token("--chart-1")} activeBar={{ fill: token("--chart-1"), stroke: token("--foreground"), strokeWidth: 1 }} /></BarChart>;

  return <Card ref={root}>
    <CardHeader><CardTitle className="text-heading-4">{title}</CardTitle></CardHeader>
    <CardContent>
      {state === "loading" ? <p aria-busy="true">Loading chart</p>
        : state === "error" ? <p role="alert">Chart could not be loaded</p>
          : state === "empty" || !data.length ? <p>No data</p>
            : <>
              <div role="img" aria-label={title} className="w-full" style={{ height: token("--content-max-height") }}>
                <ResponsiveContainer width="100%" height="100%">{plot}</ResponsiveContainer>
              </div>
              <ul className="visually-hidden">{data.map(({ label, value }) => <li key={label}>{label}: {value}</li>)}</ul>
            </>}
    </CardContent>
  </Card>;
}
