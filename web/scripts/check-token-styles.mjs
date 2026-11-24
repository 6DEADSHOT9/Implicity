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

function unwrap(node) {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) node = node.expression;
  return node;
}

function declarationFor(node, declarations, seen) {
  if (!ts.isIdentifier(node) || seen.has(node.text)) return undefined;
  const matches = declarations.get(node.text) ?? [];
  if (matches.length !== 1) return undefined;
  const declaration = matches[0];
  if (!declaration.initializer || !ts.isVariableDeclarationList(declaration.parent) || !(declaration.parent.flags & ts.NodeFlags.Const)) return undefined;
  seen.add(node.text);
  const value = unwrap(declaration.initializer);
  return { value, seen: new Set(seen) };
}

function inspectStyleValue(node, name, declarations, seen = new Set()) {
  node = unwrap(node);
  if (ts.isIdentifier(node)) {
    const resolved = declarationFor(node, declarations, seen);
    return resolved ? inspectStyleValue(resolved.value, name, declarations, resolved.seen) : [`unsupported style value for ${name}`];
  }
  if (ts.isConditionalExpression(node)) return [
    ...inspectStyleValue(node.whenTrue, name, declarations, new Set(seen)),
    ...inspectStyleValue(node.whenFalse, name, declarations, new Set(seen)),
  ];
  const value = ts.isStringLiteralLike(node) ? node.text : ts.isNumericLiteral(node) ? node.text : undefined;
  if (value === undefined) return [`unsupported style value for ${name}`];
  return !tokenReference.test(value) && !safeKeywords.has(value.toLowerCase()) ? [`${name}: ${value}`] : [];
}

function objectStyleViolations(node, declarations, seen = new Set()) {
  node = unwrap(node);
  if (ts.isIdentifier(node)) {
    const resolved = declarationFor(node, declarations, seen);
    return resolved ? objectStyleViolations(resolved.value, declarations, resolved.seen) : ["unsupported style expression"];
  }
  if (ts.isConditionalExpression(node)) return [
    ...objectStyleViolations(node.whenTrue, declarations, new Set(seen)),
    ...objectStyleViolations(node.whenFalse, declarations, new Set(seen)),
  ];
  const violations = [];
  if (!ts.isObjectLiteralExpression(node)) return ["unsupported style expression"];
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      violations.push(...objectStyleViolations(property.expression, declarations, new Set(seen)));
      continue;
    }
    if (ts.isShorthandPropertyAssignment(property)) {
      const name = property.name.text;
      if (colorProps.test(name) || fontProps.test(name) || sizeProps.test(name)) violations.push(...inspectStyleValue(property.name, name, declarations, new Set(seen)));
      continue;
    }
    if (!ts.isPropertyAssignment(property)) {
      violations.push("unsupported style object member");
      continue;
    }
    const name = propertyName(property.name);
    if (colorProps.test(name) || fontProps.test(name) || sizeProps.test(name)) {
      violations.push(...inspectStyleValue(property.initializer, name, declarations, new Set(seen)));
    } else if (!name || (property.name && ts.isComputedPropertyName(property.name))) {
      violations.push("unsupported style property");
    }
    if (ts.isObjectLiteralExpression(unwrap(property.initializer)) || ts.isIdentifier(unwrap(property.initializer)) || ts.isConditionalExpression(unwrap(property.initializer))) {
      violations.push(...objectStyleViolations(property.initializer, declarations, new Set(seen)));
    }
  }
  return violations;
}

function classValues(node, declarations, seen = new Set()) {
  node = unwrap(node);
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isIdentifier(node)) {
    const resolved = declarationFor(node, declarations, seen);
    return resolved ? classValues(resolved.value, declarations, resolved.seen) : undefined;
  }
  if (ts.isConditionalExpression(node) || ts.isBinaryExpression(node)) {
    const children = ts.isConditionalExpression(node) ? [node.whenTrue, node.whenFalse] : [node.left, node.right];
    const values = children.map((child) => classValues(child, declarations, new Set(seen)));
    return values.every(Boolean) ? values.flat() : undefined;
  }
  if (ts.isArrayLiteralExpression(node)) {
    const values = node.elements.map((element) => classValues(element, declarations, new Set(seen)));
    return values.every(Boolean) ? values.flat() : undefined;
  }
  return undefined;
}

function classViolations(node, declarations) {
  const values = classValues(node, declarations);
  if (!values) return ["unsupported className expression"];
  return values.flatMap((value) => value.split(/\s+/).filter((name) => utilityPattern.test(name) && !name.includes("var(--")));
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
  const declarations = new Map();
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      declarations.set(node.name.text, [...(declarations.get(node.name.text) ?? []), node]);
    }
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);
  const visit = (node) => {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (name === "style" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        violations.push(...objectStyleViolations(node.initializer.expression, declarations));
      }
      if (name === "className" && node.initializer) {
        const expression = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
        if (expression) violations.push(...classViolations(expression, declarations));
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^styles?$/i.test(node.name.text) && node.initializer) {
      violations.push(...objectStyleViolations(node.initializer, declarations));
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
