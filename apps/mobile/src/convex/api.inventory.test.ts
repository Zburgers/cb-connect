import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { mobilePublicApiInventory } from "./api.inventory";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
function publicReferences(source: string): string[] {
  const file = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const refs: string[] = [];
  const apiPath = /(?:^|\/)api(?:\.[cm]?[jt]s)?$/;
  let importsApi = false;
  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause) && statement.exportClause.elements.some((item) => (item.propertyName ?? item.name).text === "api")) throw new Error("Do not re-export the public API");
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) && apiPath.test(statement.moduleSpecifier.text)) throw new Error("Do not re-export the public API");
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!apiPath.test(statement.moduleSpecifier.text) && !(bindings && ts.isNamedImports(bindings) && bindings.elements.some((item) => (item.propertyName ?? item.name).text === "api"))) continue;
    if (!bindings || !ts.isNamedImports(bindings) || bindings.elements.some((item) => item.name.text !== "api" || item.propertyName)) throw new Error("Import the public API as api");
    importsApi = true;
  }
  function access(node: ts.Node, left: ts.Node): string | undefined {
    if (ts.isPropertyAccessExpression(node) && node.expression === left) return node.name.text;
    if (ts.isQualifiedName(node) && node.left === left) return node.right.text;
    return undefined;
  }
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isCallExpression(node) && node.arguments.some((arg) => (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) && apiPath.test(arg.text))) throw new Error("Use a static public API import");
    if (importsApi && ts.isIdentifier(node) && node.text === "api") {
      const group = node.parent;
      const section = group.parent;
      const fn = section.parent;
      const groupName = access(group, node);
      const sectionName = access(section, group);
      const fnName = access(fn, section);
      if (!groupName || !["queries", "mutations"].includes(groupName) || !sectionName || !fnName) throw new Error("Use a direct public API reference");
      refs.push(`${groupName}.${sectionName}.${fnName}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return refs;
}

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : productionSources(path);
    return /\.(?:[cm]?[jt]s|tsx|jsx)$/.test(entry.name) && !/\.test(?:-d)?\.|\.d\.ts$/.test(entry.name) && path !== join(sourceRoot, "convex", "api.js") ? [path] : [];
  });
}

describe("mobile public Convex API inventory", () => {
  it("rejects aliases and computed or destructured API access", () => {
    expect(publicReferences('import { api } from "../../convex/api"; api.queries.users.getMe;')).toEqual(["queries.users.getMe"]);
    expect(publicReferences('import { api } from "../../../../convex/_generated/api"; api.queries.users.getMe;')).toEqual(["queries.users.getMe"]);
    expect(publicReferences('import { api } from "./api"; api.queries.users.getMe;')).toEqual(["queries.users.getMe"]);
    for (const source of [
      'import { api as publicApi } from "../../convex/api"; publicApi.queries.users.getMe;',
      'import { api } from "../../convex/api"; api["queries"].users.getMe;',
      'import { api } from "../../convex/api"; const { queries } = api;',
      'const { api } = require("../../convex/api"); api.queries.users.getMe;',
      'const { api } = module.require("../../convex/api"); api.queries.users.getMe;',
      'const { api } = require(`../../convex/api`); api.queries.users.getMe;',
      'export { api } from "../../convex/api";',
    ]) expect(() => publicReferences(source)).toThrow();
  });
  it("covers exactly every direct call and feature-adapter reference", () => {
    const used = new Set<string>();
    const mobileRoot = join(sourceRoot, "..");
    const configs = ["js", "ts", "mjs", "cjs", "mts", "cts"].map((ext) => join(mobileRoot, `app.config.${ext}`)).filter(existsSync);
    for (const file of [...productionSources(sourceRoot), ...configs]) {
      const source = readFileSync(file, "utf8");
      for (const ref of publicReferences(source)) used.add(ref);
    }

    expect([...Object.keys(mobilePublicApiInventory)].sort()).toEqual([...used].sort());
  });
});
