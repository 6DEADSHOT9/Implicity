import { describe, expect, it } from "vitest";
import { checkGeneratedFileSet, checkRegistrySnapshots } from "../src/registry/snapshot";

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

});
