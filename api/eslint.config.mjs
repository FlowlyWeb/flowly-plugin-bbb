import tseslint from "typescript-eslint";
import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

/**
 * ESLint configuration for flowly-api (NestJS / TypeScript).
 */
export default tseslint.config(
  js.configs.recommended,
  prettierConfig,
  {
    plugins: { prettier },
    rules: {
      "prettier/prettier": "error",
      "no-console": "warn",
      "no-unused-vars": "off",
    },
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["jest.config.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "coverage/", "eslint.config.mjs", "typeorm.config.ts", "**/*.spec.ts"],
  },
);
