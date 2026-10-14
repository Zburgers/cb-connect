import { posix as path } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const mobileRoot = ts.sys.getCurrentDirectory().endsWith("/apps/mobile")
  ? ts.sys.getCurrentDirectory()
  : `${ts.sys.getCurrentDirectory()}/apps/mobile`;
const repositoryRoot = mobileRoot.slice(0, -"/apps/mobile".length);
const sourceExtensions = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
];
const appConfigExtensions = [".js", ".ts", ".mjs", ".cjs", ".mts", ".cts"];
const sourceFiles = [
  ...ts.sys.readDirectory(`${mobileRoot}/src`, sourceExtensions),
  ...ts.sys.readDirectory(`${repositoryRoot}/packages/contracts/src`, sourceExtensions),
  ...appConfigExtensions
    .map((extension) => `${mobileRoot}/app.config${extension}`)
    .filter((file) => ts.sys.fileExists(file)),
];
const privateServerModule =
  /(?:^|\/)convex\/(?:_helpers\/|schema(?:\.|\/|$)|queries\/|mutations\/|actions\/|crons(?:\.|\/|$)|http(?:\.|\/|$)|_generated\/(?:server|dataModel|internal)(?:\.|\/|$))/;
const convexServerRuntimeModule = /(?:^|\/)convex\/server$/;
const generatedPublicApiModule = /(?:^|\/)convex\/_generated\/api$/;

function staticModuleSpecifier(expression: ts.Expression): string | undefined {
  if (!ts.isStringLiteral(expression) && !ts.isNoSubstitutionTemplateLiteral(expression)) {
    return undefined;
  }
  return path.normalize(expression.text.replace(/\\/g, "/"));
}

function importedModule(statement: ts.Statement): string | undefined {
  if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
    return statement.moduleSpecifier
      ? staticModuleSpecifier(statement.moduleSpecifier)
      : undefined;
  }
  if (
    ts.isImportEqualsDeclaration(statement) &&
    ts.isExternalModuleReference(statement.moduleReference)
  ) {
    const expression = statement.moduleReference.expression;
    return expression ? staticModuleSpecifier(expression) : undefined;
  }
  return undefined;
}

function isRuntimeImport(statement: ts.Statement): boolean {
  if (ts.isImportDeclaration(statement)) {
    const clause = statement.importClause;
    if (!clause) return true;
    if (clause.isTypeOnly) return false;
    if (clause.name) return true;
    if (!clause.namedBindings) return false;
    if (ts.isNamespaceImport(clause.namedBindings)) return true;
    return (
      ts.isNamedImports(clause.namedBindings) &&
      (clause.namedBindings.elements.length === 0 ||
        clause.namedBindings.elements.some((element) => !element.isTypeOnly))
    );
  }
  if (ts.isExportDeclaration(statement)) {
    if (statement.isTypeOnly) return false;
    return !(
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.length > 0 &&
      statement.exportClause.elements.every((element) => element.isTypeOnly)
    );
  }
  if (ts.isImportEqualsDeclaration(statement)) {
    return !statement.isTypeOnly && ts.isExternalModuleReference(statement.moduleReference);
  }
  return false;
}

function importsGeneratedInternalApi(statement: ts.Statement): boolean {
  if (!isRuntimeImport(statement)) return false;
  if (ts.isImportEqualsDeclaration(statement)) return true;
  if (ts.isImportDeclaration(statement)) {
    const clause = statement.importClause;
    if (!clause || clause.name || !clause.namedBindings) return true;
    if (ts.isNamespaceImport(clause.namedBindings)) return true;
    const elements = clause.namedBindings.elements;
    return (
      elements.length === 0 ||
      elements.some(
        (element) =>
          !element.isTypeOnly &&
          (element.propertyName?.text ?? element.name.text) !== "api",
      )
    );
  }
  if (ts.isExportDeclaration(statement)) {
    if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) return true;
    const elements = statement.exportClause.elements;
    return (
      elements.length === 0 ||
      elements.some(
        (element) =>
          !element.isTypeOnly &&
          (element.propertyName?.text ?? element.name.text) !== "api",
      )
    );
  }
  return false;
}

function isModuleRequire(expression: ts.Expression): boolean {
  return (
    (ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "module" &&
      expression.name.text === "require") ||
    (ts.isElementAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "module" &&
      expression.argumentExpression !== undefined &&
      ts.isStringLiteral(expression.argumentExpression) &&
      expression.argumentExpression.text === "require")
  );
}

function isModuleObjectAlias(node: ts.Node): boolean {
  if (!ts.isIdentifier(node) || node.text !== "module") return false;
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
    return !["exports", "require"].includes(parent.name.text);
  }
  if (
    ts.isElementAccessExpression(parent) &&
    parent.expression === node &&
    parent.argumentExpression &&
    ts.isStringLiteral(parent.argumentExpression)
  ) {
    return !["exports", "require"].includes(parent.argumentExpression.text);
  }
  return true;
}

function isDirectLoaderCall(expression: ts.Expression): boolean {
  return ts.isCallExpression(expression.parent) && expression.parent.expression === expression;
}

