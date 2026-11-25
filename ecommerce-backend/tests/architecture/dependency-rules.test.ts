import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The lint rules catch imports by path pattern. This test catches them by
 * reading the files, so a new framework import or a `process.env` access in
 * the wrong layer fails even if someone edits the ESLint config.
 */
const SRC = fileURLToPath(new URL("../../src", import.meta.url));

const FRAMEWORKS = [
  "fastify",
  "zod",
  "@prisma/client",
  "ioredis",
  "kafkajs",
  "@aws-sdk/",
  "stripe",
];

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    return statSync(path).isDirectory()
      ? filesUnder(path)
      : path.endsWith(".ts")
        ? [path]
        : [];
  });
}

/** Comments describe the rule; only code can break it. */
function codeOnly(contents: string): string {
  return contents.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function specifiersOf(contents: string): string[] {
  const matches = contents.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g);
  return [...matches].map((match) => match[1] ?? "").filter(Boolean);
}

function layer(name: string): { path: string; contents: string }[] {
  return filesUnder(join(SRC, name)).map((path) => ({
    path: relative(SRC, path),
    contents: readFileSync(path, "utf8"),
  }));
}

function forbidden(
  source: { path: string; contents: string }[],
  patterns: string[],
  allowBare = false,
): string[] {
  const violations: string[] = [];

  for (const file of source) {
    for (const specifier of specifiersOf(file.contents)) {
      const bare = !specifier.startsWith(".");

      if (bare && !allowBare) {
        violations.push(`${file.path} imports package "${specifier}"`);
        continue;
      }

      if (patterns.some((pattern) => specifier.includes(pattern))) {
        violations.push(`${file.path} imports "${specifier}"`);
      }
    }
  }

  return violations;
}

describe("dependency rule", () => {
  it("keeps domain free of outer layers, frameworks, and the Node runtime", () => {
    const violations = forbidden(layer("domain"), [
      "/application/",
      "/infrastructure/",
      "/main/",
      ...FRAMEWORKS,
      "node:",
    ]);

    expect(violations).toEqual([]);
  });

  it("keeps application free of infrastructure, frameworks, and the runtime", () => {
    const violations = forbidden(layer("application"), [
      "/infrastructure/",
      "/main/",
      ...FRAMEWORKS,
      "node:",
    ]);

    expect(violations).toEqual([]);
  });

  it("keeps adapters free of the composition root", () => {
    // Adapters legitimately import frameworks and the Node runtime.
    const violations = forbidden(layer("infrastructure"), ["/main/"], true);

    expect(violations).toEqual([]);
  });

  it("keeps ambient time, identity, and environment out of the inner layers", () => {
    const offenders = [...layer("domain"), ...layer("application")].flatMap(
      (file) =>
        ["process.env", "Date.now", "randomUUID"].some((token) =>
          codeOnly(file.contents).includes(token),
        )
          ? [file.path]
          : [],
    );

    expect(offenders).toEqual([]);
  });

  it("only lets infrastructure and main be the outermost layers", () => {
    expect(layer("main").length).toBeGreaterThan(0);
    expect(forbidden(layer("domain"), ["infrastructure"])).toEqual([]);
  });
});
