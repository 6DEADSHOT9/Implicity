import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import postcss from "postcss";
import { compile } from "tailwindcss";
import { createRequire } from "node:module";
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
const staticCandidates = new Set();
const hardCodedUtilities = /^(?:border(?:-[0-9]+)?|ring-[0-9]+|z-(?!auto|10|20|50)[0-9]+|duration-[0-9]+|rotate-45|(?:-?)(?:top|right|bottom|left)-(?!0$)[0-9]+|(?:h|w)-px)$/;
const layoutUtility = /^(?:box-border|block|inline|inline-block|flex|inline-flex|grid|inline-grid|hidden|contents|flow-root|sr-only|not-sr-only|flex-(?:row|row-reverse|col|col-reverse|wrap|wrap-reverse|nowrap|1|auto|initial|none|grow|shrink)|(?:grow|shrink)(?:-0)?|basis-(?:auto|full|\d+\/\d+)|grid-flow-(?:row|col|dense)|grid-cols-(?:\d+|icon-content)|grid-rows-\d+|auto-rows-(?:auto|min|max|fr)|items-(?:start|end|center|baseline|stretch)|justify-(?:normal|start|end|center|between|around|evenly|stretch)|justify-(?:items|self)-(?:start|end|center|end|stretch)|self-(?:auto|start|end|center|stretch|baseline)|content-(?:normal|center|start|end|between|around|evenly|baseline|stretch)|place-(?:content|items|self)-(?:start|end|center|stretch|between|around|evenly|baseline)|col-(?:span|start|end)-(?:full|\d+)|row-(?:span|start|end)-(?:full|\d+)|order-(?:first|last|none|\d+)|relative|absolute|fixed|sticky|static|inset(?:-[xyse])?(?:-(?:0|y-0|space-\d+|y-space-\d+))?|(?:top|right|bottom|left|start|end|inset-[xyse])-(?:0|auto|full|1\/2|space-\d+)|-?(?:top|right|bottom|left)-(?:space-\d+|12)|overflow(?:-[xy])?-(?:auto|hidden|clip|visible|scroll)|z-(?:auto|\d+)|w-(?:auto|full|fit|max|screen|svw|\d+\/\d+)|h-(?:auto|full|fit|screen|svh|dvh)|size-full|min-[wh]-(?:0|full|svh)|max-[wh]-(?:none|full|screen|svh|dvh)|aspect-(?:auto|square|video)|object-(?:contain|cover|fill|none|scale-down)|cursor-(?:auto|default|pointer|wait|text|move|not-allowed|grab|grabbing|e-resize|w-resize)|pointer-events-(?:none|auto)|select-(?:none|text|all|auto)|touch-(?:auto|none|pan-[xy])|overscroll-(?:auto|contain|none)|whitespace-(?:normal|nowrap|pre|pre-wrap|pre-line|break-spaces)|break-(?:normal|words|all|keep)|truncate|text-(?:left|center|right|justify|start|end)|text-(?:ellipsis|clip|balance|pretty)|italic|not-italic|uppercase|lowercase|capitalize|normal-case|align-(?:baseline|top|middle|bottom|text-top|text-bottom|sub|super)|list-(?:none|disc|decimal)|line-clamp-\d+|underline|no-underline|outline-(?:none|hidden)|ring-(?:0|transparent)|border-(?:solid|dashed|dotted|double|hidden|none)|opacity-0|rotate-[-\w]+|translate-[xy]-[-\w./]+|origin-\(--radix-[\w-]+-transform-origin\)|transition(?:-[\w\],-]+)?|duration-\d+|ease-[\w-]+|animate-(?:in|out|pulse|spin)|fade-(?:in|out)-\d+|zoom-(?:in|out)-\d+|slide-(?:in|out)-to-[\w-]+|will-change-[\w-]+|contain-[\w-]+|@container(?:\/[\w-]+)?|@(?:sm|md|lg|xl)(?:\/[\w-]+)?|peer(?:\/[\w-]+)?|group(?:\/[\w-]+)?|is-(?:user|assistant)|caption-bottom|not-prose|ml-auto|mt-auto|mx-auto|resize-none)$/;
const approvedTokenModule = resolve(dirname(fileURLToPath(import.meta.url)), "../src/registry/token.ts");
const gallerySource = resolve(dirname(fileURLToPath(import.meta.url)), "../src/gallery.tsx");
const primitiveGallerySource = resolve(dirname(fileURLToPath(import.meta.url)), "../src/components/primitive-gallery.tsx");
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const galleryCssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../src/gallery.css");
const primitivePath = /\/components\/(?:ui|ai-elements)\//;
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

