import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,
    {
        files: ["**/*.ts"],
        plugins: {
            prettier: prettierPlugin,
        },
        rules: {
            "prettier/prettier": "error",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { "argsIgnorePattern": "^_" },
            ],
        },
    },
    {
        ignores: ["node_modules/", "dist/", ".env"],
    }
);
