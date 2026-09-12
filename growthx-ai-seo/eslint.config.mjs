import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Tracked exception, not an endorsement.
    //
    // Ten pre-existing call sites set state synchronously inside an effect
    // (localStorage reads on mount, state derived from a query, the OAuth
    // callback). Each needs its own fix and its own flow re-tested — the
    // Google callback and the admin telemetry screens especially — so they are
    // not something to change in bulk. Keeping this at `warn` lets every other
    // error-level rule gate CI today instead of waiting on that work.
    //
    // The count must only go down. When it reaches zero, delete this block.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
