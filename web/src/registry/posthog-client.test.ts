// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { gunzipSync } from "node:zlib";
import { createPostHogCapture, postHogOptions, type CaptureRegistry } from "./capture";

const registry: CaptureRegistry = { version: 7, entries: new Map() };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("PostHog transport", () => {
  it("sends one sanitized SDK event with transport keys on the SDK /e/ path", async () => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" });
    Object.defineProperty(navigator, "webdriver", { configurable: true, value: false });
    Object.defineProperty(navigator, "userAgentData", { configurable: true, value: undefined });
    const requests: Array<{ url: string; body: BodyInit | null | undefined }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), body: init?.body });
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }));
    const options = { ...postHogOptions("http://posthog.test"), disable_compression: true };
    expect(options).toMatchObject({ autocapture: false, capture_pageview: false, capture_pageleave: false, advanced_disable_flags: true, disable_external_dependency_loading: true });
    const capture = createPostHogCapture({ session_id: "123e4567-e89b-42d3-a456-426614174000", layout_version: 1 }, registry, { has: () => false }, { apiKey: "test-project-token", apiHost: "http://posthog.test" });
    expect(capture({ name: "search_used" })).toBe(true);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].url).toContain("http://posthog.test/e/");
    const body = requests[0].body instanceof ArrayBuffer ? gunzipSync(new Uint8Array(requests[0].body)).toString("utf8") : String(requests[0].body);
    expect(body).toContain("test-project-token");
    expect(body).toContain("distinct_id");
    expect(body).toContain("search_used");
    expect(body).not.toContain("$current_url");
    expect(body).not.toContain("$set_once");
    expect(requests.some(({ url }) => /\/array\/|\/flags\//.test(url))).toBe(false);
  });
});
