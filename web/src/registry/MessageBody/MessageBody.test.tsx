// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
