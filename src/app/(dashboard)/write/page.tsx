/**
 * @file page.tsx
 * @description 写作页（路由 /write），Server Component：鉴权后按 ?id= 查询参数判断
 * 新建或编辑模式；编辑模式下经 getPostServer 预取该文章作为编辑器初始内容，
 * 且仅当前登录用户是作者时生效。需登录——未登录时 requireUserOrRedirect
 * 跳转到 /login?redirect=/write&stale=1。
 */
// 引入代码块高亮主题样式，供编辑器/预览使用
import "@/app/styles/hljs-theme.css";
import type { PostData } from "@shared";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import { getPostServer } from "@server/blog/blog.cache";
import { WriteEditor } from "@/components/dashboard/WriteEditor";

/**
 * 写作页入口
 * @param props.searchParams Promise 形式的查询参数；实际字段：
 *   - id：可选，要编辑的文章 id；缺失或非法值表示新建文章
 */
export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 服务端鉴权：未登录重定向到登录页，登录后回到 /write
  const user = await requireUserOrRedirect("/write");

  const sp = await searchParams;

  // 仅接受字符串形式的 id；数组（?id=a&id=b）视为无效，按新建处理
  const editId = typeof sp.id === "string" ? sp.id : undefined;

  let initialPost: PostData | null = null;

  if (editId) {
    // 编辑模式：预取文章数据（含草稿），获取失败按新建处理
    const data = await getPostServer(editId).catch(() => null);

    // 越权防护：只有文章作者本人才能以编辑模式载入初始内容
    if (data && data.post.authorId === user.id) {
      initialPost = data;
    }
  }

  // 编辑器为客户端组件；editId 为 null 时表示新建
  return <WriteEditor editId={editId ?? null} initialPost={initialPost} />;
}
