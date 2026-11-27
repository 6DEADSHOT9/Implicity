import tokens from "../../contracts/looks/tokens.json" with { type: "json" };

type Mode = "light" | "dark";
type Look = {
  id: string;
  radius: string;
  density: string;
  text_size: number;
  texture: string;
  typeface: { body: string; heading: string };
  light: Record<string, string>;
  dark: Record<string, string>;
};

export function lookTokenValues(look: Look, mode: Mode, density: string, textSize: string) {
  const scale = tokens.derivedTokens.textSize[textSize as keyof typeof tokens.derivedTokens.textSize];
  return {
    ...look[mode],
    ...Object.fromEntries(Object.entries(tokens.sharedPalette[mode]).map(([name, value]) => [`--${name}`, value])),
    ...tokens.derivedTokens.radius[look.radius as keyof typeof tokens.derivedTokens.radius],
    ...tokens.derivedTokens.density[density as keyof typeof tokens.derivedTokens.density],
    "--text-scale": scale["--text-scale"],
    ...scale.sizes,
    ...scale.headings,
    ...tokens.derivedTokens.dimensions,
    ...tokens.derivedTokens.motionDurations,
    ...tokens.derivedTokens.motionEasing,
    ...tokens.derivedTokens.motionAnimations,
    ...tokens.derivedTokens.fontWeights,
    ...tokens.derivedTokens.lineHeights,
    "--font-body": JSON.stringify(tokens.typefaces[look.typeface.body as keyof typeof tokens.typefaces].family),
    "--font-heading": JSON.stringify(tokens.typefaces[look.typeface.heading as keyof typeof tokens.typefaces].family),
    "--font-serif": JSON.stringify(tokens.typefaces.serif.family),
    "--font-informal": JSON.stringify(tokens.typefaces.informal.family),
    "--font-mono": JSON.stringify(tokens.typefaces.mono.family),
  };
}

export function applyLookTokens(element: HTMLElement, look: Look, mode: Mode, density: string, textSize: string) {
  for (const [name, value] of Object.entries(lookTokenValues(look, mode, density, textSize))) {
    element.style.setProperty(name.startsWith("--") ? name : `--${name}`, value);
  }
  element.dataset.mode = mode;
  element.dataset.look = look.id;
  element.dataset.density = density;
  element.dataset.textSize = textSize;
  element.dataset.texture = look.texture;
}
