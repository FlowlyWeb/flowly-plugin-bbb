import globals from "globals";
import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

/**
 * ESLint configuration for flowly-plugin-server (Node.js / CommonJS).
 */
export default [
  js.configs.recommended,
  prettierConfig,
  {
    plugins: { prettier },
    rules: {
      "prettier/prettier": "error",
      "no-console": "warn",
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
      sourceType: "commonjs",
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    ignores: ["node_modules/", "eslint.config.mjs"],
  },
];
