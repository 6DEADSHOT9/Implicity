import { readFile, writeFile } from "node:fs/promises";
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import standaloneCode from "ajv/dist/standalone/index.js";

const output = new URL("../src/contracts/event-validator.js", import.meta.url);
const schema = JSON.parse(await readFile(new URL("../../contracts/schemas/index.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ code: { source: true, esm: true }, inlineRefs: false, strict: false });
addFormats(ajv);
const validate = ajv.compile({ ...schema, $ref: "https://implicity.local/contracts/#/$defs/Event" });
const generated = `${standaloneCode(ajv, validate)
  .replace('"use strict";', 'import equal from "ajv/dist/runtime/equal.js";\nimport { fullFormats } from "ajv-formats/dist/formats.js";')
  .replaceAll('require("ajv/dist/runtime/equal").default', "equal")
  .replaceAll('require("ajv-formats/dist/formats").fullFormats', "fullFormats")}\n`;

// Browsers have no require(); every runtime dependency must have become an import above.
if (generated.includes("require(")) throw new Error("event validator still contains require(); update the import rewrites");

if (process.argv.includes("--check")) {
  if (await readFile(output, "utf8").catch(() => "") !== generated) {
    console.error("web/src/contracts/event-validator.js is stale; run make contracts-generate");
    process.exitCode = 1;
  }
} else {
  await writeFile(output, generated);
}
