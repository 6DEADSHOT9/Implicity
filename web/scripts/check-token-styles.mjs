import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import postcss from "postcss";
import { tokenNames, tokenUtilities } from "../src/registry/token-values.mjs";

const safeKeywords = new Set(["inherit", "initial", "unset", "currentcolor", "transparent", "normal", "auto", "none"]);
const layoutKeywords = new Map([
  ["display", new Set(["block", "flex"])],
  ["flex-direction", new Set(["column"])],
  ["flex-wrap", new Set(["wrap"])],
  ["align-items", new Set(["center", "baseline"])],
  ["justify-content", new Set(["space-between"])],
]);
const tokenReference = /^var\(\s*(--[\w-]+)\s*\)$/i;
const layoutUtility = /^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|hidden|contents|flow-root|flex-(?:row|row-reverse|col|col-reverse|wrap|wrap-reverse|nowrap|1|auto|initial|none|grow|shrink)|grid-flow-(?:row|col|dense)|items-(?:start|end|center|baseline|stretch)|justify-(?:normal|start|end|center|between|around|evenly|stretch)|self-(?:auto|start|end|center|stretch|baseline)|content-(?:normal|center|start|end|between|around|evenly|baseline|stretch)|place-(?:content|items|self)-(?:start|end|center|stretch|between|around|evenly|baseline)|col-span-(?:full|\d+)|row-span-(?:full|\d+)|order-(?:first|last|none|\d+)|relative|absolute|fixed|sticky|static|overflow-(?:auto|hidden|clip|visible|scroll)|z-(?:auto|\d+))$/;
const approvedTokenModule = resolve(dirname(fileURLToPath(import.meta.url)), "../src/registry/token.ts");
const gallerySource = resolve(dirname(fileURLToPath(import.meta.url)), "../src/gallery.tsx");
const galleryCssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../src/gallery.css");
const galleryCss = await readFile(galleryCssPath, "utf8");
const galleryClasses = new Set([...galleryCss.matchAll(/\.([a-z][\w-]*)/g)].map(([, name]) => name));
const galleryLayout = new Map([["overflow", new Set(["hidden"])], ["position", new Set(["relative", "absolute"])], ["width", new Set(["100%"])], ["inset", new Set(["0 auto auto 0"])], ["border", new Set(["0"])], ["box-sizing", new Set(["border-box"])], ["margin", new Set(["0"])], ["transform-origin", new Set(["top left"])] ]);

function safeStyleValue(property, value) {
  const normalized = value.toLowerCase();
  const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return safeKeywords.has(normalized) || layoutKeywords.get(cssProperty)?.has(normalized) === true;
}

function unwrap(node) {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) node = node.expression;
  return node;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return undefined;
}

function declarations(sourceFile) {
  const found = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) found.set(node.name.text, [...(found.get(node.name.text) ?? []), node]);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function variable(node, vars, seen) {
  if (!ts.isIdentifier(node) || seen.has(node.text)) return undefined;
  const list = vars.get(node.text) ?? [];
  if (list.length !== 1) return undefined;
  const item = list[0];
  if (!item.initializer || !ts.isVariableDeclarationList(item.parent) || !(item.parent.flags & ts.NodeFlags.Const)) return undefined;
  const nextSeen = new Set(seen).add(node.text);
  return { value: unwrap(item.initializer), seen: nextSeen };
}

function importedTokenBindings(sourceFile, filename) {
  const bindings = new Set();
  const shadowed = new Set();
  const addBindingNames = (name) => {
    if (ts.isIdentifier(name)) shadowed.add(name.text);
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) if (ts.isBindingElement(element)) addBindingNames(element.name);
    }
  };
  const findShadowed = (node) => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) addBindingNames(node.name);
    if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isEnumDeclaration(node)) && node.name) shadowed.add(node.name.text);
    ts.forEachChild(node, findShadowed);
  };
  findShadowed(sourceFile);
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const path = resolve(dirname(filename), statement.moduleSpecifier.text);
    if (![path, `${path}.ts`, resolve(path, "index.ts")].includes(approvedTokenModule)) continue;
    const namedBindings = statement.importClause?.namedBindings;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const binding of namedBindings.elements) {
        if ((binding.propertyName ?? binding.name).text === "token" && !shadowed.has(binding.name.text)) bindings.add(binding.name.text);
      }
    }
  }
  return bindings;
}

function tokenCall(node, tokenBindings) {
  node = unwrap(node);
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || !tokenBindings.has(node.expression.text) || node.arguments.length !== 1) return undefined;
  const [argument] = node.arguments;
  if (!ts.isStringLiteralLike(argument) || !tokenNames.has(argument.text)) return undefined;
  return argument.text.startsWith("--") ? `var(${argument.text})` : argument.text;
}

function styleValue(node, vars, seen, tokenBindings, property) {
  node = unwrap(node);
  if (ts.isCallExpression(node)) {
    const token = tokenCall(node, tokenBindings);
    return token?.startsWith("var(") ? [] : [`unsupported dynamic style value for ${property}`];
  }
  if (ts.isIdentifier(node)) {
    const alias = variable(node, vars, seen);
    return alias ? styleValue(alias.value, vars, alias.seen, tokenBindings, property) : [`unsupported dynamic style value for ${property}`];
  }
  const value = ts.isStringLiteralLike(node) ? node.text : undefined;
  if (value === undefined) return [`unsupported style value for ${property}`];
  const match = value.match(tokenReference);
  return match && tokenNames.has(match[1]) || safeStyleValue(property, value) ? [] : [`${property}: ${value}`];
}