function importedBindings(sourceFile, moduleName, importedName) {
  const bindings = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== moduleName) continue;
    const namedBindings = statement.importClause?.namedBindings;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const binding of namedBindings.elements) if ((binding.propertyName ?? binding.name).text === importedName) bindings.add(binding.name.text);
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

function styleValue(node, vars, seen, tokenBindings, property, strict = false) {
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
  return match && tokenNames.has(match[1]) || !strict && safeStyleValue(property, value) ? [] : [`${property}: ${value}`];
}

function classValue(node, tokenBindings) {
  node = unwrap(node);
  if (ts.isStringLiteralLike(node)) return node.text;
  return tokenCall(node, tokenBindings);
}

function variantClasses(node) {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== "cva") return undefined;
  const classes = [];
  const addStrings = (item) => {
    if (ts.isStringLiteralLike(item)) classes.push(item.text);
    else if (ts.isArrayLiteralExpression(item)) item.elements.forEach(addStrings);
  };
  addStrings(node.arguments[0]);
  const options = node.arguments[1];
  if (options && ts.isObjectLiteralExpression(options)) {
    const variants = options.properties.find((property) => (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property)) && propertyName(property.name) === "variants");
    if (variants && ts.isPropertyAssignment(variants) && ts.isObjectLiteralExpression(variants.initializer)) {
      for (const property of variants.initializer.properties) {
        if (ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.initializer)) {
          for (const value of property.initializer.properties) if (ts.isPropertyAssignment(value)) addStrings(value.initializer);
        }
      }
    }
  }
  return classes;
}

function classExpression(node, vars, variants, tokenBindings, cnBindings, seen = new Set(), allowClassName = false) {
  node = unwrap(node);
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap((item) => classExpression(item, vars, variants, tokenBindings, cnBindings, seen, allowClassName));
  if (ts.isConditionalExpression(node)) return [...classExpression(node.whenTrue, vars, variants, tokenBindings, cnBindings, new Set(seen), allowClassName), ...classExpression(node.whenFalse, vars, variants, tokenBindings, cnBindings, new Set(seen), allowClassName)];
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) return [...classExpression(node.left, vars, variants, tokenBindings, cnBindings, new Set(seen), allowClassName) ?? [], ...classExpression(node.right, vars, variants, tokenBindings, cnBindings, new Set(seen), allowClassName) ?? []];
  if (ts.isIdentifier(node)) {
    if (node.text === "className") return [];
    if (variants.has(node.text)) return variants.get(node.text);
    const alias = variable(node, vars, seen);
    return alias ? classExpression(alias.value, vars, variants, tokenBindings, cnBindings, alias.seen, allowClassName) : undefined;
  }
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return undefined;
  if (cnBindings.has(node.expression.text)) return node.arguments.flatMap((argument) => classExpression(argument, vars, variants, tokenBindings, cnBindings, new Set(seen), true) ?? ["unsupported dynamic className; use token() with a token name"]);
  if (variants.has(node.expression.text)) return variants.get(node.expression.text);
  const token = tokenCall(node, tokenBindings);
  if (token !== undefined) return [token];
  return undefined;
}

function classStringViolations(value, allowedClasses) {
  return value.split(/\s+/).filter(Boolean).flatMap((fullName) => {
    const base = utilityBase(fullName);
    if (!/^(?:group|peer)(?:\/.*)?$/.test(base) && !/^is-(?:user|assistant)$/.test(base) && !allowedClasses.has(base)) staticCandidates.add(fullName);
    if (base.includes("[")) return [`arbitrary style utility is not allowed: ${fullName}`];
    const utility = base.endsWith("!") ? base.slice(0, -1) : base;
    const alphaBase = utility.replace(/\/\d{1,3}$/, "");
    if (hardCodedUtilities.test(utility)) return [`hard-coded style utility is not allowed: ${fullName}`];
    if (layoutUtility.test(utility) || tokenUtilities.has(utility) || tokenUtilities.has(alphaBase) || allowedClasses.has(utility) || /^(?:bg|text|border|ring)-(?:transparent|current)$/.test(utility)) return [];
    return [`unknown or non-token style utility: ${fullName}`];
  });
}

function classViolations(node, tokenBindings, allowedClasses) {
  const value = classValue(node, tokenBindings);
  return value === undefined ? ["unsupported dynamic className; use token() with a token name"] : classStringViolations(value, allowedClasses);
}

function styleObject(node, vars, seen, tokenBindings, allowedClasses, strict = false) {
  node = unwrap(node);
  if (ts.isIdentifier(node)) {
    const alias = variable(node, vars, seen);
    return alias ? styleObject(alias.value, vars, alias.seen, tokenBindings, allowedClasses, strict) : ["unsupported dynamic style object"];
  }
  if (!ts.isObjectLiteralExpression(node)) return ["unsupported dynamic style object"];
  const violations = [];
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      violations.push(...styleObject(property.expression, vars, new Set(seen), tokenBindings, allowedClasses, strict));
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
    else violations.push(...styleValue(value, vars, new Set(seen), tokenBindings, name, strict));
  }
  return violations;
}

