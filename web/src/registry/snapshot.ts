export type RegistrySnapshot = { registry_version: number; components: string[] };

export function checkRegistrySnapshots(snapshots: readonly RegistrySnapshot[], current: RegistrySnapshot): void {
  if (!Number.isInteger(current.registry_version) || current.registry_version < 1) throw new Error("Registry version must be a positive integer");
  if (snapshots.some((snapshot) => Object.keys(snapshot).sort().join("\0") !== "components\0registry_version")) throw new Error("Version snapshots may contain only registry_version and components");
  const versions = snapshots.map(({ registry_version }) => registry_version).sort((a, b) => a - b);
  if (versions.some((version, index) => version !== index + 1)) throw new Error("Registry snapshots must include every version from 1");
  if (versions.at(-1) !== current.registry_version) throw new Error(`Registry version ${current.registry_version} must be the highest snapshot`);
  const snapshot = snapshots.find(({ registry_version }) => registry_version === current.registry_version);
  if (!snapshot || [...snapshot.components].sort().join("\0") !== [...current.components].sort().join("\0")) {
    throw new Error(`Registry roster differs from version ${current.registry_version} snapshot`);
  }
}

export function checkGeneratedFileSet(expected: readonly string[], actual: readonly string[]): void {
  if ([...expected].sort().join("\0") !== [...actual].sort().join("\0")) throw new Error("Generated component schemas do not match the registry");
}
