import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  prettierConfig,

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",

      "react-hooks/set-state-in-effect": "off",

      "no-console": ["warn", { allow: ["error"] }],

      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "zod", message: "必须从 zod/mini 引入，保持 bundle 体积优化成果" }],
          patterns: [
            {
              group: ["zod/*", "!zod/mini"],
              message: "必须从 zod/mini 引入，保持 bundle 体积优化成果",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["scripts/**", "src/server/common/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
