/**
 * @file [locale]/layout.tsx
 * @description 全站根布局（按语言分段）。负责生成 html 骨架、SEO metadata、语言相关静态参数，并自上而下挂载 next-intl / 业务 Provider、导航与页脚
 */
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, getLocale } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import "@/app/globals.css";
import { Navbar } from "@/components/layouts/Navbar";
import { Footer } from "@/components/layouts/Footer";
import { Providers } from "@/components/Providers";
import { RouteTransition } from "@/components/layouts/RouteTransition";
import { htmlLang, ogLocale, type Locale } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/config/site";
import { THEME_INIT_SCRIPT } from "@/app/errorPageShell";

/** LocaleLayout 入参 */
type Props = {
  /** 当前语言分段下的子路由内容 */
  children: React.ReactNode;

  /** 动态段参数，Next.js 16 中为 Promise，需 await 后才能取到 locale */
  params: Promise<{ locale: string }>;
};

/**
 * 预生成各语言的静态路由参数
 * @returns 每个 locale 一条 { locale }，配合 localePrefix "always" 在构建期产出 zh / en 两套页面
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * 生成站点级 metadata
 * @description 用 next-intl 读取 meta 命名空间文案；canonical 指向当前语言，alternates 声明各语言版本 + x-default，并附带 OpenGraph / Twitter 卡片
 * @param params 路由参数，await 后得到原始 locale
 * @returns Next.js Metadata 对象
 * @throws 传入非法 locale 时由 assertLocale 触发 notFound
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  /** 校验 locale 合法，非法直接走 404，避免脏参数进入后续逻辑 */
  assertLocale(rawLocale);

  const t = await getTranslations("meta");
  /** 经校验后的规范 locale，供 ogLocale / alternates 使用 */
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

/**
 * 全局 viewport 配置：跟随设备宽度、初始缩放 1，保证移动端不被缩放
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * LocaleLayout 根布局
 * @description 挂载顺序：NextIntlClientProvider（提供翻译上下文）→ Providers（主题等业务 Context）→ 跳转链接 / Navbar / main / Footer。先有翻译上下文再挂业务 Provider，保证后者可用 useTranslations
 * @param props {@link Props}
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  /** 非法 locale 直接 404，防止未定义语言渲染出空文案 */
  assertLocale(locale);

  /** 当前语言的全部文案，序列化后传给客户端 Provider */
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
        {/* 阻塞式主题初始化：在首帧绘制前给 <html> 挂 .dark，流式 SSR 下 next-themes 注入在 body 的脚本偏晚，仍有白闪 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            {/* 键盘可达性跳转链接：平时对屏幕阅读器隐藏，聚焦后浮出到左上角 */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-(--z-skip) focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-page"
            >
              {t("skipToContent")}
            </a>
            {/* 顶部导航，位于语言与业务 Provider 之内以使用翻译与主题 */}
            <Navbar />

            {/* 主内容区，锚点供跳转链接定位；最小高度扣掉导航高度避免页脚跳动 */}
            <main id="main-content" className="min-h-[calc(100vh-var(--nav-h))] pb-12">
              <RouteTransition>{children}</RouteTransition>
            </main>
            {/* 全站页脚 */}
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
