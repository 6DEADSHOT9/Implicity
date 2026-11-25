import Ajv2020 from "ajv/dist/2020.js";
import contracts from "../../../contracts/schemas/index.json" with { type: "json" };
import type { SkeletonEntry } from "./define-skeleton.ts";
import { skeletonMetaSchema } from "./define-skeleton.ts";

const ajv = new Ajv2020({ strict: false });
const definitions = contracts.$defs;
const componentIdValid = ajv.compile(definitions.SpecElement.properties.type);
const slotIdValid = ajv.compile(definitions.SpecElement.properties.slots.additionalProperties.items);
const stateIdValid = ajv.compile(definitions.Action_ComponentShown.properties.default_state);
const specElementValid = ajv.compile(definitions.SpecElement);
const specValid = ajv.compile({
  $schema: contracts.$schema,
  $id: "https://implicity.local/contracts/t6-spec.json",
  $defs: definitions,
  $ref: "#/$defs/Spec",
});
const envelopeDefinition = structuredClone(definitions.Spec) as { properties: { elements: { additionalProperties: unknown } } };
envelopeDefinition.properties.elements.additionalProperties = true;
const specEnvelopeValid = ajv.compile({
  $schema: contracts.$schema,
  $id: "https://implicity.local/contracts/t6-spec-envelope.json",
  $defs: { ...definitions, T6SpecEnvelope: envelopeDefinition },
  $ref: "#/$defs/T6SpecEnvelope",
});
const commandValid = ajv.compile({
  $schema: contracts.$schema,
  $id: "https://implicity.local/contracts/t6-command.json",
  $defs: definitions,
  $ref: "#/$defs/Command",
});

const eventNames = new Set<string>();
for (const rawDefinition of Object.values(definitions)) {
  if (rawDefinition === null || typeof rawDefinition !== "object" || !Object.hasOwn(rawDefinition, "properties")) continue;
  const definition = rawDefinition as { properties: Record<string, { const?: unknown; enum?: unknown[] }> };
  const name = definition.properties.name;
  if (typeof name?.const === "string") eventNames.add(name.const);
  for (const value of name?.enum ?? []) if (typeof value === "string") eventNames.add(value);
}

export type SkeletonDefinition = Omit<SkeletonEntry, "Component">;

export function validateRegistryDefinitions(entries: readonly SkeletonDefinition[]): void {
  const ids = new Set<string>();
  for (const entry of entries as readonly Partial<SkeletonDefinition>[]) {
    if (!entry || typeof entry.id !== "string" || !componentIdValid(entry.id) || entry.id === "PlainTextFallback") throw new Error("Registry entry has an invalid or reserved component id");
    if (ids.has(entry.id)) throw new Error(`Duplicate registry component id: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.propsSchema || !entry.slotsSchema || !entry.schema) throw new Error(`${entry.id} is missing its schema`);
    if (!Array.isArray(entry.events) || !entry.events.length) throw new Error(`${entry.id} is missing events`);
    if (entry.events.some((event) => !eventNames.has(event))) throw new Error(`${entry.id} declares an event not in T3`);
    if (!entry.events.includes("component_shown") || !entry.events.includes("component_seen")) throw new Error(`${entry.id} must declare shown and seen events`);

    const meta = skeletonMetaSchema.safeParse(entry.meta);
    if (!meta.success) throw new Error(`${entry.id} metadata is incomplete: ${meta.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    const declaredSlots = Object.keys(entry.slotsSchema.shape).sort();
    const metadataSlots = [...meta.data.slots].sort();
    if (declaredSlots.join("\0") !== metadataSlots.join("\0")) throw new Error(`${entry.id} slot metadata does not match its schema`);
    if (meta.data.slots.some((slot) => !slotIdValid(slot))) throw new Error(`${entry.id} declares a slot id not in T3`);
    if (declaredSlots.length) {
      const invalidChildren = Object.fromEntries(declaredSlots.map((slot) => [slot, ["Upper"]]));
      if (entry.slotsSchema.safeParse(invalidChildren).success) throw new Error(`${entry.id} slot schema does not enforce T3 child ids`);
    }
    if (meta.data.defaultStates.some((state) => !stateIdValid(state))) throw new Error(`${entry.id} declares a default state id not in T3`);
    if (meta.data.galleryStates.some((state) => !stateIdValid(state))) throw new Error(`${entry.id} declares a gallery state id not in T3`);
    if (meta.data.defaultStates.some((state) => !meta.data.galleryStates.includes(state))) throw new Error(`${entry.id} gallery states must include every default state`);
    if (meta.data.commands.some((command) => command.startsWith("cmd_"))) throw new Error(`${entry.id} Command uses reserved cmd_ prefix`);
    if (meta.data.commands.some((command) => !commandValid(command))) throw new Error(`${entry.id} declares a Command not in T3`);
  }
}

export function validateRegistryEntries(entries: readonly SkeletonEntry[]): void {
  if (entries.some((entry) => !entry.Component)) throw new Error("Registry entry is missing its Skeleton");
  validateRegistryDefinitions(entries);
}

export function isT3SpecElement(value: unknown): boolean {
  return specElementValid(value) as boolean;
}

export function isT3Spec(value: unknown): boolean {
  return specValid(value) as boolean;
}

export function isT3SpecEnvelope(value: unknown): boolean {
  return specEnvelopeValid(value) as boolean;
}
