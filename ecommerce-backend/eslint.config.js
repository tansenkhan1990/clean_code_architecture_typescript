import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * The Clean Architecture dependency rule, enforced rather than documented.
 * Inner layers may not import outer layers, frameworks, or SDKs.
 *
 * `main` is deliberately not restricted to "no domain imports": the
 * composition root is the outermost layer, and dependencies point inward, so
 * it is allowed to know every layer. What it must not do is host business
 * rules, which no import rule can express — `tests/architecture` and review
 * cover that.
 */
function forbidImports(patterns, message) {
  return {
    "no-restricted-imports": [
      "error",
      {
        patterns: [{ group: patterns, message }],
      },
    ],
  };
}

const frameworks = [
  "fastify",
  "zod",
  "ioredis",
  "kafkajs",
  "jose",
  "prom-client",
  "@prisma/client",
];

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "node_modules/", "prisma/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["src/domain/**/*.ts"],
    rules: forbidImports(
      [
        "**/application/**",
        "**/infrastructure/**",
        "**/main/**",
        ...frameworks,
        "node:*",
      ],
      "Domain must not depend on outer layers, frameworks, or the Node runtime.",
    ),
  },
  {
    files: ["src/application/**/*.ts"],
    rules: forbidImports(
      ["**/infrastructure/**", "**/main/**", ...frameworks, "node:*"],
      "Application must not depend on infrastructure, the composition root, frameworks, or the Node runtime; depend on a port instead.",
    ),
  },
  {
    files: ["src/infrastructure/**/*.ts"],
    rules: forbidImports(
      ["**/main/**"],
      "Adapters must not depend on the composition root that wires them.",
    ),
  },
);
