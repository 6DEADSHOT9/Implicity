import { useEffect, useRef, useState } from "react";
import looks from "../../contracts/looks/default.json" with { type: "json" };
import focused from "../../contracts/looks/focused.json" with { type: "json" };
import notebook from "../../contracts/looks/notebook.json" with { type: "json" };
import tokens from "../../contracts/looks/tokens.json" with { type: "json" };
import { registry as defaultRegistry, type SkeletonEntry } from "./registry";
import { PrimitiveGallery } from "./components/primitive-gallery";
import "./gallery.css";

const availableLooks = [looks, focused, notebook];
type Registry = typeof defaultRegistry;

function SkeletonPreview({ entry, state, deviceClass, tokenStyles, texture, previewPath }: { entry: SkeletonEntry; state: SkeletonEntry["meta"]["galleryStates"][number]; deviceClass: string; tokenStyles: string; texture: string; previewPath: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const viewportWidth = deviceClass === "desktop" ? 1440 : 800;
  const previewConfig = useRef({ styles: tokenStyles, texture, mode: "light", viewportWidth });
  previewConfig.current = { styles: tokenStyles, texture, mode: document.documentElement.dataset.mode ?? "light", viewportWidth };
  const frameHeight = useRef(1);
  const animationFrame = useRef<number | undefined>(undefined);

  function updatePreview() {
    frame.current?.contentWindow?.postMessage(previewConfig.current, location.origin);
  }

  useEffect(() => {
    updatePreview();
  }, [tokenStyles, texture, viewportWidth]);

  useEffect(() => {
    const container = stage.current;
    const preview = frame.current;
    if (!container || !preview) return;
    let previousWidth = -1;
    let scale = 1;
    const resize = () => {
      if (container.clientWidth !== previousWidth) {
        previousWidth = container.clientWidth;
        scale = Math.min(1, previousWidth / viewportWidth);
        preview.style.transform = `scale(${scale})`;
      }
      container.style.height = `${frameHeight.current * scale}px`;
    };
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => {
      if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current);
      animationFrame.current = requestAnimationFrame(() => {
        animationFrame.current = undefined;
        resize();
      });
    });
    observer?.observe(container);
    resize();
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== location.origin || event.source !== preview.contentWindow || !event.data || typeof event.data !== "object" || !("type" in event.data) || event.data.type !== "preview-height" || !("height" in event.data) || typeof event.data.height !== "number" || !Number.isFinite(event.data.height) || event.data.height < 1) return;
      frameHeight.current = Math.ceil(event.data.height);
      preview.height = String(frameHeight.current);
      resize();
    };
    window.addEventListener("message", onMessage);
    return () => {
      observer?.disconnect();
      window.removeEventListener("message", onMessage);
      if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current);
    };
  }, [viewportWidth]);

  const params = new URLSearchParams({ entry: entry.id, state: state.id });
  return <>
    <div className="gallery-preview-stage" ref={stage}>
      <iframe ref={frame} className="gallery-preview-frame" title={`${entry.id} · ${state.id}`} data-device-class={deviceClass} width={viewportWidth} height={1} src={`${previewPath}?${params}`} onLoad={updatePreview} />
    </div>
  </>;
}

function choices(label: string, value: string, values: readonly string[], onChange: (value: string) => void) {
  return <label className="gallery-control">{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
    {values.map((item) => <option key={item} value={item}>{item}</option>)}
  </select></label>;
}

export function Gallery({ registry = defaultRegistry, previewPath = "/preview.html" }: { registry?: Registry; previewPath?: string }) {
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
    const documentRoot = document.documentElement;
    const scale = tokens.derivedTokens.textSize[textSize as keyof typeof tokens.derivedTokens.textSize];
    const styles = { ...look[mode as "light" | "dark"], ...Object.fromEntries(Object.entries(tokens.sharedPalette[mode as "light" | "dark"]).map(([name, value]) => [`--${name}`, value])), ...tokens.derivedTokens.radius[look.radius as keyof typeof tokens.derivedTokens.radius], ...tokens.derivedTokens.density[density as keyof typeof tokens.derivedTokens.density], "--text-scale": scale["--text-scale"], ...scale.sizes, ...scale.headings, ...tokens.derivedTokens.dimensions, ...tokens.derivedTokens.motionDurations, ...tokens.derivedTokens.motionEasing, ...tokens.derivedTokens.motionAnimations, ...tokens.derivedTokens.fontWeights, ...tokens.derivedTokens.lineHeights };
    const typeStyles = {
      "--font-body": JSON.stringify(tokens.typefaces[look.typeface.body as keyof typeof tokens.typefaces].family),
      "--font-heading": JSON.stringify(tokens.typefaces[look.typeface.heading as keyof typeof tokens.typefaces].family),
      "--font-serif": JSON.stringify(tokens.typefaces.serif.family),
      "--font-informal": JSON.stringify(tokens.typefaces.informal.family),
      "--font-mono": JSON.stringify(tokens.typefaces.mono.family),
    };
    for (const [name, value] of Object.entries({ ...styles, ...typeStyles })) {
      element.style.setProperty(name.startsWith("--") ? name : `--${name}`, value);
      documentRoot.style.setProperty(name.startsWith("--") ? name : `--${name}`, value);
    }
    documentRoot.dataset.mode = mode;
    documentRoot.dataset.look = look.id;
    documentRoot.dataset.density = density;
    documentRoot.dataset.textSize = textSize;
    documentRoot.dataset.texture = look.texture;
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
    <PrimitiveGallery />
    <section className="gallery-grid" aria-label="Registered Skeletons">
      {[...registry.entries.values()].flatMap((entry) => entry.meta.galleryStates.map((state) => {
        return <article className="gallery-card" data-skeleton={entry.id} data-gallery-state={state.id} key={`${entry.id}-${state.id}`}>
          <header><h2>{entry.id}</h2><span>{state.id}</span></header>
          <div className="gallery-preview"><SkeletonPreview entry={entry} state={state} deviceClass={deviceClass} tokenStyles={tokenStyles} texture={look.texture} previewPath={previewPath} /></div>
        </article>;
      }))}
    </section>
  </main>;
}
