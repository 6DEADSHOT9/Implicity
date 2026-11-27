// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApprovalRequest } from "./ApprovalRequest";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("ApprovalRequest", () => {
  it("renders all states and leaves decisions to callbacks", async () => {
    for (const state of meta.galleryStates) { expect(propsSchema.safeParse(state.props).success).toBe(true); const view = render(<ApprovalRequest {...state.props} />); expect(screen.getByRole("region", { name: state.props.title })).toBeTruthy(); view.unmount(); }
    const onApprove = vi.fn(); const onEdit = vi.fn(); const onDeny = vi.fn(); const user = userEvent.setup();
    render(<ApprovalRequest title="Approve?" detail="Details" state="pending" onApprove={onApprove} onEdit={onEdit} onDeny={onDeny} />);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Deny" }));
    expect(onApprove).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDeny).toHaveBeenCalledOnce();
    expect(propsSchema.safeParse({ title: "x", detail: "y", state: "waiting" }).success).toBe(false);
  });
});
