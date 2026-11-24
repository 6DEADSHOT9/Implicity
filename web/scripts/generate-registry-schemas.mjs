import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { entries } from "../src/registry/entries.ts";

const check = process.argv.includes("--check");
const directory = resolve("contracts/generated/components");
if (!check) await mkdir(directory, { recursive: true });

for (const [id, entry] of Object.entries(entries)) {
  if (entry.meta.commands.some((command) => command.startsWith("cmd_"))) {
    throw new Error(`${id} declares a built-in Command with the reserved cmd_ prefix`);
  }
  const path = resolve(directory, `${id}.schema.json`);
  const contents = `${JSON.stringify(entry.schema.toJSONSchema(), null, 2)}\n`;
  if (check) {
    let current;
    try {
      current = await readFile(path, "utf8");
    } catch {
      throw new Error(`${path} is missing; run make registry-generate`);
    }
    if (current !== contents) throw new Error(`${path} is stale; run make registry-generate`);
  } else {
    await writeFile(path, contents);
  }
}
