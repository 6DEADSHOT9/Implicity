import type { CapturedEvent } from "../../src/registry";

declare global {
  interface Window {
    shellInteractionEvents: CapturedEvent[];
    shellSearchQueries: string[];
    mountShellInteractions(): void;
  }
}

export {};
