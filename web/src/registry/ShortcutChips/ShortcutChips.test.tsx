// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShortcutChips } from "./ShortcutChips";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("ShortcutChips", () => {
  it("renders labeled commands and passes the stable id to its callback", async () => {
    expect(propsSchema.safeParse(meta.galleryStates[0].props).success).toBe(true); const onCommand = vi.fn(); const user = userEvent.setup();
    render(<ShortcutChips {...meta.galleryStates[0].props} onCommand={onCommand} />); await user.click(screen.getByRole("button", { name: "Copy answer" })); expect(onCommand).toHaveBeenCalledWith("copy_answer");
    expect(propsSchema.safeParse({ commands: [{ id: "not valid", label: "Try" }] }).success).toBe(false);
    expect(propsSchema.safeParse({ commands: [{ id: "try", label: "Try" }, { id: "try", label: "Try again" }] }).success).toBe(false);
    expect(propsSchema.safeParse({ commands: [{ id: "cmd_my-secret-project", label: "Try" }] }).success).toBe(false);
    expect(propsSchema.safeParse({ commands: [{ id: "cmd_123", label: "Try" }] }).success).toBe(false);
    expect(propsSchema.safeParse({ commands: [{ id: "cmd_123e4567-e89b-42d3-a456-426614174000", label: "App command" }] }).success).toBe(true);
  });
});
