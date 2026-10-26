import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mobilePublicApiInventory } from "./api.inventory";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiReference = /\bapi\.(queries|mutations)\.([\w$]+)\.([\w$]+)/g;

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : productionSources(path);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

describe("mobile public Convex API inventory", () => {
  it("covers exactly every direct call and feature-adapter reference", () => {
    const used = new Set<string>();
    for (const file of productionSources(sourceRoot)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(apiReference)) {
        used.add(`${match[1]}.${match[2]}.${match[3]}`);
      }
    }

    expect([...Object.keys(mobilePublicApiInventory)].sort()).toEqual([...used].sort());
  });
});
