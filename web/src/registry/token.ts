import tokens from "../../../contracts/looks/tokens.json" with { type: "json" };
import { tokenNames } from "./token-values.mjs";

export function token(name: string): string {
  if (!tokenNames.has(name)) throw new Error(`Unknown design token: ${name}`);
  return name.startsWith("--") ? `var(${name})` : name;
}

type PixelToken = "--border-width" | "--chart-axis-width" | "--space-2" | "--space-3";

export function tokenPixels(name: PixelToken): number {
  const root = typeof document === "undefined" ? undefined : getComputedStyle(document.documentElement);
  const fallback = name === "--chart-axis-width" || name === "--border-width" ? tokens.derivedTokens.dimensions[name] : tokens.derivedTokens.density.comfortable[name];
  const value = (root?.getPropertyValue(name).trim() || fallback).match(/^([\d.]+)(px|rem)$/);
  if (!value) throw new Error(`Design token ${name} is not a pixel or rem length`);
  return Number(value[1]) * (value[2] === "rem" ? Number.parseFloat(root?.fontSize ?? "16px") : 1);
}
