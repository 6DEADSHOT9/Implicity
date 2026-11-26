import { useMemo } from "react";
import type { z } from "zod";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { token } from "../token";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";

type Props = z.infer<typeof propsSchema>;
const tokenPixels = (name: string) => {
  if (typeof document === "undefined") return 1;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const number = Number.parseFloat(value);
  const pixels = value.endsWith("rem") ? number * Number.parseFloat(getComputedStyle(document.documentElement).fontSize) : number;
  return Number.isFinite(pixels) ? pixels : 1;
};

export function DataChart({ title, labels, values, chartType, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "DataChart", state === "default" ? chartType : state);
  const data = useMemo(() => labels.map((label, index) => ({ label, value: values[index] })), [labels, values]);
  const axes = <>
    <CartesianGrid stroke={token("--border")} strokeDasharray={token("--border-width")} />
    <XAxis dataKey="label" stroke={token("--muted-foreground")} axisLine={{ stroke: token("--border"), strokeWidth: token("--border-width") }} tickLine={{ stroke: token("--border"), strokeWidth: token("--border-width") }} tickSize={tokenPixels("--space-2")} tick={{ fill: token("--muted-foreground"), fontSize: token("--text-sm"), fontFamily: token("--font-body") }} />
    <YAxis width={tokenPixels("--attachment-thumbnail-size")} stroke={token("--muted-foreground")} axisLine={{ stroke: token("--border"), strokeWidth: tokenPixels("--border-width") }} tickLine={{ stroke: token("--border"), strokeWidth: tokenPixels("--border-width") }} tickSize={tokenPixels("--space-2")} tick={{ fill: token("--muted-foreground"), fontSize: token("--text-sm"), fontFamily: token("--font-body") }} />
    <Tooltip cursor={{ fill: token("--muted"), stroke: token("--border"), strokeWidth: token("--border-width") }} contentStyle={{ backgroundColor: token("--popover"), color: token("--popover-foreground"), borderColor: token("--border"), borderRadius: token("--radius"), borderWidth: token("--border-width"), padding: token("--space-3") }} itemStyle={{ color: token("--popover-foreground"), padding: token("--space-1"), fontFamily: token("--font-body") }} />
  </>;
  const plot = chartType === "line"
    ? <LineChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>{axes}<Line dataKey="value" stroke={token("--chart-1")} strokeWidth={tokenPixels("--border-width")} dot={{ fill: token("--chart-1"), stroke: token("--chart-1"), strokeWidth: tokenPixels("--border-width"), r: tokenPixels("--space-2") }} activeDot={{ fill: token("--chart-1"), stroke: token("--foreground"), strokeWidth: tokenPixels("--border-width"), r: tokenPixels("--space-3") }} /></LineChart>
    : <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>{axes}<Bar dataKey="value" fill={token("--chart-1")} activeBar={{ fill: token("--chart-1"), stroke: token("--foreground"), strokeWidth: token("--border-width") }} /></BarChart>;

  return <section ref={root} className="space-y-space-3">
    <h2 className="text-heading-4">{title}</h2>
      {state === "loading" ? <p aria-busy="true">Loading chart</p>
        : state === "error" ? <p role="alert">Chart could not be loaded</p>
          : state === "empty" || !data.length ? <p>No data</p>
            : <>
              <ChartContainer aria-label={title} style={{ height: token("--content-max-height") }}>{plot}</ChartContainer>
              <ul className="visually-hidden">{data.map(({ label, value }) => <li key={label}>{label}: {value}</li>)}</ul>
            </>}
  </section>;
}
