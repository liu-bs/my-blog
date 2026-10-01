/**
 * @file next.config.ts
 * @description Next.js 配置：启用 cacheComponents（PPR 部分预渲染）与 next-intl 插件，可选 bundle 体积分析；图片转 AVIF/WebP；生产环境移除非 error 日志；统一安全响应头，其中 CSP 的 script-src 'unsafe-inline' 为兼容 PPR/cacheComponents 内联引导脚本的既有决策，勿轻易移除
 */
import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

/** ANALYZE=true 时启用 bundle 体积分析 */
const withBundleAnalyzer = (config: NextConfig): NextConfig =>
  process.env.ANALYZE === "true" ? createBundleAnalyzer({ enabled: true })(config) : config;

const nextConfig: NextConfig = {
  // 启用 cacheComponents（PPR 部分预渲染）
  cacheComponents: true,

  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  images: {
    formats: ["image/avif", "image/webp"],

    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    inlineCss: true,
    globalNotFound: true,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },

          { key: "X-Content-Type-Options", value: "nosniff" },

          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          { key: "X-DNS-Prefetch-Control", value: "on" },

          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000",
          },

          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },

          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'unsafe-inline' 兼容 PPR/cacheComponents 的内联引导脚本；开发环境额外放开 unsafe-eval
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

/** next-intl 插件：注入 i18n 请求配置 */
const withNextIntl = createNextIntlPlugin();

export default withBundleAnalyzer(withNextIntl(nextConfig));
