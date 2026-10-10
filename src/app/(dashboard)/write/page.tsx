import "@/app/styles/hljs-theme.css";
import type { PostData } from "@shared";
import { requireUserOrRedirect } from "@server/auth/auth.guard";
import { getPostForViewer } from "@server/post/post.cache";
import { WriteEditor } from "@/components/dashboard/WriteEditor";

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUserOrRedirect("/write");

  const query = await searchParams;

  const editId = typeof query.id === "string" ? query.id : undefined;

  let initialPost: PostData | null = null;

  if (editId) {
    const editingPost = await getPostForViewer(editId).catch(() => null);

    if (editingPost && editingPost.post.authorId === user.id) {
      initialPost = editingPost;
    }
  }

  return <WriteEditor editId={editId ?? null} initialPost={initialPost} />;
}
