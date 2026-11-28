import type { CapturedEvent } from "../../src/registry";

declare global {
  interface Window {
    shellSeenEvents: CapturedEvent[];
    shellSeenAt: number[];
    shellMountedAt: number;
    mountShellSeen(): void;
  }
}

export {};
