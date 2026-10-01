/**
 * @file page.tsx
 * @description 个人中心页（Server Component）：服务端校验登录态后并行读取
 *              我发布的文章/收藏/草稿三组数据（均走 'use cache' 缓存函数，失败兜底为空），
 *              交由客户端组件分区展示
 */
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

/** 关闭即时导航，进入页面前先完成认证拦截 */
export const instant = false;

/**
 * 个人中心页组件
 * @param params 路由参数，含 locale
 * @returns 已发布/收藏/草稿三个分区内容；未登录被重定向到登录页
 */
export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations("profile");

  const currentLocale = (await getLocale()) as Locale;

  // 服务端登录校验：未登录重定向到登录页并回跳当前页
  const user = await requireUserOrRedirect(locale, `/${locale}/profile`);

  // 三路缓存数据并行读取，个别失败时兜底为空，不阻塞整页渲染
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
