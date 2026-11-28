// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture } from "../capture";
import { MessageBody } from "./MessageBody";
import actions from "../../../../contracts/actions.json";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

describe("MessageBody", () => {
  it("renders gallery content and validates its public props", () => {
    const state = meta.galleryStates[0];
    expect(propsSchema.safeParse(state.props).success).toBe(true);
    render(<MessageBody {...state.props} />);
    expect(screen.getByRole("article", { name: "Message" })).toBeTruthy();
    expect(screen.getByText("useful detail")).toBeTruthy();
    expect(propsSchema.safeParse({ content: "" }).success).toBe(false);
    expect(slotsSchema.safeParse({ long_answer: ["lead"] }).success).toBe(false);
  });

  it("renders fenced code and markdown tables with their registry skeletons", () => {
    const capture = recordingCapture();
    render(<CaptureProvider sink={capture.sink}><MessageBody content={'```python\nprint("hello")\n```\n\n| Item | State |\n| --- | --- |\n| Chat | Ready |'} /></CaptureProvider>);
    expect(screen.getByText(/python · code/)).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("Chat")).toBeTruthy();
    expect(capture.events.some(({ name, component }) => name === "component_shown" && component === "DataTable")).toBe(true);
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

  it("does not report streaming growth as an expansion, but reports each manual choice once", () => {
    const capture = recordingCapture();
    const view = render(<CaptureProvider sink={capture.sink}><MessageBody content="Short answer" streaming /></CaptureProvider>);
    view.rerender(<CaptureProvider sink={capture.sink}><MessageBody content={`Short answer ${"a".repeat(actions.length_cutoffs.answer.long)}`} streaming /></CaptureProvider>);
    view.rerender(<CaptureProvider sink={capture.sink}><MessageBody content={`Short answer ${"a".repeat(actions.length_cutoffs.answer.long)}`} /></CaptureProvider>);
    expect(capture.events.filter(({ name }) => name === "section_expanded" || name === "section_collapsed")).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(capture.events.filter(({ name }) => name === "section_collapsed")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(capture.events.filter(({ name }) => name === "section_expanded")).toHaveLength(1);
  });

  it("keeps code blocks mounted across later message renders", () => {
    const capture = recordingCapture();
    const codeBlock = "```python\nprint(1)\n```";
    const view = render(<CaptureProvider sink={capture.sink}><MessageBody content={codeBlock} /></CaptureProvider>);
    const code = view.container.querySelector("pre");
    view.rerender(<CaptureProvider sink={capture.sink}><MessageBody content={`${codeBlock}\n\nMore text`} /></CaptureProvider>);
    expect(view.container.querySelector("pre")).toBe(code);
    expect(capture.events.filter(({ name, component }) => name === "component_shown" && component === "CodeBlock")).toHaveLength(1);
  });

  it("keeps rendered code and tables mounted when streaming crosses the long boundary", () => {
    const capture = recordingCapture();
    const prefix = "```python\nprint(1)\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n";
    const short = prefix + "x".repeat(actions.length_cutoffs.answer.long - 1 - prefix.length);
    const view = render(<CaptureProvider sink={capture.sink}><MessageBody content={short} streaming /></CaptureProvider>);
    const code = view.container.querySelector("pre");
    const table = view.container.querySelector("table");
    view.rerender(<CaptureProvider sink={capture.sink}><MessageBody content={`${short}x`} streaming /></CaptureProvider>);
    view.rerender(<CaptureProvider sink={capture.sink}><MessageBody content={`${short}x`} /></CaptureProvider>);
    expect(view.container.querySelector("pre")).toBe(code);
    expect(view.container.querySelector("table")).toBe(table);
    for (const component of ["CodeBlock", "DataTable"]) {
      expect(capture.events.filter((event) => event.name === "component_shown" && event.component === component)).toHaveLength(1);
    }
    expect(capture.events.filter((event) => event.name === "section_expanded" || event.name === "section_collapsed")).toEqual([]);
  });

  it("uses the shared long-answer boundary", () => {
    const cutoff = actions.length_cutoffs.answer.long;
    const view = render(<MessageBody content={"x".repeat(cutoff - 1)} />);
    expect(screen.queryByRole("region", { name: "Long answer" })).toBeNull();
    view.rerender(<MessageBody content={"x".repeat(cutoff)} />);
    expect(screen.getByRole("region", { name: "Long answer" })).toBeTruthy();
  });

  it("uses a changed action cutoff instead of a matching literal", () => {
    const original = actions.length_cutoffs.answer.long;
    actions.length_cutoffs.answer.long = 17;
    try {
      const view = render(<MessageBody content={"x".repeat(16)} />);
      expect(screen.queryByRole("region", { name: "Long answer" })).toBeNull();
      view.rerender(<MessageBody content={"x".repeat(17)} />);
      expect(screen.getByRole("region", { name: "Long answer" })).toBeTruthy();
    } finally {
      actions.length_cutoffs.answer.long = original;
    }
  });

  it("folds at the shared 600-character lead limit and stops at 601", () => {
    const leadLimit = actions.length_cutoffs.answer.medium;
    const renderAt = (total: number) => {
      const firstLength = Math.floor((total - 2) / 2);
      const secondLength = total - 2 - firstLength;
      return `a${"a".repeat(firstLength - 1)}\n\n${"b".repeat(secondLength)}\n\n${"c".repeat(actions.length_cutoffs.answer.long)}`;
    };
    const exact = render(<MessageBody content={renderAt(leadLimit)} />);
    expect(screen.getByRole("region", { name: "Long answer" }).textContent).toContain("b".repeat(Math.floor((leadLimit - 2) / 2)));
    exact.rerender(<MessageBody content={renderAt(leadLimit + 1)} />);
    const slot = screen.getByRole("region", { name: "Long answer" });
    expect(slot.textContent).not.toContain("b".repeat(Math.ceil((leadLimit + 1 - 2) / 2)));
  });

  it("keeps reference links usable in a folded lead when definitions are outside it", () => {
    const content = `[source][1]\n\n${"x".repeat(610)}\n\n[1]: https://example.test/source`;
    render(<MessageBody content={content} />);
    expect(screen.getByRole("link", { name: "source" }).getAttribute("href")).toBe("https://example.test/source");
  });

  it("does not count a reference definition as the folded lead", () => {
    const content = `[1]: https://example.test/source\n\n[one][1]\n\n${"x".repeat(actions.length_cutoffs.answer.long)}`;
    render(<MessageBody content={content} />);
    expect(screen.getByRole("link", { name: "one" }).getAttribute("href")).toBe("https://example.test/source");
  });

  it("lets short assistant answers fill their message column", () => {
    const view = render(<MessageBody content="A short answer." />);
    expect(view.container.querySelector(".is-assistant > div")?.className).toContain("w-full");
  });

  it("renders markdown formatting inside table cells and blocks unsafe images", () => {
    render(<MessageBody content={'| Value |\n| --- |\n| [source](https://example.test "title") `code` **bold** ![alt](http://example.test/image.png) |'} />);
    const link = screen.getByRole("link", { name: "source" });
    expect(link.getAttribute("href")).toBe("https://example.test/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(screen.getByText("bold").getAttribute("data-streamdown")).toBe("strong");
    expect(screen.getByRole("img", { name: /alt.*example\.test/ })).toBeTruthy();
    expect(screen.getByText("bold").closest("td")?.className).toContain("whitespace-normal");
  });

  it("preserves rich Markdown in table headers and wraps long headers and cells", () => {
    render(<MessageBody content={'| [Header link](https://example.test "title") `code` **bold** ![alt](http://example.test/image.png) long header text |\n| --- |\n| [Body link](https://example.test/body) `body-code` **body-bold** and a long body sentence |'} />);
    const header = screen.getByRole("columnheader");
    const headerLink = header.querySelector("a");
    expect(headerLink?.getAttribute("href")).toBe("https://example.test/");
    expect(headerLink?.getAttribute("rel")).toBe("noreferrer");
    expect(header.querySelector("code")?.textContent).toBe("code");
    expect(header.querySelector('[data-streamdown="strong"]')?.textContent).toBe("bold");
    expect(screen.getByRole("img", { name: /alt.*example\.test/ })).toBeTruthy();
    expect(header.className).toContain("whitespace-normal");
    expect(screen.getByRole("cell").className).toContain("whitespace-normal");
  });

  it("renders header-only Markdown tables through DataTable", async () => {
    const { container } = render(<MessageBody content={`| Name | Value |
| --- | --- |`} />);
    await screen.findByRole("columnheader", { name: "Name" });
    expect(Array.from(container.querySelectorAll("thead th"), (cell) => cell.textContent)).toEqual(["Name", "Value"]);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
    expect(container.textContent).not.toContain("No data");
  });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
