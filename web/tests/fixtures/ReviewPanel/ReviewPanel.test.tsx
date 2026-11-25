import { describe, expect, it } from "vitest";
import { propsSchema, slotsSchema } from "./schema";

describe("ReviewPanel fixture schema", () => {
  it("requires the declared slot payload after T3 normalization", () => {
    expect(propsSchema.safeParse({ count: 1 }).success).toBe(true);
    expect(slotsSchema.safeParse({}).success).toBe(false);
    expect(slotsSchema.safeParse({ main: [] }).success).toBe(true);
    expect(slotsSchema.safeParse({ main: ["Child"] }).success).toBe(false);
  });
});
