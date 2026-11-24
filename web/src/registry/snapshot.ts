export type RegistrySnapshot = { registry_version: number; components: string[] };

export function checkRegistryVersion(previous: RegistrySnapshot | undefined, current: RegistrySnapshot): void {
  if (!Number.isInteger(current.registry_version) || current.registry_version < 1) throw new Error("Registry version must be a positive integer");
  if (previous && current.registry_version < previous.registry_version) throw new Error("Registry version cannot go backwards");
  if (previous && [...current.components].sort().join("\0") !== [...previous.components].sort().join("\0") && current.registry_version <= previous.registry_version) {
    throw new Error("Registry roster changed without increasing the registry version");
  }
}

export function checkGeneratedFileSet(expected: readonly string[], actual: readonly string[]): void {
  if ([...expected].sort().join("\0") !== [...actual].sort().join("\0")) throw new Error("Generated component schemas do not match the registry");
}
