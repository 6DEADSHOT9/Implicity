import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

describe("engine demo", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("runs the engine and sends Keep through the State API", async () => {
    let adapted = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith("/state")) {
        return Response.json({ kind: "coding", values: { long_answers: adapted ? "open" : "folded" } });
      }
      if (path === "/notices") return Response.json(adapted ? [{ id: "dec_1", dimension: "long_answers", from_: "folded", to: "open", reason: "Evidence qualified." }] : []);
      if (path === "/demo/session") { adapted = true; return Response.json({ status: "admitted" }); }
      if (path === "/notices/dec_1/shown") return new Response(null, { status: 204 });
      if (path === "/decisions/dec_1/keep") return Response.json({ status: "admitted" });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Run next session" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep" }).getAttribute("disabled")).toBeNull());
    fireEvent.click(await screen.findByRole("button", { name: "Keep" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/decisions/dec_1/keep", { method: "POST" }));
    expect(await screen.findByText("open")).toBeTruthy();
  });
});
