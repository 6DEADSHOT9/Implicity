// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ContextChip } from "./ContextChip";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("ContextChip", () => {
  it("renders variants and calls its correction callback", async () => {
    for (const state of meta.galleryStates) { expect(propsSchema.safeParse(state.props).success).toBe(true); const view = render(<ContextChip {...state.props} />); expect(screen.getByText(state.props.detail)).toBeTruthy(); expect(screen.getByRole("note", { name: state.id === "long_content" ? "Remembered" : state.id[0].toUpperCase() + state.id.slice(1) })).toBeTruthy(); view.unmount(); }
    const onCorrect = vi.fn(); const user = userEvent.setup(); render(<ContextChip detail="Concise answers" kind="remembered" onCorrect={onCorrect} />); await user.click(screen.getByRole("button", { name: "Correct" })); expect(onCorrect).toHaveBeenCalledOnce();
    expect(propsSchema.safeParse({ label: "Remembered", detail: "x", kind: "set" }).success).toBe(false);
  });
});
