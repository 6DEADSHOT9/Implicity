import { Renderer, JSONUIProvider } from "@json-render/react";
import type { ComponentRegistry, Spec as JsonRenderSpec } from "@json-render/react";
import { Component, createContext, useContext, useRef, useState, type ErrorInfo, type ReactElement, type ReactNode } from "react";
import type { Spec } from "./contracts/generated";
import { createRegistry, registry, registryVersion } from "./registry";
import { isT3Spec, isT3SpecElement, isT3SpecEnvelope } from "./registry/validate";

const PlainTextFallback = "PlainTextFallback";
const recoveryText = "Workspace unavailable. Showing the default workspace.";
const baselineLayout = {
  registry_version: registryVersion,
  root: "baseline",
  elements: { baseline: { type: PlainTextFallback, props: {} } },
} as unknown as Spec;

type Registry = ReturnType<typeof createRegistry>;
type RawSpec = { registry_version: number; root: string; elements: Record<string, unknown> };
type BoundaryProps = { children: ReactNode; fallback: ReactNode; onError?: () => void };

class SkeletonBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const LayoutFailureContext = createContext<(() => void) | undefined>(undefined);

function PlainText({ children }: { children: string }): ReactElement {
  return <p role="note" style={{ color: "var(--foreground)" }}>{children}</p>;
}

