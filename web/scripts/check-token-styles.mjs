import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import postcss from "postcss";

const colorProps = /^(?:color|background|backgroundColor|border|borderColor|outline|outlineColor|fill|stroke)$/i;
const fontProps = /^(?:font|fontFamily|fontSize|fontWeight|fontStyle|lineHeight|letterSpacing|wordSpacing|textIndent)$/i;
const sizeProps = /^(?:width|height|minWidth|maxWidth|minHeight|maxHeight|padding(?:Block|Inline)?(?:Start|End|Top|Right|Bottom|Left)?|margin(?:Block|Inline)?(?:Start|End|Top|Right|Bottom|Left)?|gap|rowGap|columnGap|borderRadius|borderWidth)$/i;
const safeKeywords = new Set(["inherit", "initial", "unset", "currentcolor", "transparent", "normal", "auto", "none"]);
const tokenReference = /^var\(\s*--[\w-]+\s*\)$/i;
const utilityPattern = /^(?:(?:text|bg|border|outline)-(?:\[[^\]]+\]|[a-z]+-\d{2,3})|text-(?:xs|sm|base|lg|[2-9]?xl)|(?:w|h|min-w|max-w|min-h|max-h|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|tracking|leading|rounded|shadow)-(?:\[[^\]]+\]|\d+|tight|tighter|wide|wider|widest|none|sm|md|lg|xl|2xl|full)|font-(?:serif|mono|sans|thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[[^\]]+\]))$/i;

function propertyName(node) {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : "";
}

function objectStyleViolations(node) {
  const violations = [];
  if (!ts.isObjectLiteralExpression(node)) return violations;
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyName(property.name);
    if (colorProps.test(name) || fontProps.test(name) || sizeProps.test(name)) {
      const value = ts.isStringLiteralLike(property.initializer) ? property.initializer.text : ts.isNumericLiteral(property.initializer) ? property.initializer.text : "";
      if (value && !tokenReference.test(value) && !safeKeywords.has(value.toLowerCase())) violations.push(`${name}: ${value}`);
    }
    if (ts.isObjectLiteralExpression(property.initializer)) violations.push(...objectStyleViolations(property.initializer));
  }
  return violations;
}

function classViolations(value) {
  return value.split(/\s+/).filter((name) => utilityPattern.test(name) && !name.includes("var(--"));
}

/** @param {string} source @param {string} [filename] @returns {string[]} */
export function tokenStyleViolations(source, filename = "component.tsx") {
  if (filename.endsWith(".css")) {
    const violations = [];
    postcss.parse(source).walkDecls((declaration) => {
      const name = declaration.prop.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (!colorProps.test(name) && !fontProps.test(name) && !sizeProps.test(name)) return;
      const value = declaration.value.trim();
      if (!tokenReference.test(value) && !safeKeywords.has(value.toLowerCase())) violations.push(`${declaration.prop}: ${value}`);
    });
    return violations;
  }
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const violations = [];
  const visit = (node) => {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (name === "style" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        violations.push(...objectStyleViolations(node.initializer.expression));
      }
      if (name === "className" && node.initializer && ts.isStringLiteral(node.initializer)) violations.push(...classViolations(node.initializer.text));
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /style/i.test(node.name.text) && node.initializer) {
      violations.push(...objectStyleViolations(node.initializer));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

async function sourceFiles(path) {
  const files = [];
  for (const name of await readdir(path, { withFileTypes: true })) {
    const fullPath = resolve(path, name.name);
    if (name.isDirectory()) files.push(...await sourceFiles(fullPath));
    else if (/\.(?:tsx?|css)$/.test(name.name) && !name.name.endsWith(".test.tsx")) files.push(fullPath);
  }
  return files;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const paths = [...await sourceFiles(resolve(root, "web/src/registry")), resolve(root, "web/src/renderer.tsx")];
let failed = false;
for (const path of paths) {
  const violations = tokenStyleViolations(await readFile(path, "utf8"), path);
  if (violations.length) {
    failed = true;
    for (const violation of violations) process.stderr.write(`${path}: ${violation}\n`);
  }
}
if (failed) process.exitCode = 1;
