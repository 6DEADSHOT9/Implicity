import { describe, expect, it } from "vitest";
import { checkGeneratedFileSet, checkRegistryVersion } from "../src/registry/snapshot";

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
});
