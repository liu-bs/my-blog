/**
 * @file (dashboard)/write/page.tsx
 * @description 写作页（Server Component，受保护）。承载「新建」与「编辑」两种模式：
 * 通过查询参数 ?id= 判定是否为编辑模式，编辑模式下预取文章初值（含本人草稿）交给客户端编辑器 WriteEditor。
 */
import "@/app/styles/hljs-theme.css"; // 代码块高亮主题，供编辑器正文与预览区使用
import { assertLocale } from "@/i18n/locale";
import type { PostData } from "@shared";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import { getPostServer } from "@server/blog/blog.cache";
import { WriteEditor } from "@/components/dashboard/WriteEditor";

/**
 * 写作 / 编辑页
 * @description 流程：先做服务端登录校验（无会话则带 redirect 回跳参数跳登录页），再解析 ?id= 决定编辑模式。
 * 与公开详情页的关键差异是这里用的是带登录态的 getPostServer：它会注入当前用户，
 * 因此草稿仅作者本人可读——他人的草稿会以 404 抛出并被 catch 成 null（此时退化为新建空编辑器）。
 * 若不存在 ?id= 或预取失败，则按新建处理（initialPost 为 null）。
 * @param params 动态路由参数，含 locale
 * @param searchParams 查询参数：id 为待编辑文章的编码后 ID
 * @returns 编辑器 JSX
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

  const user = await requireUserOrRedirect(locale, `/${locale}/write`);

  const sp = await searchParams;
  /** 待编辑文章 ID；重复参数会形成数组，非字符串一律视为未传（即新建模式） */
  const editId = typeof sp.id === "string" ? sp.id : undefined;

  /** 编辑器初始文章，null 表示新建 */
  let initialPost: PostData | null = null;

  // 仅编辑模式才预取；取不到（不存在 / 非本人草稿）时降级为 null，交给编辑器自行处理
  if (editId) {
    const data = await getPostServer(editId).catch(() => null);
    // 已发布文章对任何人可读，但编辑态只对作者开放；非作者进编辑器保存必然 403，
    // 这里提前按「取不到」处理，让页面降级为空态而不是一个注定失败的表单
    if (data && data.post.authorId === user.id) {
      initialPost = data;
    }
  }

  return <WriteEditor editId={editId ?? null} initialPost={initialPost} />;
}
