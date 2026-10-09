/**
 * @file next.config.ts
 * @description Next.js 构建配置：开启 cacheComponents 与全局 404、图片优化（AVIF/WebP）、
 * 生产环境移除 console（保留 error）、语言前缀永久重定向、安全响应头与 CSP 策略；
 * ANALYZE=true 时包装 bundle-analyzer 用于包体积分析。
 */
import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";

/** 按需启用打包分析：仅当环境变量 ANALYZE==="true" 时包装配置，正常构建零开销 */
const withBundleAnalyzer = (config: NextConfig): NextConfig =>
  process.env.ANALYZE === "true" ? createBundleAnalyzer({ enabled: true })(config) : config;

const nextConfig: NextConfig = {
  // 新版缓存组件模式（配合页面级 cacheLife/cacheTag 使用）
  cacheComponents: true,

  // 隐藏 x-powered-by 响应头，减少技术栈暴露
  poweredByHeader: false,
  compiler: {
    // 生产构建剔除 console，仅保留 error 级别输出
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  images: {
    // 优先输出 AVIF，浏览器不支持时回退 WebP
    formats: ["image/avif", "image/webp"],

    // 响应式图片断点集合（覆盖移动端到 1200px 内容宽度）
    deviceSizes: [640, 750, 828, 1200],

    // 允许任意 https 远程图片域名（文章封面来自外部图床）
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    // 内联临界 CSS，减少首屏额外请求
    inlineCss: true,
    // 启用 global-not-found.tsx（根布局层 404 兜底页）
    globalNotFound: true,
  },

  // 历史语言前缀路径永久重定向到无前缀路径；/rss.xml 兼容旧订阅地址
  async redirects() {
    return [
      { source: "/zh", destination: "/", permanent: true },
      { source: "/en", destination: "/", permanent: true },
      { source: "/zh/:path*", destination: "/:path*", permanent: true },
      { source: "/en/:path*", destination: "/:path*", permanent: true },
      { source: "/rss.xml", destination: "/rss", permanent: false },
    ];
  },

  // 全站安全响应头：点击劫持/ MIME 嗅探/引用策略/HSTS/CSP 等基础加固
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // 禁止任何页面被 iframe 嵌入
          { key: "X-Frame-Options", value: "DENY" },

          // 禁止浏览器嗅探响应 MIME 类型
          { key: "X-Content-Type-Options", value: "nosniff" },

          // 跨站跳转仅发送来源域名，不发完整路径
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          { key: "X-DNS-Prefetch-Control", value: "on" },

          // HSTS：两年内强制 HTTPS
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000",
          },

          // 关闭摄像头/麦克风/定位等敏感浏览器能力
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },

          {
            key: "Content-Security-Policy",
            value: [
              // 默认仅允许同源资源
              "default-src 'self'",

              // 脚本允许同源+内联（RSC/ hydration 需要）；开发环境额外放开 eval
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

/** 最终导出：经 bundle-analyzer 按需包装后的 Next.js 配置 */
export default withBundleAnalyzer(nextConfig);
