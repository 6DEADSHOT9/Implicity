// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture } from "../capture";
import { MessageActions } from "./MessageActions";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("MessageActions", () => {
  it("calls control callbacks and records only the displayed form change", async () => {
    const user = userEvent.setup(); const recorder = recordingCapture(); const onCopy = vi.fn(); const onRegenerate = vi.fn(); const onAnswerFormChange = vi.fn(); const onFeedback = vi.fn(); const onVersionChange = vi.fn(); const onRemember = vi.fn();
    const view = render(<CaptureProvider sink={recorder.sink}><MessageActions answer_form="prose" version_index={2} version_count={3} onCopy={onCopy} onRegenerate={onRegenerate} onAnswerFormChange={onAnswerFormChange} onFeedback={onFeedback} onVersionChange={onVersionChange} onRemember={onRemember} /></CaptureProvider>);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    await user.click(screen.getByRole("button", { name: "Helpful" }));
    await user.click(screen.getByRole("button", { name: "Not helpful" }));
    await user.click(screen.getByRole("button", { name: "Previous version" }));
    await user.click(screen.getByRole("button", { name: "Next version" }));
    await user.click(screen.getByRole("button", { name: "Remember this" }));
    await user.click(screen.getByRole("button", { name: "Table" }));
    expect(onCopy).toHaveBeenCalledOnce();
    expect(onRegenerate).toHaveBeenCalledOnce();
    expect(onFeedback.mock.calls).toEqual([["positive"], ["negative"]]);
    expect(onVersionChange.mock.calls).toEqual([[1], [3]]);
    expect(onRemember).toHaveBeenCalledOnce();
    expect(onAnswerFormChange).toHaveBeenCalledWith("table");
    expect(recorder.events).toEqual([{ name: "component_shown", component: "MessageActions", default_state: "prose" }]);
    view.rerender(<CaptureProvider sink={recorder.sink}><MessageActions answer_form="table" version_index={2} version_count={3} /></CaptureProvider>);
    expect(recorder.events).toEqual([
      { name: "component_shown", component: "MessageActions", default_state: "prose" },
      { name: "representation_switched", dimension: "answer_form", from: "prose", to: "table" },
    ]);
    view.rerender(<CaptureProvider sink={recorder.sink}><MessageActions answer_form="table" version_index={2} version_count={3} /></CaptureProvider>);
    expect(recorder.events).toHaveLength(2);
    expect(propsSchema.safeParse(meta.galleryStates[0].props).success).toBe(true);
    expect(propsSchema.safeParse({ answer_form: "chart", version_index: 1, version_count: 1 }).success).toBe(false);
    expect(propsSchema.safeParse({ answer_form: "prose", version_index: 3, version_count: 2 }).success).toBe(false);
  });
});
