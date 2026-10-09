/**
 * @file page.tsx
 * @description 个人中心页（路由 /profile），Server Component：服务端拉取当前用户
 * 及其已发布文章、收藏、草稿后交给 ProfilePageContent 渲染。需登录——未登录时
 * requireUserOrRedirect 会跳转到 /login?redirect=/profile&stale=1。
 */
import { Container } from "@/components/ui/Container";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import {
  listPostsByAuthorServer,
  listFavoritePostsServer,
  listDraftsServer,
} from "@server/blog/blog.cache";
import { ProfilePageContent } from "@/components/dashboard/ProfilePageContent";

/** 关闭 instant 缓存复用，保证每次请求都读取该用户的最新文章数据 */
export const instant = false;

/**
 * 个人中心页：并行获取发布/收藏/草稿三类数据并渲染
 */
export default async function ProfilePage() {
  // 服务端鉴权：取当前登录用户，未登录则重定向到登录页（登录后回到 /profile）
  const user = await requireUserOrRedirect("/profile");

  // 三类文章数据并行获取；任一失败降级为空数组，避免整页错误
  const [published, favoritesData, draftsData] = await Promise.all([
    listPostsByAuthorServer(user.id).catch(() => []),
    listFavoritePostsServer().catch(() => ({ posts: [] })),
    listDraftsServer().catch(() => ({ posts: [] })),
  ]);

  // 收藏/草稿返回的是 PostsListData 包装结构，统一解包出 posts 数组兜底
  const favorites = favoritesData.posts ?? [];
  const drafts = draftsData.posts ?? [];

  return (
    <Container className="page-section">
      {/* 个人中心内容区：展示用户信息、已发布、收藏与草稿列表 */}
      <ProfilePageContent user={user} published={published} favorites={favorites} drafts={drafts} />
    </Container>
  );
}
