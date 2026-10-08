const js = require("@eslint/js");
const globals = require("globals");
const tseslint = require("typescript-eslint");

module.exports = [
  { ignores: ["**/node_modules/", "**/assets/", "**/logs/", "**/dist/"] },
  js.configs.recommended,
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs", globals: globals.node } },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["**/*.ts"] })),
  // import x = require() mantiene la semántica de CommonJS mientras convivan archivos .js y .ts
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": ["error", { allowAsImport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
