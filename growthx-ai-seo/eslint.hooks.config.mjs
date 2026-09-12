/**
 * Hook-safety lint — the CI gate that the main lint config cannot be yet.
 *
 * `npm run lint` currently reports dozens of pre-existing errors, so it cannot
 * block a merge without blocking everything. This config checks one rule that
 * is clean today and must stay that way: `rules-of-hooks`.
 *
 * That rule is not stylistic here. Breaking hook order is what produces the
 * "Rendered more hooks than during the previous render" crash, and an unstable
 * hook once took the whole Fix Engine page down in production. Keep this at
 * zero; widen it as the main lint config gets cleaned up.
 */

import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  {
    // Source files carry inline `eslint-disable` comments for rules from the
    // full config. Registering those plugins (with nothing switched on) keeps
    // the directives resolvable instead of erroring as unknown rules.
    files: ["src/**/*.{ts,tsx,js,jsx,mjs}"],
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      "react-hooks/rules-of-hooks": "error",
    },
  },
];
