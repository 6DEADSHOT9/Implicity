import { describe, expect, it } from "vitest";
import { checkGeneratedFileSet, checkRegistryVersion, checkRegistryVersionSnapshot } from "../src/registry/snapshot";

describe("registry generation guards", () => {
  it("requires a version increase for every roster change", () => {
    const previous = { registry_version: 2, components: [] };
    expect(() => checkRegistryVersion(previous, { registry_version: 2, components: ["AppShell"] })).toThrow(/increasing the registry version/);
    expect(() => checkRegistryVersion(previous, { registry_version: 3, components: ["AppShell"] })).not.toThrow();
    expect(() => checkRegistryVersion(previous, { registry_version: 1, components: [] })).toThrow(/cannot go backwards/);
  });

  it("rejects schema files left behind after removing registry entries", () => {
    expect(() => checkGeneratedFileSet(["registry.json"], ["registry.json", "TextBlock.schema.json"])).toThrow(/do not match the registry/);
  });

  it("does not allow a committed version's roster to be rewritten", () => {
    const committed = { registry_version: 2, components: [] };
    expect(() => checkRegistryVersionSnapshot(committed, { registry_version: 2, components: ["AppShell"] })).toThrow(/committed version 2 snapshot/);
    expect(() => checkRegistryVersionSnapshot(committed, { registry_version: 2, components: [] })).not.toThrow();
  });
});
