import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import looks from "../../contracts/looks/default.json" with { type: "json" };
import focused from "../../contracts/looks/focused.json" with { type: "json" };
import notebook from "../../contracts/looks/notebook.json" with { type: "json" };
import tokens from "../../contracts/looks/tokens.json" with { type: "json" };
import { registry as defaultRegistry, type SkeletonEntry } from "./registry";
import "./gallery.css";

const availableLooks = [looks, focused, notebook];
type Registry = typeof defaultRegistry;

class PreviewBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SkeletonPreview({ entry, state, deviceClass, tokenStyles }: { entry: SkeletonEntry; state: SkeletonEntry["meta"]["galleryStates"][number]; deviceClass: string; tokenStyles: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [frameDocument, setFrameDocument] = useState<Document>();

  useEffect(() => {
    if (!frameDocument) return;
    frameDocument.documentElement.style.cssText = tokenStyles;
    frameDocument.documentElement.dataset.texture = document.querySelector<HTMLElement>("[data-gallery-root]")?.dataset.texture ?? "none";
  }, [frameDocument, tokenStyles]);

  function loadPreview() {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    doc.documentElement.style.cssText = tokenStyles;
    doc.documentElement.dataset.texture = document.querySelector<HTMLElement>("[data-gallery-root]")?.dataset.texture ?? "none";
    doc.body.className = "gallery-preview-root";
    doc.head.replaceChildren(...[...document.head.querySelectorAll('link[rel="stylesheet"], style')].map((node) => doc.importNode(node, true)));
    setFrameDocument(doc);
  }

  return <>
    <iframe ref={frame} className="gallery-preview-frame" title={`${entry.id} · ${state.id}`} data-device-class={deviceClass} srcDoc="<!doctype html><html lang='en'><head></head><body></body></html>" onLoad={loadPreview} />
    {frameDocument && createPortal(<PreviewBoundary fallback={<p className="gallery-error" role="alert">{entry.id} · {state.id}: preview failed</p>}><entry.Component props={state.props} slots={(state.slots ?? {}) as Record<string, ReactNode>} /></PreviewBoundary>, frameDocument.body)}
  </>;
}

function choices(label: string, value: string, values: readonly string[], onChange: (value: string) => void) {
  return <label className="gallery-control">{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
    {values.map((item) => <option key={item} value={item}>{item}</option>)}
  </select></label>;
}

export function Gallery({ registry = defaultRegistry }: { registry?: Registry }) {
  const [lookId, setLookId] = useState(availableLooks[0].id);
  const [mode, setMode] = useState("light");
  const [density, setDensity] = useState(availableLooks[0].density);
  const [textSize, setTextSize] = useState(String(availableLooks[0].text_size));
  const [deviceClass, setDeviceClass] = useState("desktop");
  const [, setTokenRevision] = useState(0);
  const root = useRef<HTMLElement>(null);
  const look = availableLooks.find(({ id }) => id === lookId) ?? availableLooks[0];

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const scale = tokens.derivedTokens.textSize[textSize as keyof typeof tokens.derivedTokens.textSize];
    const styles = { ...look[mode as "light" | "dark"], ...tokens.derivedTokens.radius[look.radius as keyof typeof tokens.derivedTokens.radius], ...tokens.derivedTokens.density[density as keyof typeof tokens.derivedTokens.density], "--text-scale": scale["--text-scale"], ...scale.sizes, ...scale.headings, ...tokens.derivedTokens.dimensions, ...tokens.derivedTokens.fontWeights, ...tokens.derivedTokens.lineHeights };
    for (const [name, value] of Object.entries(styles)) element.style.setProperty(name.startsWith("--") ? name : `--${name}`, value);
    element.style.setProperty("--font-body", JSON.stringify(tokens.typefaces[look.typeface.body as keyof typeof tokens.typefaces].family));
    element.style.setProperty("--font-heading", JSON.stringify(tokens.typefaces[look.typeface.heading as keyof typeof tokens.typefaces].family));
    element.style.setProperty("--gallery-device-width", deviceClass === "desktop" ? "calc(var(--content-max-width) + var(--sidebar-width) + var(--panel-width))" : "var(--content-max-width)");
    setTokenRevision((revision) => revision + 1);
  }, [look, mode, density, textSize, deviceClass]);

  const tokenStyles = root.current?.style.cssText ?? "";
  return <main ref={root} className="gallery" data-gallery-root data-look={look.id} data-mode={mode} data-density={density} data-text-size={textSize} data-texture={look.texture} data-device-class={deviceClass}>
    <header className="gallery-header"><div><p className="gallery-kicker">Implicity · Registry</p><h1>Skeleton gallery</h1></div>
      <div className="gallery-controls">
        {choices("Look", lookId, availableLooks.map(({ id }) => id), setLookId)}
        {choices("Mode", mode, ["light", "dark"], setMode)}
        {choices("Density", density, ["compact", "comfortable", "spacious"], setDensity)}
        {choices("Text size", textSize, ["1", "2", "3", "4", "5"], setTextSize)}
        {choices("Screen size", deviceClass, ["desktop", "tablet"], setDeviceClass)}
      </div>
    </header>
    <section className="gallery-grid" aria-label="Registered Skeletons">
      {[...registry.entries.values()].flatMap((entry) => entry.meta.galleryStates.map((state) => {
        return <article className="gallery-card" data-skeleton={entry.id} data-gallery-state={state.id} key={`${entry.id}-${state.id}`}>
          <header><h2>{entry.id}</h2><span>{state.id}</span></header>
          <div className="gallery-preview"><SkeletonPreview entry={entry} state={state} deviceClass={deviceClass} tokenStyles={tokenStyles} /></div>
        </article>;
      }))}
    </section>
  </main>;
}
