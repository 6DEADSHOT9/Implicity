// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunActivity } from "./RunActivity";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("RunActivity", () => {
  it("renders gallery states and validates step status", () => {
    for (const state of meta.galleryStates) { expect(propsSchema.safeParse(state.props).success).toBe(true); const view = render(<RunActivity {...state.props} />); expect(screen.getByRole("button", { name: /Run activity/ })).toBeTruthy(); view.unmount(); }
    expect(propsSchema.safeParse({ title: "Run", steps: [{ label: "Step", status: "unknown" }], open: true }).success).toBe(false);
  });
});
