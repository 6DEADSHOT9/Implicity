import type { CapturedEvent } from "../../src/registry";

declare global {
  interface Window {
    seenEvents: CapturedEvent[];
    seenTest: { replaceTarget(): void; toggleMount(): void };
  }
}

export {};
