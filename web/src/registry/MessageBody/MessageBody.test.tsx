// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture } from "../capture";
import { MessageBody } from "./MessageBody";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("MessageBody", () => {
  it("renders gallery content and validates its public props", () => {
    const state = meta.galleryStates[0];
    expect(propsSchema.safeParse(state.props).success).toBe(true);
    render(<MessageBody {...state.props} />);
    expect(screen.getByRole("article", { name: "Message" })).toBeTruthy();
    expect(screen.getByText("useful detail")).toBeTruthy();
    expect(propsSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("renders fenced code and markdown tables with their registry skeletons", () => {
    render(<MessageBody content={'```python\nprint("hello")\n```\n\n| Item | State |\n| --- | --- |\n| Chat | Ready |'} />);
    expect(screen.getByText(/python · code/)).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("Chat")).toBeTruthy();
  });

  it("folds long answers at whole Markdown blocks and expands the long_answer slot", () => {
    const list = `- First item ${"a".repeat(610)}\n- Second item`;
    const code = `\n\n\`\`\`python\n${'print("long")\n'.repeat(70)}\`\`\``;
    const table = `\n\n| Item | State |\n| --- | --- |\n${Array.from({ length: 50 }, (_, index) => `| ${"cell".repeat(5)} ${index} | Ready |`).join("\n")}`;
    const capture = recordingCapture();
    render(<CaptureProvider sink={capture.sink}><MessageBody content={`${list}${code}${table}`} /></CaptureProvider>);

    const slot = screen.getByRole("region", { name: "Long answer" });
    expect(slot.getAttribute("data-state")).toBe("folded");
    expect(slot.textContent).toContain("Second item");
    expect(slot.textContent).not.toContain('print("long")');
    expect(slot.querySelector("table")).toBeNull();
    expect(capture.events).toContainEqual({ name: "component_shown", component: "MessageBody", default_state: "folded", slot: "long_answer" });
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(slot.getAttribute("data-state")).toBe("open");
    expect(slot.textContent).toContain('print("long")');
    expect(screen.getByRole("table")).toBeTruthy();
    expect(capture.events).toContainEqual({ name: "section_expanded", component: "MessageBody", slot: "long_answer" });
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(slot.getAttribute("data-state")).toBe("folded");
    expect(capture.events).toContainEqual({ name: "section_collapsed", component: "MessageBody", slot: "long_answer" });
  });

  it("keeps a live long answer open when streaming ends", () => {
    const content = `First block. ${"a".repeat(1300)}\n\nSecond block. ${"b".repeat(1300)}`;
    const view = render(<MessageBody content={content} streaming />);
    expect(screen.getByRole("region", { name: "Long answer" }).getAttribute("data-state")).toBe("open");
    view.rerender(<MessageBody content={content} streaming={false} />);
    expect(screen.getByRole("region", { name: "Long answer" }).getAttribute("data-state")).toBe("open");
  });

  it("keeps a newly received answer open when the stream finishes before its first render", () => {
    const content = `First block. ${"a".repeat(1300)}\n\nSecond block. ${"b".repeat(1300)}`;
    render(<MessageBody content={content} initiallyOpen />);
    expect(screen.getByRole("region", { name: "Long answer" }).getAttribute("data-state")).toBe("open");
  });

  it("reports a live long answer as seen in the open state", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        Object.defineProperty(target, "checkVisibility", { configurable: true, value: () => true });
        this.callback([{ target, isIntersecting: true, intersectionRatio: 1, time: performance.now() } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    });
    const capture = recordingCapture();
    render(<CaptureProvider sink={capture.sink}><MessageBody content={`A. ${"a".repeat(2600)}`} streaming /></CaptureProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(capture.events).toContainEqual({ name: "component_seen", component: "MessageBody", default_state: "open", slot: "long_answer", seconds_visible: 3 });
  });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
