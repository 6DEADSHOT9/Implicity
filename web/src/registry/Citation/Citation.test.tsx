// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Citation } from "./Citation";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("Citation", () => {
  it("renders web links and opens memory ids through the callback", () => {
    for (const state of meta.galleryStates) {
      expect(propsSchema.safeParse(state.props).success).toBe(true);
      const view = render(<Citation {...state.props} />);
      if (state.props.source_type === "web") expect(screen.getByRole("link", { name: new RegExp(state.props.label) }).getAttribute("href")).toBe(state.props.source);
      view.unmount();
    }
    expect(propsSchema.safeParse({ label: "Source", source: "http://example.test", source_type: "web" }).success).toBe(false);
    expect(propsSchema.safeParse({ label: "Memory", source: "not-a-uuid", source_type: "memory" }).success).toBe(false);
    const onOpenMemory = vi.fn();
    render(<Citation label="Writing preference" source="3f2504e0-4f89-41d3-9a0c-0305e82c3301" source_type="memory" onOpenMemory={onOpenMemory} />);
    fireEvent.click(screen.getByRole("button", { name: "Writing preference" }));
    expect(onOpenMemory).toHaveBeenCalledWith("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  });
});
