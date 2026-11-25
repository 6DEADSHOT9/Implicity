import tokens from "../../../contracts/looks/tokens.json" with { type: "json" };

const cssNames = new Set(tokens.colorKeys.map((name) => `--${name}`));
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
for (const color of tokens.colorKeys) {
  for (const prefix of ["text", "bg", "border", "outline"]) utilityNames.add(`${prefix}-${color}`);
}
const firstTextScale = Object.values(tokens.derivedTokens.textSize)[0];
for (const name of Object.keys(firstTextScale.sizes)) utilityNames.add(name.replace(/^--text-/, "text-"));
for (const name of Object.keys(tokens.typefaces)) utilityNames.add(`font-${name}`);
for (const name of Object.keys(tokens.derivedTokens.fontWeights)) utilityNames.add(name.replace(/^--font-weight-/, "font-"));
for (const name of Object.keys(tokens.derivedTokens.lineHeights)) utilityNames.add(name.replace(/^--line-height-/, "leading-"));
for (const choice of Object.values(tokens.derivedTokens.radius)) {
  for (const name of Object.keys(choice)) if (name.startsWith("--radius-")) utilityNames.add(name.replace(/^--radius-/, "rounded-"));
}
for (const choice of Object.values(tokens.derivedTokens.density)) {
  for (const name of Object.keys(choice)) {
    const match = name.match(/^--space-(\d+)$/);
    if (!match) continue;
    for (const prefix of ["p", "px", "py", "pt", "pr", "pb", "pl", "m", "mx", "my", "mt", "mr", "mb", "ml", "gap", "gap-x", "gap-y"]) utilityNames.add(`${prefix}-${match[1]}`);
  }
}
for (const name of Object.keys(tokens.derivedTokens.dimensions)) {
  const parts = name.replace(/^--/, "").split("-");
  const size = parts.pop();
  utilityNames.add(`${size === "width" ? "w" : "h"}-${parts.join("-")}`);
  utilityNames.add(`min-${size === "width" ? "w" : "h"}-${parts.join("-")}`);
  utilityNames.add(`max-${size === "width" ? "w" : "h"}-${parts.join("-")}`);
}

export const tokenNames = new Set([...cssNames, ...utilityNames]);
export const tokenUtilities = utilityNames;
