import { readFile, writeFile } from "node:fs/promises";
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import standaloneCode from "ajv/dist/standalone/index.js";

const output = new URL("../../contracts/generated/event-validator.js", import.meta.url);
const schema = JSON.parse(await readFile(new URL("../../contracts/schemas/index.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ code: { source: true, esm: true }, inlineRefs: false, strict: false });
addFormats(ajv);
const validate = ajv.compile({ ...schema, $ref: "https://implicity.local/contracts/#/$defs/Event" });
const generated = `${standaloneCode(ajv, validate)
  .replace('"use strict";', 'import equal from "ajv/dist/runtime/equal";\nimport { fullFormats } from "ajv-formats/dist/formats";')
  .replaceAll('require("ajv/dist/runtime/equal").default', "equal")
  .replaceAll('require("ajv-formats/dist/formats").fullFormats', "fullFormats")}\n`;

if (process.argv.includes("--check")) {
  if (await readFile(output, "utf8").catch(() => "") !== generated) {
    console.error("contracts/generated/event-validator.js is stale; run make contracts-generate");
    process.exitCode = 1;
  }
} else {
  await writeFile(output, generated);
}
