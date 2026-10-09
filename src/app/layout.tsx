/**
 * @file layout.tsx
 * @description 全站根布局（Root Layout），挂载于所有路由之上；负责注入全局样式、
 * 站点级 metadata/viewport、主题初始化脚本、导航/页脚骨架与 Provider 上下文。
 * 渲染模式：Server Component（服务端渲染，Navbar 内部自行降级为客户端组件并用 Suspense 包裹）。
 */
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@/app/globals.css";
import { Navbar } from "@/components/layouts/Navbar";
import { Footer } from "@/components/layouts/Footer";
import { Providers } from "@/components/Providers";
import { SITE_URL } from "@/config/site";
import { messages } from "@/texts";
import { pageAlternates } from "@/lib/seo";
import { THEME_INIT_SCRIPT } from "@/app/errorPageShell";

/**
 * 生成站点级默认 metadata（标题、描述、OpenGraph、Twitter 卡片、robots 指令）。
 * 子页面的 metadata 会与此深度/浅合并。
 * @returns 站点默认 Metadata 对象
 * @warning metadataBase 依赖 SITE_URL（来自 NEXT_PUBLIC_BASE_URL 环境变量），
 * 未配置时回退为 localhost，会导致部署环境相对 OG 地址解析错误。
 */
export function generateMetadata(): Metadata {
  return {
    title: messages.meta.siteTitle,
    description: messages.meta.siteDescription,

    metadataBase: new URL(SITE_URL),

    alternates: pageAlternates("/"),
    openGraph: {
      title: messages.meta.siteTitle,
      description: messages.meta.siteDescription,
      type: "website",
      locale: "zh_CN",
      siteName: messages.meta.siteTitle,
      images: [
        {
          url: "/og-default.png",
          width: 1200,
          height: 630,
          alt: messages.meta.ogImageAlt,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title: messages.meta.siteTitle,
      description: messages.meta.siteDescription,
      images: ["/og-default.png"],
    },

    robots: {
      index: true,
      follow: true,
    },
  };
}

/** 全局 viewport 元信息：适配设备宽度、初始缩放 1:1 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * 全站根布局组件
 * @param props children - 当前路由页面的 React 节点
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth" className="font-sans">
      <body className="antialiased">
        {/* 主题初始化脚本：在首帧前读取 localStorage 应用 dark 类，避免明暗主题闪烁 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>
          {/* 无障碍跳转链接：键盘用户可跳过导航直达主内容区 */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-(--z-skip) focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-page"
          >
            {messages.nav.skipToContent}
          </a>

          {/* 顶部导航栏：客户端组件，用 Suspense 占位避免阻塞服务端渲染 */}
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>

          {/* 主内容区：预留导航栏高度，子路由页面渲染于此 */}
          <main id="main-content" className="min-h-[calc(100vh-var(--nav-h))] pb-12">
            {children}
          </main>

          {/* 全站页脚 */}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
