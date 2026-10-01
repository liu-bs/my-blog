/**
 * @file page.tsx
 * @description 写作/编辑页（Server Component）：服务端校验登录态后渲染编辑器；
 *              携带 ?id= 时进入编辑模式，从缓存函数读取文章，且仅当作者是本人时才注入初始数据
 */
import "@/app/styles/hljs-theme.css";
import { assertLocale } from "@/i18n/locale";
import type { PostData } from "@shared";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import { getPostServer } from "@server/blog/blog.cache";
import { WriteEditor } from "@/components/dashboard/WriteEditor";

/**
 * 写作页组件
 * @param params 路由参数，含 locale
 * @param searchParams 查询参数：id（编辑目标文章）
 * @returns 编辑器；编辑模式下注入作者本人的文章初始数据，否则为新建空白稿
 */
export default async function WritePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  assertLocale(locale);

  // 服务端登录校验：未登录重定向到登录页并回跳当前页
  const user = await requireUserOrRedirect(locale, `/${locale}/write`);

  const sp = await searchParams;

  const editId = typeof sp.id === "string" ? sp.id : undefined;

  let initialPost: PostData | null = null;

  // 编辑模式：仅当文章存在且归属当前用户时注入初始数据，防止越权拉取他人文章内容
  if (editId) {
    const data = await getPostServer(editId).catch(() => null);

    if (data && data.post.authorId === user.id) {
      initialPost = data;
    }
  }

  return <WriteEditor editId={editId ?? null} initialPost={initialPost} />;
}
