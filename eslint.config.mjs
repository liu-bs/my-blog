import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

const LAYERS = [
  "cache",
  "controller",
  "cookie",
  "guard",
  "render",
  "repository",
  "service",
  "validator",
];

const LAYER_RULES = {
  cache: { own: ["cache", "service"], foreign: ["cache", "guard"] },
  controller: {
    own: ["cache", "controller", "cookie", "service", "validator"],
    foreign: ["cache", "guard", "service"],
  },
  cookie: { own: [], foreign: [] },
  guard: { own: ["service"], foreign: ["service"] },
  render: { own: [], foreign: [] },
  repository: { own: [], foreign: [] },
  service: { own: ["render", "repository", "service"], foreign: ["guard", "service"] },
  validator: { own: [], foreign: [] },
};

const CROSS_DOMAIN_MESSAGE =
  "跨域只准 import 对方的 *.service，或对方 *.cache 的 invalidate*/revalidate*；禁止 repository / controller / validator / cookie / render";

const LAYER_DIRECTION_MESSAGE =
  "域内只能向下依赖：controller → guard/service/validator → repository，cache → service，validator 与 repository 不依赖同层以外的文件";

const ZOD_PATHS = [{ name: "zod", message: "必须从 zod/mini 引入，保持 bundle 体积优化成果" }];

const ZOD_PATTERNS = [
  {
    group: ["zod/*", "!zod/mini"],
    message: "必须从 zod/mini 引入，保持 bundle 体积优化成果",
  },
];

function layerGlob(layer) {
  return `*.${layer}`;
}

function forbiddenTargets(allowedLayers) {
  return LAYERS.filter((layer) => !allowedLayers.includes(layer)).map(layerGlob);
}

function layerConfig(layer) {
  const { own, foreign } = LAYER_RULES[layer];
  return {
    files: [`src/server/**/*.${layer}.ts`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ZOD_PATHS,
          patterns: [
            ...ZOD_PATTERNS,
            {
              group: forbiddenTargets(own).map((glob) => `./${glob}`),
              message: LAYER_DIRECTION_MESSAGE,
            },
            {
              group: forbiddenTargets(foreign).flatMap((glob) => [
                `@server/*/${glob}`,
                `../*/${glob}`,
              ]),
              message: CROSS_DOMAIN_MESSAGE,
            },
          ],
        },
      ],
    },
  };
}

const AUTH_CORE_BLOCKED_DOMAINS = ["comment", "post"];

const AUTH_CORE_MESSAGE =
  "auth 是横切基础域，只出不进：不得 import 业务域的任何文件；需要级联业务域时写在 auth.controller 里编排";

function authCorePattern() {
  return {
    group: AUTH_CORE_BLOCKED_DOMAINS.flatMap((domain) => [
      `@server/${domain}/*`,
      `../${domain}/*`,
      `./${domain}.ts`,
    ]),
    message: AUTH_CORE_MESSAGE,
  };
}

function authCoreConfig(file, layer) {
  const [, layerOptions] = layerConfig(layer).rules["no-restricted-imports"];
  return {
    files: [file],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: layerOptions.paths,
          patterns: [...layerOptions.patterns, authCorePattern()],
        },
      ],
    },
  };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  prettierConfig,

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",

      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "after-used", ignoreRestSiblings: true },
      ],

      "react-hooks/set-state-in-effect": "off",

      "no-console": ["warn", { allow: ["error"] }],

      "no-restricted-imports": [
        "error",
        {
          paths: ZOD_PATHS,
          patterns: ZOD_PATTERNS,
        },
      ],
    },
  },

  ...Object.keys(LAYER_RULES).map(layerConfig),

  authCoreConfig("src/server/auth/auth.service.ts", "service"),
  authCoreConfig("src/server/auth/auth.guard.ts", "guard"),

  {
    files: ["src/server/common/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ZOD_PATHS,
          patterns: [
            ...ZOD_PATTERNS,
            {
              group: forbiddenTargets(["guard"]).flatMap((glob) => [
                `@server/*/${glob}`,
                `../*/${glob}`,
                `./${glob}`,
              ]),
              message: "common 属于基础设施层，唯一允许依赖的业务文件是 auth 的 *.guard",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ZOD_PATHS,
          patterns: [
            ...ZOD_PATTERNS,
            {
              group: forbiddenTargets([
                "cache",
                "controller",
                "cookie",
                "guard",
                "service",
              ]).flatMap((glob) => [`@server/*/${glob}`, `../*/${glob}`]),
              message:
                "入口层只准调用 cache 读、guard 鉴权、service 业务规则、cookie 写出与 controller 动作",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ZOD_PATHS,
          patterns: [
            ...ZOD_PATTERNS,
            {
              group: forbiddenTargets(["controller"]).map((glob) => `@server/*/${glob}`),
              message: "客户端组件与 hook 只能通过 controller（Server Action）访问服务端",
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
