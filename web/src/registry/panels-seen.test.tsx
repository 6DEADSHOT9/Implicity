// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DockedPanel } from "./DockedPanel/DockedPanel";
import { meta as dockedMeta } from "./DockedPanel/meta";
import { ProjectPanel } from "./ProjectPanel/ProjectPanel";
import { meta as projectMeta } from "./ProjectPanel/meta";
import { recordingCapture, CaptureProvider } from "./capture";
import { SourcesPanel } from "./SourcesPanel/SourcesPanel";
import { meta as sourcesMeta } from "./SourcesPanel/meta";
import { enterSeenTarget, installVisibleIntersectionObserver, passSeenInterval } from "./panel-seen-test-utils";

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));

beforeEach(() => {
  vi.useFakeTimers();
  installVisibleIntersectionObserver();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  mobile.value = false;
});

async function expectSeen(target: Element, capture: ReturnType<typeof recordingCapture>, component: string, defaultState: string) {
  enterSeenTarget(target);
  await passSeenInterval();
  expect(capture.events.filter(({ name }) => name === "component_seen")).toEqual([
    expect.objectContaining({ name: "component_seen", component, default_state: defaultState, seconds_visible: 3 }),
  ]);
}

describe("panel useSeen wiring", () => {
  it("measures ProjectPanel", async () => {
    const capture = recordingCapture();
    render(<CaptureProvider sink={capture.sink}><ProjectPanel {...projectMeta.galleryStates[0].props} /></CaptureProvider>);
    await expectSeen(screen.getByRole("region", { name: "Project" }), capture, "ProjectPanel", "decisions");
  });

  it("measures SourcesPanel", async () => {
    const capture = recordingCapture();
    render(<CaptureProvider sink={capture.sink}><SourcesPanel {...sourcesMeta.galleryStates[0].props} /></CaptureProvider>);
    await expectSeen(screen.getByRole("region", { name: "Sources" }), capture, "SourcesPanel", "docked");
  });

  it.each([
    ["docked pane", false, dockedMeta.galleryStates[0].props, "region", "open_docked"],
    ["open Sheet", true, dockedMeta.galleryStates[0].props, "dialog", "open_undocked"],
    ["closed trigger", true, dockedMeta.galleryStates[2].props, "button", "closed"],
  ] as const)("measures DockedPanel's %s", async (_label, isMobile, props, role, defaultState) => {
    mobile.value = isMobile;
    const capture = recordingCapture();
    render(<CaptureProvider sink={capture.sink}><DockedPanel {...props} /></CaptureProvider>);
    const target = role === "region"
      ? screen.getByRole("region", { name: "Workspace" })
      : role === "dialog"
        ? screen.getByRole("dialog", { name: "Workspace" })
        : screen.getByRole("button", { name: "Open Workspace" });
    await expectSeen(target, capture, "DockedPanel", defaultState);
  });

  it("stops measuring the pane when it closes", async () => {
    const capture = recordingCapture();
    const view = render(<CaptureProvider sink={capture.sink}><DockedPanel {...dockedMeta.galleryStates[0].props} /></CaptureProvider>);
    const panel = screen.getByRole("region", { name: "Workspace" });
    enterSeenTarget(panel);
    await vi.advanceTimersByTimeAsync(1000);
    view.rerender(<CaptureProvider sink={capture.sink}><DockedPanel {...dockedMeta.galleryStates[0].props} open={false} /></CaptureProvider>);
    await passSeenInterval();
    expect(capture.events.some(({ name }) => name === "component_seen")).toBe(false);
  });
});
