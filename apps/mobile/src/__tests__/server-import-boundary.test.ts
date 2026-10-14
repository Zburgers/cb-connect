import ts from "typescript";
import { describe, expect, it } from "vitest";

const mobileRoot = ts.sys.getCurrentDirectory().endsWith("/apps/mobile")
  ? ts.sys.getCurrentDirectory()
  : `${ts.sys.getCurrentDirectory()}/apps/mobile`;
const repositoryRoot = mobileRoot.slice(0, -"/apps/mobile".length);
const sourceFiles = [
  ...ts.sys.readDirectory(`${mobileRoot}/src`, [".ts", ".tsx"]),
  ...ts.sys.readDirectory(`${repositoryRoot}/packages/contracts/src`, [".ts", ".tsx"]),
  `${mobileRoot}/app.config.ts`,
];
const privateServerModule =
  /(?:^|\/)convex\/(?:_helpers\/|schema(?:\.|\/|$)|queries\/|mutations\/|actions\/|crons(?:\.|\/|$)|http(?:\.|\/|$)|_generated\/(?:server|dataModel|internal)(?:\.|\/|$))/;

function importedModule(statement: ts.Statement): string | undefined {
  if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
    return statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
      ? statement.moduleSpecifier.text
      : undefined;
  }
  return undefined;
}

function serverImportViolations(text: string, fileName: string): string[] {
  const violations: string[] = [];
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    const specifier = ts.isStatement(node) ? importedModule(node) : undefined;
    if (specifier && privateServerModule.test(specifier)) {
      violations.push(`${fileName}: ${specifier}`);
    }
    if (
      ts.isImportDeclaration(node) &&
      /(?:^|\/)convex\/_generated\/api$/.test(specifier ?? "") &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some(
        (element) => element.name.text === "internal" || element.propertyName?.text === "internal",
      )
    ) {
      violations.push(`${fileName}: internal Convex references are server-only`);
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      privateServerModule.test(node.arguments[0].text)
    ) {
      violations.push(`${fileName}: ${node.arguments[0].text}`);
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
        'import { internal as serverApi } from "../../../convex/_generated/api";',
        "fixture.ts",
      ),
    ).toHaveLength(1);
    expect(
      serverImportViolations('import { api } from "../../../convex/_generated/api";', "fixture.ts"),
    ).toEqual([]);
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
