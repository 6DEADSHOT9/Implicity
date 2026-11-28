import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangeNotice } from "../src";

describe("ChangeNotice", () => {
  it("offers Keep and Undo through its public callbacks", async () => {
    const onKeep = vi.fn();
    const onUndo = vi.fn();
    render(<ChangeNotice decision_id="dec_1" title="Long answers opened" reason="You often expand them." onKeep={onKeep} onUndo={onUndo} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Keep" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onKeep).toHaveBeenCalledOnce();
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("keeps Keep disabled until the host acknowledges the notice", async () => {
    let acknowledge!: () => void;
    const onShown = vi.fn(() => new Promise<void>((resolve) => { acknowledge = resolve; }));
    render(<ChangeNotice decision_id="dec_1" title="Long answers opened" reason="Evidence qualified." onShown={onShown} onKeep={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Keep" })).toBeDisabled();
    acknowledge();
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep" })).toBeEnabled());
  });
});
