// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Citation } from "./Citation";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("Citation", () => {
  it("renders each source state as an accessible link and validates URLs", () => {
    for (const state of meta.galleryStates) { expect(propsSchema.safeParse(state.props).success).toBe(true); const view = render(<Citation {...state.props} />); expect(screen.getByRole("link", { name: new RegExp(state.props.label) })).toBeTruthy(); view.unmount(); }
    expect(propsSchema.safeParse({ label: "Source", url: "not a URL", source_type: "web" }).success).toBe(false);
    expect(propsSchema.safeParse({ label: "Source", url: "javascript:alert(1)", source_type: "web" }).success).toBe(false);
  });
});
