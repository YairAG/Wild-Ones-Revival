const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["**/node_modules/", "**/assets/", "**/logs/", "**/dist/"] },
  js.configs.recommended,
  { languageOptions: { sourceType: "commonjs", globals: globals.node } },
];
