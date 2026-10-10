import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@/app/globals.css";
import { Navbar } from "@/components/shell/Navbar";
import { Footer } from "@/components/shell/Footer";
import { Providers } from "@/components/Providers";
import { SITE_URL } from "@/config/site";
import meta from "@/texts/meta";
import nav from "@/texts/nav";
import { pageAlternates } from "@/lib/seo";
import { THEME_INIT_SCRIPT } from "@/app/error-page-shell";

export function generateMetadata(): Metadata {
  return {
    title: meta.siteTitle,
    description: meta.siteDescription,

    metadataBase: new URL(SITE_URL),

    alternates: pageAlternates("/"),
    openGraph: {
      title: meta.siteTitle,
      description: meta.siteDescription,
      type: "website",
      locale: "zh_CN",
      siteName: meta.siteTitle,
      images: [
        {
          url: "/og-default.png",
          width: 1200,
          height: 630,
          alt: meta.ogImageAlt,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title: meta.siteTitle,
      description: meta.siteDescription,
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth" className="font-sans">
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-(--z-skip) focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-page"
          >
            {nav.skipToContent}
          </a>

          <Suspense fallback={null}>
            <Navbar />
          </Suspense>

          <main id="main-content" className="min-h-[calc(100vh-var(--nav-h))] pb-12">
            {children}
          </main>

          <Footer />
        </Providers>
      </body>
    </html>
  );
}
