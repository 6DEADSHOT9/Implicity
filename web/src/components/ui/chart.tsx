import type { HTMLAttributes, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "cn";

export function ChartContainer({ children, className, "aria-label": ariaLabel, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div role="img" aria-label={ariaLabel} className={cn("w-full", className)} {...props}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}
