import "@/app/styles/hljs-theme.css";
import type { PostData } from "@shared";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import { getPostServer } from "@server/blog/blog.cache";
import { WriteEditor } from "@/components/dashboard/WriteEditor";

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {

  const user = await requireUserOrRedirect("/write");

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
