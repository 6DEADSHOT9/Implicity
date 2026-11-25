import { describe, expect, it } from "vitest";
import { propsSchema, slotsSchema } from "./schema";

describe("ReviewShell fixture schema", () => {
  it("allows its empty baseline slot", () => {
    expect(propsSchema.safeParse({}).success).toBe(true);
    expect(slotsSchema.safeParse({ main: [] }).success).toBe(true);
  });
});
