import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default defineConfig(
  {
    // Generated files and build outputs
    ignores: [
      "build/**",
      "server.js",
      "node_modules/**",
      ".react-router/**",
      "app/components/ui/color-mode.tsx",
    ],
  },
  tseslint.configs.recommended,
  reactHooksPlugin.configs.flat["recommended-latest"],
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",

      // Prefix unused identifiers with _ to opt out
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],

      // React Compiler rules — only useful when the compiler is enabled.
      // This project does not use the React Compiler, so these are noise.
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/refs": "off",
    },
  },
);
