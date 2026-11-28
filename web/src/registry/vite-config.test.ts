import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { isFileLoadingAllowed, resolveConfig } from "vite";

describe("Vite development proxy", () => {
  it("uses the configured API destination and keeps host data outside the serving policy", async () => {
    const previousTarget = process.env.VITE_API_TARGET;
    try {
      delete process.env.VITE_API_TARGET;
      vi.resetModules();
      const defaultConfig = (await import("../../vite.config")).default;
      expect(defaultConfig.server.proxy["/api"]).toBe("http://127.0.0.1:8000");

      process.env.VITE_API_TARGET = "http://api-development:8000";
      vi.resetModules();
      const config = (await import("../../vite.config")).default;
      const resolved = await resolveConfig(config, "serve");
      expect(resolved.server.proxy?.["/api"]).toBe("http://api-development:8000");

      const webRoot = fileURLToPath(new URL("../../", import.meta.url));
      const workspaceRoot = resolve(webRoot, "..");
      expect(isFileLoadingAllowed(resolved, resolve(workspaceRoot, "data", "synthetic-host-backup.db"))).toBe(false);
      for (const path of [".env", ".env.local", "private.crt", "private.pem", "private.key", "private.p12", "private.pfx", "private.cer", "private.der", ".npmrc", ".yarnrc.yml", ".git/config", "data/backups/db.sqlite"]) {
        expect(isFileLoadingAllowed(resolved, resolve(workspaceRoot, path))).toBe(false);
      }
      expect(isFileLoadingAllowed(resolved, resolve(webRoot, "src", "chat-app.tsx"))).toBe(true);
      expect(isFileLoadingAllowed(resolved, resolve(workspaceRoot, "contracts", "actions.json"))).toBe(true);
    } finally {
      if (previousTarget === undefined) delete process.env.VITE_API_TARGET;
      else process.env.VITE_API_TARGET = previousTarget;
      vi.resetModules();
    }
  });
});