function classValue(node, tokenBindings) {
  node = unwrap(node);
  if (ts.isStringLiteralLike(node)) return node.text;
  return tokenCall(node, tokenBindings);
}

function classViolations(node, tokenBindings, allowedClasses) {
  const value = classValue(node, tokenBindings);
  if (value === undefined) return ["unsupported dynamic className; use token() with a token name"];
  return value.split(/\s+/).filter(Boolean).flatMap((fullName) => {
    const base = fullName.split(":").at(-1);
    if (layoutUtility.test(base) || tokenUtilities.has(base) || allowedClasses.has(base)) return [];
    return [`unknown or non-token style utility: ${fullName}`];
  });
}

function styleObject(node, vars, seen, tokenBindings, allowedClasses) {
  node = unwrap(node);
  if (ts.isIdentifier(node)) {
    const alias = variable(node, vars, seen);
    return alias ? styleObject(alias.value, vars, alias.seen, tokenBindings, allowedClasses) : ["unsupported dynamic style object"];
  }
  if (!ts.isObjectLiteralExpression(node)) return ["unsupported dynamic style object"];
  const violations = [];
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      violations.push(...styleObject(property.expression, vars, new Set(seen), tokenBindings, allowedClasses));
      continue;
    }
    if ((!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) || ts.isComputedPropertyName(property.name)) {
      violations.push("unsupported style object member");
      continue;
    }
    const name = propertyName(property.name);
    if (!name) {
      violations.push("unsupported style object key");
      continue;
    }
    const value = ts.isPropertyAssignment(property) ? property.initializer : property.name;
    if (name === "className") violations.push(...classViolations(value, tokenBindings, allowedClasses));
    else violations.push(...styleValue(value, vars, new Set(seen), tokenBindings, name));
  }
  return violations;
}

function spreadViolations(node, vars, seen, tokenBindings, allowedClasses) {
  node = unwrap(node);
  if (ts.isIdentifier(node)) {
    const alias = variable(node, vars, seen);
    return alias ? spreadViolations(alias.value, vars, alias.seen, tokenBindings, allowedClasses) : ["unsupported dynamic JSX spread"];
  }
  if (!ts.isObjectLiteralExpression(node)) return ["unsupported dynamic JSX spread"];
  const violations = [];
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      violations.push(...spreadViolations(property.expression, vars, new Set(seen), tokenBindings, allowedClasses));
      continue;
    }
    if ((!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) || ts.isComputedPropertyName(property.name)) {
      violations.push("unsupported JSX spread member");
      continue;
    }
    const name = propertyName(property.name);
    if (!name) {
      violations.push("unsupported JSX spread key");
      continue;
    }
    const value = ts.isPropertyAssignment(property) ? property.initializer : property.name;
    if (name === "style") violations.push(...styleObject(value, vars, new Set(seen), tokenBindings, allowedClasses));
    if (name === "className") violations.push(...classViolations(value, tokenBindings, allowedClasses));
  }
  return violations;
}

/** @param {string} source @param {string} [filename] @returns {string[]} */
export function tokenStyleViolations(source, filename = resolve("web/src/registry/Component/Component.tsx")) {
  if (filename.endsWith(".css")) {
    const violations = [];
    postcss.parse(source).walkDecls((declaration) => {
      const value = declaration.value.trim();
      if (resolve(filename) === galleryCssPath && galleryLayout.get(declaration.prop)?.has(value)) return;
      if (resolve(filename) === galleryCssPath && declaration.prop === "background-image" && value === 'url("/textures/paper-grain.svg")') return;
      const match = value.match(tokenReference);
      if (!(match && tokenNames.has(match[1])) && !safeStyleValue(declaration.prop, value)) violations.push(`${declaration.prop}: ${value}`);
    });
    return violations;
  }
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const vars = declarations(sourceFile);
  const tokenBindings = importedTokenBindings(sourceFile, filename);
  const allowedClasses = resolve(filename) === gallerySource ? galleryClasses : new Set();
  const violations = [];
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sourceFile);
      if (name === "style" && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        violations.push(...styleObject(node.initializer.expression, vars, new Set(), tokenBindings, allowedClasses));
      } else if (name === "className") {
        const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
        if (value) violations.push(...classViolations(value, tokenBindings, allowedClasses));
      }
    }
    if (ts.isJsxSpreadAttribute(node)) violations.push(...spreadViolations(node.expression, vars, new Set(), tokenBindings, allowedClasses));
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

async function sourceFiles(path) {
  const files = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    const fullPath = resolve(path, item.name);
    if (item.isDirectory()) files.push(...await sourceFiles(fullPath));
    else if (/\.(?:tsx?|css)$/.test(item.name) && !item.name.endsWith(".test.tsx")) files.push(fullPath);
  }
  return files;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const paths = [...await sourceFiles(resolve(root, "web/src/registry")), resolve(root, "web/src/renderer.tsx"), ...["gallery.tsx", "gallery.css", "preview-runtime.tsx", "preview-main.tsx"].map((file) => resolve(root, `web/src/${file}`))];
let failed = false;
for (const path of paths) {
  const violations = tokenStyleViolations(await readFile(path, "utf8"), path);
  if (violations.length) {
    failed = true;
    for (const violation of violations) process.stderr.write(`${path}: ${violation}\n`);
  }
}
if (failed) process.exitCode = 1;
