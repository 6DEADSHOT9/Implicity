import { describe, expect, it } from "vitest";
import { propsSchema, schema } from "./schema";

describe("TextBlock Skeleton schema", () => {
  it("accepts only its declared props and slots", () => {
    expect(propsSchema.safeParse({ text: "Hello" }).success).toBe(true);
    expect(propsSchema.safeParse({ text: 1 }).success).toBe(false);
    expect(schema.safeParse({ props: { text: "Hello" }, slots: {} }).success).toBe(true);
    expect(schema.safeParse({ props: { text: "Hello" }, slots: { extra: [] } }).success).toBe(false);
  });
});
