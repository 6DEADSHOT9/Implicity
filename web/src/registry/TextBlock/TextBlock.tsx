import type { ReactElement } from "react";
import type { z } from "zod";
import { propsSchema } from "./schema";

export type TextBlockProps = z.infer<typeof propsSchema>;

export function TextBlock({ text }: TextBlockProps): ReactElement {
  return <p style={{ color: "var(--foreground)" }}>{text}</p>;
}
