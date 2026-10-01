import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {

  const requested = (await rootLocale().catch(() => undefined)) ?? (await requestLocale);

  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const messages = (await import(`./messages/${locale}`)).default;
  return { locale, messages };
});
