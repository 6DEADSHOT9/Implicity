// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { testBuiltinWidget } from "../BuiltinWidget.test-utils";
import { NowPlayingWidget } from "./NowPlayingWidget";

testBuiltinWidget("NowPlayingWidget");

describe("NowPlayingWidget", () => {
  it("shows playback progress only with content", () => {
    const { rerender } = render(<NowPlayingWidget progress={35} slots={{ content: ["Focus mix"] }} />);
    expect(screen.getByRole("progressbar", { name: "Playback progress" }).getAttribute("value")).toBe("35");
    rerender(<NowPlayingWidget progress={35} />);
    expect(screen.queryByRole("progressbar", { name: "Playback progress" })).toBeNull();
  });
});
