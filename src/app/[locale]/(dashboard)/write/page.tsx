import "@/app/styles/hljs-theme.css"; 
import { assertLocale } from "@/i18n/locale";
import type { PostData } from "@shared";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import { getPostServer } from "@server/blog/blog.cache";
import { WriteEditor } from "@/components/dashboard/WriteEditor";

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

  const editId = typeof sp.id === "string" ? sp.id : undefined;

  let initialPost: PostData | null = null;

  if (editId) {
    const data = await getPostServer(editId).catch(() => null);

    if (data && data.post.authorId === user.id) {
      initialPost = data;
    }
  }

  return <WriteEditor editId={editId ?? null} initialPost={initialPost} />;
}
