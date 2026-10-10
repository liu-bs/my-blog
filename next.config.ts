import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";
import { OPTIMIZED_IMAGE_HOSTS } from "./src/config/site";

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

    deviceSizes: [640, 750, 828, 1200],

    remotePatterns: OPTIMIZED_IMAGE_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
  experimental: {
    globalNotFound: true,
  },

  async redirects() {
    return [{ source: "/rss.xml", destination: "/rss", permanent: false }];
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

export default withBundleAnalyzer(nextConfig);
