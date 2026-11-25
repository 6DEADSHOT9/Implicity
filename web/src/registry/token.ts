import { tokenNames } from "./token-values.mjs";

export function token(name: string): string {
  if (!tokenNames.has(name)) throw new Error(`Unknown design token: ${name}`);
  return name.startsWith("--") ? `var(${name})` : name;
}
