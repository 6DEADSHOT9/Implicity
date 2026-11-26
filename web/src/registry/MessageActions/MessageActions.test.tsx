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
    const user = userEvent.setup(); const recorder = recordingCapture(); const onCopy = vi.fn(); const onAnswerFormChange = vi.fn();
    const view = render(<CaptureProvider sink={recorder.sink}><MessageActions answer_form="prose" onCopy={onCopy} onAnswerFormChange={onAnswerFormChange} /></CaptureProvider>);
    await user.click(screen.getByRole("button", { name: "Copy" })); await user.click(screen.getByRole("button", { name: "table" })); expect(onCopy).toHaveBeenCalledOnce(); expect(onAnswerFormChange).toHaveBeenCalledWith("table");
    view.rerender(<CaptureProvider sink={recorder.sink}><MessageActions answer_form="table" /></CaptureProvider>);
    expect(recorder.events).toContainEqual({ name: "representation_switched", dimension: "answer_form", from: "prose", to: "table" });
    expect(propsSchema.safeParse(meta.galleryStates[0].props).success).toBe(true); expect(propsSchema.safeParse({ answer_form: "chart" }).success).toBe(false);
  });
});
