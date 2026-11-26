import { useId, type HTMLAttributes, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "cn";

export type ChartConfig = Record<string, { label?: string; color: string }>;
export function ChartContainer({ children, className, config, "aria-label": ariaLabel, ...props }: Omit<HTMLAttributes<HTMLDivElement>, "style"> & { children: ReactNode; config: ChartConfig }) {
  const id = `chart-${useId().replaceAll(":", "")}`;
  const colors = Object.entries(config).map(([key, value]) => `--color-${key}:${value.color};`).join("");
  return <div data-slot="chart" data-chart={id} role="img" aria-label={ariaLabel} className={cn("relative w-full", className)} {...props}><style>{`[data-chart="${id}"]{${colors}}`}</style><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}
