import type { CapturedEvent } from "../../src/registry";

declare global {
  interface Window {
    shellSeenEvents: CapturedEvent[];
    mountShellSeen(): void;
  }
}

export {};
