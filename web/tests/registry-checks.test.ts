import { describe, expect, it } from "vitest";
import { checkGeneratedFileSet, checkRegistrySnapshots } from "../src/registry/snapshot";
import { discoverRegistryFolders } from "../src/registry/discovery";
import { events } from "./fixtures/ReviewPanel/events";
import { meta } from "./fixtures/ReviewPanel/meta";
import { propsSchema, slotsSchema } from "./fixtures/ReviewPanel/schema";

describe("registry generation guards", () => {
  it("requires the current roster snapshot and highest snapshot version", () => {
    const current = { registry_version: 2, components: [] };
    expect(() => checkRegistrySnapshots([{ registry_version: 1, components: [] }, current], current)).not.toThrow();
    expect(() => checkRegistrySnapshots([{ registry_version: 1, components: [] }, current], { ...current, components: ["AppShell"] })).toThrow(/version 2 snapshot/);
    expect(() => checkRegistrySnapshots([{ registry_version: 1, components: [] }], current)).toThrow(/highest snapshot/);
    expect(() => checkRegistrySnapshots([{ registry_version: 1, components: [] }, current], { registry_version: 3, components: ["AppShell"] })).toThrow(/highest snapshot/);
  });

  it("rejects schema files left behind after removing registry entries", () => {
    expect(() => checkGeneratedFileSet(["registry.json"], ["registry.json", "TextBlock.schema.json"])).toThrow(/do not match the registry/);
  });

  it("shares folder and named-export validation for generation and loading", () => {
    const folder = {
      id: "ReviewPanel",
      files: ["ReviewPanel.tsx", "ReviewPanel.test.tsx", "schema.ts", "events.ts", "meta.ts"],
      componentExports: ["ReviewPanel"],
      schema: { propsSchema, slotsSchema },
      events: { events },
      metadata: { meta },
    };
    expect(discoverRegistryFolders([folder])).toHaveLength(1);
    expect(() => discoverRegistryFolders([{ ...folder, componentExports: ["default"] }])).toThrow(/ReviewPanel.*named component export/);
    expect(() => discoverRegistryFolders([{ ...folder, files: ["ReviewPanel.tsx"] }])).toThrow(/ReviewPanel.*missing/);
  });
});