function spreadViolations(node, vars, seen, tokenBindings, allowedClasses, strict = false) {
  node = unwrap(node);
  if (ts.isIdentifier(node)) {
    const alias = variable(node, vars, seen);
    return alias ? spreadViolations(alias.value, vars, alias.seen, tokenBindings, allowedClasses, strict) : ["unsupported dynamic JSX spread"];
  }
  if (!ts.isObjectLiteralExpression(node)) return ["unsupported dynamic JSX spread"];
  const violations = [];
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      violations.push(...spreadViolations(property.expression, vars, new Set(seen), tokenBindings, allowedClasses, strict));
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
    if (name === "style") violations.push(...styleObject(value, vars, new Set(seen), tokenBindings, allowedClasses, strict));
    if (name === "className") violations.push(...classViolations(value, tokenBindings, allowedClasses));
  }
  return violations;
}

function utilityBase(name) {
  let depth = 0;
  let base = "";
  for (const character of name) {
    if (character === "[") depth++;
    if (character === "]") depth--;
    if (character === ":" && depth === 0) base = "";
    else base += character;
  }
  return base;
}

/** @param {string} source @param {string} [filename] @returns {string[]} */
export function tokenStyleViolations(source, filename = resolve("web/src/registry/Component/Component.tsx")) {
  if (filename.endsWith(".css")) {
    const violations = [];
    postcss.parse(source).walkDecls((declaration) => {
      const value = declaration.value.trim();
      if (resolve(filename) === galleryCssPath && (galleryLayout.get(declaration.prop)?.has(value) || ["display", "position", "inset", "top", "right", "bottom", "left", "width", "height", "min-width", "max-width", "min-height", "max-height", "margin", "padding", "gap", "grid-template-columns", "grid-template-rows", "flex-direction", "align-items", "justify-content", "box-sizing", "overflow", "transform", "transform-origin", "contain"].includes(declaration.prop))) return;
      if (resolve(filename) === galleryCssPath && declaration.prop === "background-image" && value === 'url("/textures/paper-grain.svg")') return;
      const match = value.match(tokenReference);
      if (!(match && tokenNames.has(match[1])) && !safeStyleValue(declaration.prop, value)) violations.push(`${declaration.prop}: ${value}`);
    });
    return violations;
  }
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const vars = declarations(sourceFile);
  const tokenBindings = importedTokenBindings(sourceFile, filename);
  const cnBindings = new Set([...importedBindings(sourceFile, "cn", "cn"), ...importedBindings(sourceFile, "@/lib/utils", "cn")]);
  const variants = new Map();
  const variantCalls = new Set();
  const trustedSpreadNames = new Set();
  const trustedPropTypes = new Set();
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement) && /(?:ComponentProps|HTMLAttributes|DetailedHTMLProps)/.test(statement.type.getText(sourceFile))) trustedPropTypes.add(statement.name.text);
    if (ts.isInterfaceDeclaration(statement) && statement.heritageClauses?.some((clause) => /(?:ComponentProps|HTMLAttributes|DetailedHTMLProps)/.test(clause.getText(sourceFile)))) trustedPropTypes.add(statement.name.text);
  }
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const named = statement.importClause.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    let target = statement.moduleSpecifier.text;
    if (target.startsWith("@/")) target = resolve(sourceRoot, target.slice(2));
    else if (target.startsWith(".")) target = resolve(dirname(filename), target);
    else continue;
    const importedFile = [target, `${target}.tsx`, `${target}.ts`].find((path) => {
      try { return readFileSync(path, "utf8").length >= 0; } catch { return false; }
    });
    if (!importedFile) continue;
    const importedSource = ts.createSourceFile(importedFile, readFileSync(importedFile, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const item of named.elements) {
      const importedName = (item.propertyName ?? item.name).text;
      const declaration = importedSource.statements.flatMap((node) => ts.isVariableStatement(node) ? node.declarationList.declarations : []).find((node) => ts.isIdentifier(node.name) && node.name.text === importedName && node.initializer);
      if (declaration?.initializer) {
        const classes = variantClasses(unwrap(declaration.initializer));
        if (classes) variants.set(item.name.text, classes);
      }
    }
  }
  const findHelpers = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const call = unwrap(node.initializer);
      if (ts.isCallExpression(call)) {
        if (variantClasses(call) !== undefined) {
          variants.set(node.name.text, variantClasses(call));
          variantCalls.add(call);
        }
      }
    }
    if (ts.isParameter(node) && node.type && (/(?:ComponentProps|HTMLAttributes|DetailedHTMLProps)/.test(node.type.getText(sourceFile)) || ts.isTypeReferenceNode(node.type) && (trustedPropTypes.has(node.type.typeName.getText(sourceFile)) || /(?:GroupProps|PanelProps|SeparatorProps|ToasterProps)$/.test(node.type.typeName.getText(sourceFile))))) {
      if (ts.isIdentifier(node.name)) trustedSpreadNames.add(node.name.text);
      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) if (element.dotDotDotToken && ts.isIdentifier(element.name)) trustedSpreadNames.add(element.name.text);
      }
    }
    ts.forEachChild(node, findHelpers);
  };
  findHelpers(sourceFile);
  const allowedClasses = [gallerySource, primitiveGallerySource].includes(resolve(filename)) ? galleryClasses : new Set();
  const strict = primitivePath.test(resolve(filename));
  const violations = [];
  for (const classes of variants.values()) for (const value of classes) violations.push(...classStringViolations(value, allowedClasses));
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sourceFile);
      if (name === "style" && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        violations.push(...styleObject(node.initializer.expression, vars, new Set(), tokenBindings, allowedClasses, strict));
      } else if (name === "className") {
        const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
        if (value) {
          const classes = classExpression(value, vars, variants, tokenBindings, cnBindings);
          if (classes === undefined || classes.some((item) => item.startsWith("unsupported dynamic className"))) violations.push("unsupported dynamic className; use token() with a token name");
          else for (const item of classes) violations.push(...classStringViolations(item, allowedClasses));
        }
      }
    }
    if (ts.isJsxSpreadAttribute(node)) {
      const spread = unwrap(node.expression);
      if (!(ts.isIdentifier(spread) && trustedSpreadNames.has(spread.text))) violations.push(...spreadViolations(node.expression, vars, new Set(), tokenBindings, allowedClasses, strict));
    }
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
export const paths = [...await sourceFiles(resolve(root, "web/src/registry")), ...await sourceFiles(resolve(root, "web/src/components/ui")), ...await sourceFiles(resolve(root, "web/src/components/ai-elements")), ...["renderer.tsx", "gallery.tsx", "gallery.css", "components/primitive-gallery.tsx", "preview-runtime.tsx", "preview-main.tsx"].map((file) => resolve(root, `web/src/${file}`))];
let failed = false;
for (const path of paths) {
  const violations = tokenStyleViolations(await readFile(path, "utf8"), path);
  if (violations.length) {
    failed = true;
    for (const violation of violations) process.stderr.write(`${path}: ${violation}\n`);
  }
}
const require = createRequire(import.meta.url);
const tokenCssPath = resolve(root, "web/src/tokens.css");
const tailwind = await compile(await readFile(tokenCssPath, "utf8"), {
  base: dirname(tokenCssPath), from: tokenCssPath,
  loadStylesheet: async (id, base) => {
    const path = id.startsWith("tailwindcss/") ? require.resolve(id) : id === "tw-animate-css" ? resolve(root, "web/node_modules/tw-animate-css/dist/tw-animate.css") : resolve(base, id);
    return { path, base: dirname(path), content: await readFile(path, "utf8") };
  },
});
export function missingTailwindRules(classes) {
  const output = tailwind.build(classes);
  const generated = new Set();
  postcss.parse(output).walkRules((rule) => {
    for (const candidate of classes) {
      const escaped = candidate.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
      if (rule.selector.includes(`.${escaped}`)) generated.add(candidate);
    }
  });
  return classes.filter((candidate) => !generated.has(candidate));
}
const utilityCandidates = [...staticCandidates].filter((name) => !/^(?:group|peer|is-(?:user|assistant))$/.test(name));
const missing = missingTailwindRules(utilityCandidates);
for (const candidate of missing) {
  failed = true;
  process.stderr.write(`${candidate}: Tailwind generated no rule from tokens.css\n`);
}
const output = tailwind.build(utilityCandidates);
postcss.parse(output).walkRules((rule) => {
  for (const candidate of utilityCandidates) {
    const escaped = candidate.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    if (!rule.selector.includes(`.${escaped}`)) continue;
    rule.walkDecls((declaration) => {
      if (/(?:#[\da-f]{3,8}\b|(?:[1-9]\d*(?:\.\d+)?|0?\.\d*[1-9]\d*)(?:px|rem)\b)/i.test(declaration.value)) {
        failed = true;
        process.stderr.write(`${candidate}: generated ${declaration.prop}: ${declaration.value} contains a hard-coded size or colour\n`);
      }
    });
  }
});
if (failed) process.exitCode = 1;