function isRequireLoaderReference(node: ts.Node): boolean {
  if (ts.isIdentifier(node) && node.text === "require") {
    const modulePropertyName =
      ts.isPropertyAccessExpression(node.parent) && node.parent.name === node;
    return !modulePropertyName && !isDirectLoaderCall(node);
  }
  return (
    (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
    isModuleRequire(node) &&
    !isDirectLoaderCall(node)
  );
}

function isDynamicModuleLoad(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require") ||
      isModuleRequire(node.expression))
  );
}

function serverImportViolations(text: string, fileName: string): string[] {
  const violations: string[] = [];
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    const specifier = ts.isStatement(node) ? importedModule(node) : undefined;
    if (
      specifier &&
      ts.isStatement(node) &&
      isRuntimeImport(node) &&
      (privateServerModule.test(specifier) || convexServerRuntimeModule.test(specifier))
    ) {
      violations.push(`${fileName}: ${specifier}`);
    }
    if (
      specifier &&
      ts.isStatement(node) &&
      generatedPublicApiModule.test(specifier) &&
      importsGeneratedInternalApi(node)
    ) {
      violations.push(`${fileName}: internal Convex references are server-only`);
    }
    if (isRequireLoaderReference(node)) {
      violations.push(`${fileName}: require loader references must be direct calls`);
    }
    if (isModuleObjectAlias(node)) {
      violations.push(`${fileName}: module object aliases are not allowed`);
    }
    if (isDynamicModuleLoad(node)) {
      const target = node.arguments[0] && staticModuleSpecifier(node.arguments[0]);
      if (!target) {
        violations.push(`${fileName}: dynamic module targets must be static`);
      } else if (
        privateServerModule.test(target) ||
        convexServerRuntimeModule.test(target) ||
        generatedPublicApiModule.test(target)
      ) {
        violations.push(`${fileName}: ${target}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
}

describe("native public Convex import boundary", () => {
  it("rejects representative private imports and permits the generated public API", () => {
    expect(
      serverImportViolations(
        'import { getCurrentUser } from "../../../convex/_helpers/getCurrentUser";',
        "fixture.ts",
      ),
    ).toHaveLength(1);
    expect(
      serverImportViolations(
        'import { getCurrentUser } from "../../../../convex/./_helpers/getCurrentUser";',
        "fixture.ts",
      ),
    ).toHaveLength(1);
    expect(
      serverImportViolations(
        'import { internal as serverApi } from "../../../convex/_generated/api";',
        "fixture.ts",
      ),
    ).toHaveLength(1);
    expect(
      serverImportViolations('import { api } from "../../../convex/_generated/api";', "fixture.ts"),
    ).toEqual([]);
    expect(
      serverImportViolations('import type { internal } from "../../../convex/_generated/api";', "fixture.ts"),
    ).toEqual([]);
    expect(
      serverImportViolations('import { api as internal } from "../../../convex/_generated/api";', "fixture.ts"),
    ).toEqual([]);
    expect(
      serverImportViolations('import * as convexApi from "../../../convex/_generated/api";', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('export * from "../../../convex/_generated/api";', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('export type { internal } from "../../../convex/_generated/api";', "fixture.ts"),
    ).toEqual([]);
    expect(
      serverImportViolations('import {} from "convex/server";', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('export * from "convex/server";', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('import { query } from "convex/server";', "fixture.ts"),
    ).toHaveLength(1);
    expect(serverImportViolations('import "convex/server";', "fixture.ts")).toHaveLength(1);
    expect(
      serverImportViolations('import type { QueryBuilder } from "convex/server";', "fixture.ts"),
    ).toEqual([]);
    expect(
      serverImportViolations('import { type QueryBuilder } from "convex/server";', "fixture.ts"),
    ).toEqual([]);
    expect(
      serverImportViolations('export type { QueryBuilder } from "convex/server";', "fixture.ts"),
    ).toEqual([]);
    expect(
      serverImportViolations('import server = require("convex/server");', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('import type ServerTypes = require("convex/server");', "fixture.ts"),
    ).toEqual([]);
    expect(
      serverImportViolations('void import("convex/server");', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('const server = require("convex/server");', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('void import(`convex/server`);', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('const server = require(`convex/server`);', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('const server = module.require("convex/server");', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('const server = module["require"]("convex/server");', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('const load = require; load("convex/server");', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('const load = module.require; load("convex/server");', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('const load = require.bind(module); load("convex/server");', "fixture.ts"),
    ).toContain("fixture.ts: require loader references must be direct calls");
    expect(
      serverImportViolations('const load = module.require.bind(module); load("convex/server");', "fixture.ts"),
    ).toContain("fixture.ts: require loader references must be direct calls");
    expect(
      serverImportViolations(
        'const ref = module; const load = ref.require.bind(ref); load("convex/server");',
        "fixture.ts",
      ),
    ).toContain("fixture.ts: module object aliases are not allowed");
    expect(serverImportViolations('module.exports = {};', "fixture.ts")).toEqual([]);
    expect(
      serverImportViolations('void import(`../../../convex/_generated/api`);', "fixture.ts"),
    ).toHaveLength(1);
    expect(
      serverImportViolations('void import(modulePath);', "fixture.ts"),
    ).toHaveLength(1);
  });

  it("keeps server implementation modules out of the client source", () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const text = ts.sys.readFile(file);
      if (text === undefined) continue;
      violations.push(...serverImportViolations(text, file));
    }
    expect(violations).toEqual([]);
  });
});
