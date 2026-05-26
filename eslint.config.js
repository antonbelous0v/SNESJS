import stylistic from "@stylistic/eslint-plugin"

export default [
  {
    files: ["packages/**/*.js"],
    ignores: ["**/node_modules/**"],
    plugins: { "@stylistic": stylistic },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { console: "readonly", process: "readonly", Buffer: "readonly", performance: "readonly" }
    },
    rules: {
      ...stylistic.configs.customize({ semi: false, indent: 2, quotes: "double", jsx: false }).rules,
      curly: ["error", "all"],
      "@stylistic/brace-style": ["error", "1tbs", { allowSingleLine: false }],
      "@stylistic/max-statements-per-line": ["error", { max: 1 }],
      "@stylistic/no-mixed-operators": "off",
      "@stylistic/nonblock-statement-body-position": ["error", "below"],
      "@stylistic/semi": ["error", "never"]
    }
  }
]
