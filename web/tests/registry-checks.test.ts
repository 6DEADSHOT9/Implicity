import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkGeneratedFileSet, checkRegistrySnapshots } from "../src/registry/snapshot";
import { catalogueFromEntries } from "../src/registry/catalogue";
import { discoverRegistryFolders, registryFoldersFromPaths } from "../src/registry/discovery";
import { events } from "./fixtures/ReviewPanel/events";
import { meta } from "./fixtures/ReviewPanel/meta";
import { definition, propsSchema, slotsSchema } from "./fixtures/ReviewPanel/schema";
import catalogueFixture from "./fixtures/catalogue.json";
import registryV3 from "../../contracts/generated/components/registry-v3.json";
import registryV2 from "../../contracts/generated/components/registry-v2.json";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("registry generation guards", () => {
  it("discovers registry folders and files from the same module paths", () => {
    expect(registryFoldersFromPaths(["./Panel/Panel.tsx", "./Panel/schema.ts", "./Shell/Shell.tsx"])).toEqual([
      { id: "Panel", files: ["Panel.tsx", "schema.ts"] },
      { id: "Shell", files: ["Shell.tsx"] },
    ]);
    expect(registryFoldersFromPaths(["./registry/Panel/Panel.tsx"], "./registry/")).toEqual([
      { id: "Panel", files: ["Panel.tsx"] },
    ]);
  });

  it("requires the current roster snapshot and highest snapshot version", () => {
    const current = { registry_version: 2, components: [] };
    expect(() => checkRegistrySnapshots([{ registry_version: 1, components: [] }, current], current)).not.toThrow();
    expect(() => checkRegistrySnapshots([{ registry_version: 1, components: [] }, current], { ...current, components: ["AppShell"] })).toThrow(/version 2 snapshot/);
    expect(() => checkRegistrySnapshots([{ registry_version: 1, components: [] }], current)).toThrow(/highest snapshot/);
    expect(() => checkRegistrySnapshots([{ registry_version: 1, components: [] }, current], { registry_version: 3, components: ["AppShell"] })).toThrow(/highest snapshot/);
  });

  it("rejects roster drift before generation can rewrite the committed snapshot", () => {
    const snapshots = [
      { registry_version: 1, components: [] },
      registryV2,
      registryV3,
    ];
    const before = JSON.stringify(snapshots);
    expect(() => checkRegistrySnapshots(snapshots, {
      registry_version: registryV3.registry_version,
      components: ["Ghost"],
    })).toThrow(/roster differs/);
    expect(JSON.stringify(snapshots)).toBe(before);
    expect(Object.keys(registryV3).sort()).toEqual(["components", "registry_version"]);
    expect(() => checkRegistrySnapshots([
      snapshots[0],
      { ...registryV3, catalogue: [] } as unknown as { registry_version: number; components: string[] },
    ], registryV3 as unknown as { registry_version: number; components: string[] })).toThrow(/only registry_version and components/);
  });

  it("refuses to rewrite a changed snapshot in registry-generate mode", () => {
    const temp = mkdtempSync(join(tmpdir(), "registry-generation-"));
    const copy = (from: string, to: string) => cpSync(resolve(ROOT, from), join(temp, to), { recursive: true });
    try {
      copy("web/scripts", "web/scripts");
      copy("web/src/registry", "web/src/registry");
      copy("contracts/schemas", "contracts/schemas");
      copy("contracts/generated/components", "contracts/generated/components");
      mkdirSync(join(temp, "web"), { recursive: true });
      if (!existsSync(join(temp, "web/node_modules"))) symlinkSync(resolve(ROOT, "web/node_modules"), join(temp, "web/node_modules"), "dir");
      const snapshotPath = join(temp, "contracts/generated/components/registry-v3.json");
      writeFileSync(snapshotPath, JSON.stringify({ registry_version: 3, components: ["Ghost"] }, null, 2) + "\n");
      const changedSnapshot = readFileSync(snapshotPath, "utf8");

      expect(() => execFileSync(process.execPath, [join(temp, "web/scripts/generate-registry-schemas.mjs")], { cwd: temp, stdio: "pipe" })).toThrow(/Registry roster differs/);
      expect(readFileSync(snapshotPath, "utf8")).toBe(changedSnapshot);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("maps a SkeletonDefinition to the Python catalogue shape", () => {
    expect(catalogueFromEntries([definition])).toEqual(catalogueFixture.catalogue);
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
