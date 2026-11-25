import type { SkeletonDefinition } from "./define-skeleton";

export function catalogueFromEntries(entries: readonly SkeletonDefinition[]) {
  return entries.map(({ id, meta, propsSchema, slotsSchema }) => ({
    name: id,
    role: meta.role,
    props_schema: propsSchema.toJSONSchema(),
    slots: meta.slots,
    slots_schema: slotsSchema.toJSONSchema(),
    limits: meta.limits,
  }));
}
