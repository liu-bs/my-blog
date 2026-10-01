/**
 * @file layout.tsx
 * @description 多语言根布局：校验 locale、注入 next-intl 国际化消息与全站 Providers，
 *              渲染 html/body、Navbar（Suspense 包裹以避免 usePathname 中止预渲染）、Footer；
 *              同时定义全站级 SEO 元数据（canonical/hreflang/OG/Twitter）与视口配置
 */
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, getLocale } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import "@/app/globals.css";
import { Navbar } from "@/components/layouts/Navbar";
import { Footer } from "@/components/layouts/Footer";
import { Providers } from "@/components/Providers";
import { htmlLang, ogLocale, type Locale } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/config/site";
import { THEME_INIT_SCRIPT } from "@/app/errorPageShell";

type Props = {
  children: React.ReactNode;

  params: Promise<{ locale: string }>;
};

/** 预生成所有 locale 的静态参数，支撑 PPR/SSG */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * 生成全站基础元数据
 * @param params 路由参数，含 locale
 * @returns 站点标题/描述、canonical 与各语言 hreflang 互链、OG/Twitter 卡片配置
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;

  assertLocale(rawLocale);

  const t = await getTranslations("meta");

  const locale = (await getLocale()) as Locale;

  return {
    title: t("siteTitle"),
    description: t("siteDescription"),

    metadataBase: new URL(SITE_URL),

    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
        "x-default": `/${routing.defaultLocale}`,
      },
    },
    openGraph: {
      title: t("siteTitle"),
      description: t("siteDescription"),
      type: "website",
      locale: ogLocale(locale),
      siteName: t("siteTitle"),
      images: [
        {
          url: "/og-default.png",
          width: 1200,
          height: 630,
          alt: t("ogImageAlt"),
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title: t("siteTitle"),
      description: t("siteDescription"),
      images: ["/og-default.png"],
    },

    robots: {
      index: true,
      follow: true,
    },
  };
}

/** 移动端视口配置：宽度跟随设备、禁止初始缩放 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * 多语言根布局组件
 * @param children 子路由内容
 * @param params 路由参数，含 locale
 * @returns 完整 html 骨架：主题防闪烁脚本、intl Provider、全站 Providers、
 *          无障碍跳转链接、Suspense 包裹的 Navbar 与 Footer
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // locale 非法时直接抛错，交由错误边界/404 处理
  assertLocale(locale);

  const messages = await getMessages();
  const t = await getTranslations("nav");

  return (
    <html
      lang={htmlLang(locale as Locale)}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className="font-sans"
    >
      <body className="antialiased">
        {/* 主题防闪烁脚本：首帧渲染前根据偏好设置 dark 类 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-(--z-skip) focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-page"
            >
              {t("skipToContent")}
            </a>

            {/* Navbar 内部使用 usePathname，置于 Suspense 中避免中止静态预渲染 */}
            <Suspense fallback={null}>
              <Navbar />
            </Suspense>

            <main id="main-content" className="min-h-[calc(100vh-var(--nav-h))] pb-12">
              {children}
            </main>

            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
