import tokens from "../../../contracts/looks/tokens.json" with { type: "json" };

const cssNames = new Set(tokens.colorKeys.map((name) => `--${name}`));
for (const name of ["--font-body", "--font-heading", "--font-mono"]) cssNames.add(name);
for (const name of Object.keys(tokens.sharedPalette.light)) cssNames.add(`--${name}`);
const addCssNames = (value) => {
  if (Array.isArray(value)) return value.forEach(addCssNames);
  if (!value || typeof value !== "object") return;
  for (const [name, child] of Object.entries(value)) {
    if (name.startsWith("--")) cssNames.add(name);
    addCssNames(child);
  }
};
addCssNames(tokens.derivedTokens);

const utilityNames = new Set();
utilityNames.add("max-h-viewport-content");
for (const color of tokens.colorKeys) {
  for (const prefix of ["text", "bg", "border", "outline", "ring", "fill", "stroke", "decoration", "caret", "accent"]) utilityNames.add(`${prefix}-${color}`);
}
for (const color of Object.keys(tokens.sharedPalette.light)) {
  for (const prefix of ["text", "bg", "border", "outline", "ring", "fill", "stroke", "decoration", "caret", "accent"]) utilityNames.add(`${prefix}-${color}`);
}
for (const color of ["transparent", "current"]) for (const prefix of ["text", "bg", "border", "outline", "ring", "fill", "stroke", "decoration", "caret", "accent"]) utilityNames.add(`${prefix}-${color}`);
const firstTextScale = Object.values(tokens.derivedTokens.textSize)[0];
for (const name of Object.keys(firstTextScale.sizes)) utilityNames.add(name.replace(/^--text-/, "text-"));
for (const name of Object.keys(firstTextScale.headings)) utilityNames.add(name.replace(/^--heading-/, "text-heading-"));
for (const name of Object.keys(tokens.typefaces)) utilityNames.add(`font-${name}`);
for (const name of ["body", "heading"]) utilityNames.add(`font-${name}`);
for (const name of Object.keys(tokens.derivedTokens.fontWeights)) utilityNames.add(name.replace(/^--font-weight-/, "font-"));
for (const name of Object.keys(tokens.derivedTokens.lineHeights)) utilityNames.add(name.replace(/^--line-height-/, "leading-"));
for (const name of Object.keys(tokens.derivedTokens.motionDurations)) utilityNames.add(name.replace(/^--motion-/, "duration-"));
for (const choice of Object.values(tokens.derivedTokens.radius)) {
  for (const name of Object.keys(choice)) if (name.startsWith("--radius-")) {
    const radius = name.replace(/^--radius-/, "");
    utilityNames.add(`rounded-${radius}`);
    for (const edge of ["t", "r", "b", "l", "s", "e"]) utilityNames.add(`rounded-${edge}-${radius}`);
  }
}
utilityNames.add("rounded");
for (const edge of ["t", "r", "b", "l", "s", "e"]) utilityNames.add(`rounded-${edge}-none`);
for (const choice of Object.values(tokens.derivedTokens.density)) {
  for (const name of Object.keys(choice)) {
    const match = name.match(/^--space-(\d+)$/);
    if (!match) continue;
    for (const prefix of ["p", "px", "py", "pt", "pr", "pb", "pl", "ps", "pe", "m", "mx", "my", "mt", "mr", "mb", "ml", "ms", "me", "gap", "gap-x", "gap-y", "space-x", "space-y", "w", "h", "size", "min-w", "min-h", "max-w", "max-h", "scroll-m", "scroll-mx", "scroll-my", "scroll-p", "scroll-px", "scroll-py", "inset", "inset-x", "inset-y", "top", "right", "bottom", "left", "start", "end", "translate-x", "translate-y"]) utilityNames.add(`${prefix}-space-${match[1]}`);
  }
  for (const prefix of ["h", "w", "size", "min-h", "min-w", "max-h", "max-w"]) utilityNames.add(`${prefix}-control`);
}
for (const name of ["--icon-size", "--focus-ring-width", "--border-width", ...Array.from({ length: 6 }, (_, index) => `--text-preview-heading-${index + 1}`)]) cssNames.add(name);
for (let level = 1; level <= 6; level += 1) utilityNames.add(`text-preview-heading-${level}`);
utilityNames.add("size-icon");
utilityNames.add("grid-cols-icon-content");
utilityNames.add("ring-token");
utilityNames.add("focus-ring-token");
utilityNames.add("outline-token-hidden");
utilityNames.add("visually-hidden");
utilityNames.add("rotate-arrow");
for (const name of Object.keys(tokens.derivedTokens.dimensions)) {
  const key = name.replace(/^--/, "");
  const responsive = key.match(/^(.*?)-(width|height)-(.+)$/);
  if (responsive) {
    utilityNames.add(`${responsive[2] === "width" ? "w" : "h"}-${responsive[1]}-${responsive[3]}`);
    continue;
  }
  if (key === "content-max-height") {
    utilityNames.add("h-content-height");
    utilityNames.add("max-h-content-height");
    utilityNames.add("min-h-content-height");
  }
  if (key === "control-height") {
    for (const prefix of ["h", "w", "size"]) utilityNames.add(`${prefix}-control`);
  }
  if (key === "border-width") for (const prefix of ["h", "w"]) utilityNames.add(`${prefix}-border`);
  const match = key.match(/^(.*?)-(min|max)?-?(width|height|size)$/);
  if (!match) continue;
  const [, role, bound, property] = match;
  if (property === "size") utilityNames.add(`size-${role}`);
  else if (bound) utilityNames.add(`${bound}-${property === "width" ? "w" : "h"}-${role}`);
  else {
    const axis = property === "width" ? "w" : "h";
    utilityNames.add(`${axis}-${role}`);
    utilityNames.add(`min-${axis}-${role}`);
    utilityNames.add(`max-${axis}-${role}`);
    utilityNames.add(`size-${role}`);
  }
}
utilityNames.add("w-content");
for (const name of ["left", "right", "top", "bottom"]) for (const offset of ["1/2"]) utilityNames.add(`${name}-${offset}`);
for (const color of tokens.colorKeys) for (const side of ["t", "r", "b", "l", "s", "e"]) utilityNames.add(`border-${side}-${color}`);
for (const name of ["sidebar", "sidebar-icon", "sidebar-mobile", "panel", "panel-min", "panel-max", "content", "content-height", "icon", "attachment-preview", "attachment-thumbnail"]) {
  for (const prefix of ["left", "right", "top", "bottom"]) utilityNames.add(`-${prefix}-${name}`);
}
for (const name of ["m", "mx", "my", "mt", "mr", "mb", "ml", "ms", "me", "p", "px", "py", "pt", "pr", "pb", "pl", "ps", "pe", "gap", "gap-x", "gap-y", "space-x", "space-y", "w", "h", "size", "min-w", "min-h", "max-w", "max-h", "inset", "inset-x", "inset-y", "top", "right", "bottom", "left", "start", "end"]) utilityNames.add(`${name}-0`);
for (const name of ["leading-none", "tracking-tight", "tracking-wide", "wrap-break-word", "border", "border-0", "ring-0", "ring-2", "ring-4", "translate-x-1/2", "-translate-x-1/2", "translate-y-1/2", "-translate-y-1/2", "-translate-y-3/4"]) utilityNames.add(name);
for (const side of ["", "x", "y", "t", "r", "b", "l", "s", "e"]) utilityNames.add(`token-border${side ? `-${side}` : ""}`);
for (const name of utilityNames) if (/^(?:m|mx|my|mt|mr|mb|ml|ms|me|scroll-m|scroll-p|inset|inset-x|inset-y|top|right|bottom|left|start|end|space-x|space-y|translate-x|translate-y)-space-/.test(name)) utilityNames.add(`-${name}`);

export const tokenNames = new Set([...cssNames, ...utilityNames]);
export const tokenUtilities = utilityNames;
