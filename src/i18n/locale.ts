import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "./routing";
import type { Locale } from "./config";

export function assertLocale(locale: string): asserts locale is Locale {
  if (!hasLocale(routing.locales, locale)) notFound();
}
