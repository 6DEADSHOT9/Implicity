import { useEffect, useRef, useState } from "react";
import looks from "../../contracts/looks/default.json" with { type: "json" };
import focused from "../../contracts/looks/focused.json" with { type: "json" };
import notebook from "../../contracts/looks/notebook.json" with { type: "json" };
import tokens from "../../contracts/looks/tokens.json" with { type: "json" };
import { registry as defaultRegistry } from "./registry";
import "./gallery.css";

const availableLooks = [looks, focused, notebook];
type Registry = typeof defaultRegistry;

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
  const root = useRef<HTMLElement>(null);
  const look = availableLooks.find(({ id }) => id === lookId) ?? availableLooks[0];

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const scale = tokens.derivedTokens.textSize[textSize as keyof typeof tokens.derivedTokens.textSize];
    const styles = { ...look[mode as "light" | "dark"], ...tokens.sharedPalette[mode as "light" | "dark"], ...tokens.derivedTokens.radius[look.radius as keyof typeof tokens.derivedTokens.radius], ...tokens.derivedTokens.density[density as keyof typeof tokens.derivedTokens.density], "--text-scale": scale["--text-scale"], ...scale.sizes, ...scale.headings };
    for (const [name, value] of Object.entries(styles)) element.style.setProperty(name.startsWith("--") ? name : `--${name}`, value);
    element.style.setProperty("--font-body", tokens.typefaces[look.typeface.body as keyof typeof tokens.typefaces].family);
    element.style.setProperty("--font-heading", tokens.typefaces[look.typeface.heading as keyof typeof tokens.typefaces].family);
  }, [look, mode, density, textSize]);

  return <main ref={root} className="gallery" data-gallery-root data-look={look.id} data-mode={mode} data-density={density} data-text-size={textSize} data-device-class={deviceClass}>
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
        const parsed = entry.propsSchema.safeParse({});
        return <article className="gallery-card" data-skeleton={entry.id} data-gallery-state={state} key={`${entry.id}-${state}`}>
          <header><h2>{entry.id}</h2><span>{state}</span></header>
          <div className="gallery-preview">{parsed.success
            ? <entry.Component props={parsed.data} slots={{}} />
            : <p role="note">This Skeleton requires props to preview.</p>}</div>
        </article>;
      }))}
    </section>
  </main>;
}