function BaselineRecovery(): ReactElement {
  return <main role="status" style={{ color: "var(--foreground)", backgroundColor: "var(--background)" }}>
    <p>{recoveryText}</p>
  </main>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getEnvelope(value: unknown): RawSpec | undefined {
  if (!isT3SpecEnvelope(value) || !isRecord(value) || typeof value.root !== "string" || !isRecord(value.elements)) return undefined;
  if (!Object.hasOwn(value.elements, value.root)) return undefined;
  return value as RawSpec;
}

function cyclicElements(elements: Record<string, unknown>): Set<string> {
  const complete = new Set<string>();
  const active: string[] = [];
  const cyclic = new Set<string>();
  const visit = (id: string) => {
    const at = active.indexOf(id);
    if (at >= 0) {
      for (const member of active.slice(at)) cyclic.add(member);
      return;
    }
    if (complete.has(id)) return;
    active.push(id);
    const element = elements[id];
    if (isRecord(element) && isRecord(element.slots)) {
      for (const child of Object.values(element.slots).flatMap((value) => Array.isArray(value) ? value : [])) {
        if (typeof child === "string" && Object.hasOwn(elements, child)) visit(child);
      }
    }
    active.pop();
    complete.add(id);
  };
  for (const id of Object.keys(elements)) visit(id);
  return cyclic;
}

function isRenderableSpec(value: unknown, current: Registry): value is Spec {
  if (!isT3Spec(value)) return false;
  const spec = value as Spec;
  if (spec.registry_version > current.version || !Object.hasOwn(spec.elements, spec.root)) return false;
  const valid = Object.values(spec.elements).every((element) => {
    const entry = current.getSkeleton(element.type);
    const slots = element.slots ?? {};
    return !!entry
      && entry.schema.safeParse({ props: element.props, slots }).success
      && Object.keys(slots).every((slot) => Object.hasOwn(entry.slotsSchema.shape, slot) || !!entry.slotsSchema._def.catchall)
      && Object.values(slots).flat().every((child) => Object.hasOwn(spec.elements, child));
  });
  return valid && cyclicElements(spec.elements).size === 0;
}

function shellBaseline(current: Registry): Spec | undefined {
  const shell = [...current.entries.values()].find((entry) => entry.meta.role === "shell" && entry.meta.slots.includes("main"));
  if (!shell) return undefined;
  const props = shell.propsSchema.safeParse({});
  if (!props.success) return undefined;
  const slots = Object.fromEntries(shell.meta.slots.map((slot) => [slot, slot === "main" ? ["recovery"] : []]));
  if (!shell.schema.safeParse({ props: props.data, slots }).success) return undefined;
  return {
    registry_version: current.version,
    root: "shell",
    elements: {
      shell: { type: shell.id, props: props.data, slots },
      recovery: { type: PlainTextFallback, props: {} },
    },
  } as unknown as Spec;
}

function messageSpec(value: unknown, current: Registry): Spec | undefined {
  const envelope = getEnvelope(value);
  if (!envelope || envelope.registry_version > current.version) return undefined;
  if (Object.values(envelope.elements).some((element) => isRecord(element) && isT3SpecElement(element) && typeof element.type === "string" && current.getSkeleton(element.type)?.meta.role === "shell")) return undefined;
  const elements = Object.fromEntries(Object.entries(envelope.elements).map(([id, raw]) => {
    if (!isT3SpecElement(raw)) return [id, { type: PlainTextFallback, props: {} }];
    const element = raw as Spec["elements"][string];
    const entry = current.getSkeleton(element.type);
    const slots = element.slots ?? {};
    const refsExist = Object.values(slots).flat().every((child) => Object.hasOwn(envelope.elements, child));
    const componentValid = entry
      && entry.schema.safeParse({ props: element.props, slots }).success
      && Object.keys(slots).every((slot) => Object.hasOwn(entry.slotsSchema.shape, slot) || !!entry.slotsSchema._def.catchall)
      && refsExist;
    return [id, componentValid ? element : { type: PlainTextFallback, props: {} }];
  }));
  for (const id of cyclicElements(elements)) elements[id] = { type: PlainTextFallback, props: {} };
  const normalized = { registry_version: envelope.registry_version, root: envelope.root, elements };
  return isT3Spec(normalized) ? normalized as Spec : undefined;
}

function plainTextComponent(plainText: string) {
  return function PlainTextFallbackComponent(): ReactElement {
    return <PlainText>{plainText}</PlainText>;
  };
}

function renderers(current: Registry, plainText: string, onError?: () => void): ComponentRegistry {
  const result = Object.create(null) as ComponentRegistry;
  for (const [id, entry] of current.entries) {
    result[id] = function RegisteredSkeleton({ element, slots }) {
      const layoutFailure = useContext(LayoutFailureContext);
      return <SkeletonBoundary fallback={<PlainText>{plainText}</PlainText>} onError={onError ?? layoutFailure}>
        <entry.Component props={element.props} slots={slots ?? {}} />
      </SkeletonBoundary>;
    };
  }
  return result;
}

function JsonRenderView({ spec, current, plainText, onError }: { spec: Spec; current: Registry; plainText: string; onError?: () => void }): ReactElement {
  const componentRegistry = renderers(current, plainText, onError);
  const fallback = plainTextComponent(plainText);
  return <JSONUIProvider registry={componentRegistry}>
    <Renderer spec={spec as unknown as JsonRenderSpec} registry={componentRegistry} fallback={fallback} />
  </JSONUIProvider>;
}

export function renderMessage(spec: unknown, plainText: string, current: Registry = registry): ReactElement {
  const normalized = messageSpec(spec, current);
  if (!normalized) return <PlainText>{plainText}</PlainText>;
  return <JsonRenderView spec={normalized} current={current} plainText={plainText} />;
}

export function resolveLayout(candidate: unknown, lastGood: unknown, current: Registry = registry): Spec {
  if (isRenderableSpec(candidate, current)) return candidate;
  if (isRenderableSpec(lastGood, current)) return lastGood;
  return shellBaseline(current) ?? baselineLayout;
}

function layoutChoices(candidate: unknown, lastGood: unknown, current: Registry): (Spec | undefined)[] {
  const choices: (Spec | undefined)[] = [];
  if (isRenderableSpec(candidate, current)) choices.push(candidate);
  if (isRenderableSpec(lastGood, current) && !choices.some((choice) => JSON.stringify(choice) === JSON.stringify(lastGood))) choices.push(lastGood);
  choices.push(shellBaseline(current));
  choices.push(undefined);
  return choices;
}

function LayoutRenderer({ candidate, lastGood, current }: { candidate: unknown; lastGood: unknown; current: Registry }): ReactElement {
  const [state, setState] = useState({ candidate, lastGood, current, attempt: 0 });
  const failedAttempt = useRef<number | undefined>(undefined);
  if (state.candidate !== candidate || state.lastGood !== lastGood || state.current !== current) {
    setState({ candidate, lastGood, current, attempt: 0 });
    failedAttempt.current = undefined;
  }
  const { attempt } = state;
  const choices = layoutChoices(candidate, lastGood, current);
  const spec = choices[Math.min(attempt, choices.length - 1)];
  if (!spec) return <BaselineRecovery />;
  const onFailure = () => {
    if (failedAttempt.current === attempt) return;
    failedAttempt.current = attempt;
    setState((value) => ({ ...value, attempt: Math.min(value.attempt + 1, choices.length - 1) }));
  };
  return <LayoutFailureContext.Provider value={onFailure}>
    <JsonRenderView spec={spec} current={current} plainText={recoveryText} onError={onFailure} />
  </LayoutFailureContext.Provider>;
}

export function renderLayout(candidate: unknown, lastGood: unknown, current: Registry = registry): ReactElement {
  return <LayoutRenderer candidate={candidate} lastGood={lastGood} current={current} />;
}

export { baselineLayout };
