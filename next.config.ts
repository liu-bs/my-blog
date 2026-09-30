import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

const withBundleAnalyzer = (config: NextConfig): NextConfig =>
  process.env.ANALYZE === "true" ? createBundleAnalyzer({ enabled: true })(config) : config;

const nextConfig: NextConfig = {
  cacheComponents: true,

  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  images: {
    formats: ["image/avif", "image/webp"],

    // 封面为用户填写的任意外链，写入口已限定 https（isSafeImageUrl），这里放行全部 https 主机交给优化器
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

const withNextIntl = createNextIntlPlugin();

export default withBundleAnalyzer(withNextIntl(nextConfig));
