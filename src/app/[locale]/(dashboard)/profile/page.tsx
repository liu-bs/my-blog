import { Container } from "@/components/ui/Container";
import { getTranslations, getLocale } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import type { Locale } from "@/i18n/config";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import {
  listPostsByAuthorServer,
  listFavoritePostsServer,
  listDraftsServer,
} from "@server/blog/blog.cache";
import { ProfilePageContent } from "@/components/dashboard/ProfilePageContent";

export const instant = false;

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations("profile");

  const currentLocale = (await getLocale()) as Locale;

  const user = await requireUserOrRedirect(locale, `/${locale}/profile`);

  const [published, favoritesData, draftsData] = await Promise.all([
    listPostsByAuthorServer(user.id).catch(() => []),
    listFavoritePostsServer().catch(() => ({ posts: [] })),
    listDraftsServer().catch(() => ({ posts: [] })),
  ]);

  const favorites = favoritesData.posts ?? [];
  const drafts = draftsData.posts ?? [];

  return (
    <Container className="page-section">

      <ProfilePageContent
        user={user}
        published={published}
        favorites={favorites}
        drafts={drafts}
        locale={currentLocale}
        t={t}
      />
    </Container>
  );
}
