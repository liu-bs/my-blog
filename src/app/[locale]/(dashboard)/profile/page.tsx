/**
 * @file (dashboard)/profile/page.tsx
 * @description 个人资料页（Server Component，受保护）。服务端先校验登录态（未登录直接重定向到登录页），
 * 再并行拉取当前用户的已发布文章、收藏列表与草稿箱，一并交给客户端内容组件渲染分栏视图。
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

/**
 * 关闭本 segment 的 instant 导航校验
 * @description 本页读取会话（requireUserOrRedirect）且根部挂载了 ssr:false 的 sonner Toaster，
 * 二者都无法被服务端预渲染，instant 校验必然 bail 到客户端渲染（dev 专属告警，构建与生产均不受影响）。
 * 按官方 route-segment-config/instant，显式声明 instant = false 表示「允许阻塞」即可消除该告警。
 */
export const instant = false;

/**
 * 个人资料页
 * @description 登录守卫在本页内完成：requireUserOrRedirect 在无有效会话时抛出跳转（带 redirect 回跳地址与 stale=1 标记），
 * 因此页面余下逻辑可以安全地假定 user 存在。三份列表相互独立故并行获取；任一份失败都降级为空数组，
 * 避免收藏、草稿这些次要区块的抖动拖垮整个页面。
 * @param params 动态路由参数，含 locale
 * @returns 资料页 JSX
 */
export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations("profile");
  /** 以 next-intl 请求上下文的语言为准，并收窄为 Locale 联合类型后传给客户端组件 */
  const currentLocale = (await getLocale()) as Locale;

  const user = await requireUserOrRedirect(locale, `/${locale}/profile`);

  // 已发布文章、收藏、草稿三路并行；默认分页即「全部」，故不额外传分页参数
  const [published, favoritesData, draftsData] = await Promise.all([
    listPostsByAuthorServer(user.id).catch(() => []),
    listFavoritePostsServer().catch(() => ({ posts: [] })),
    listDraftsServer().catch(() => ({ posts: [] })),
  ]);

  const favorites = favoritesData.posts ?? [];
  const drafts = draftsData.posts ?? [];

  return (
    <Container className="page-section">
      {/* t 为 profile 命名空间的翻译函数，直接透传给客户端内容组件使用 */}
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
