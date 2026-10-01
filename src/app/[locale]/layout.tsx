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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-(--z-skip) focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-page"
            >
              {t("skipToContent")}
            </a>

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
