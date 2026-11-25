import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaptureProvider, recordingCapture, useCapture } from "../src/registry";

function Probe() {
  const { emit } = useCapture<"component_shown">();
  emit("component_shown", { component: "Probe", default_state: "open" });
  return null;
}

describe("capture context", () => {
  it("delivers a declared event to the provider's sink without shared fields", () => {
    const recorder = recordingCapture();
    renderToStaticMarkup(<CaptureProvider sink={recorder.sink}><Probe /></CaptureProvider>);
    expect(recorder.events).toEqual([{ name: "component_shown", component: "Probe", default_state: "open" }]);
  });

  it("does nothing without a provider", () => {
    expect(() => renderToStaticMarkup(<Probe />)).not.toThrow();
  });
});
