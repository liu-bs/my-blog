import { Container } from "@/components/ui/Container";
import { requireUserOrRedirect } from "@server/auth/auth.guard";
import {
  listPostsByAuthor,
  listFavoritedPostsForViewer,
  listDraftsForViewer,
} from "@server/post/post.cache";
import { ProfilePageContent } from "@/components/dashboard/ProfilePageContent";

export const instant = false;

export default async function ProfilePage() {
  const user = await requireUserOrRedirect("/profile");

  const [publishedPosts, favoritesResult, draftsResult] = await Promise.all([
    listPostsByAuthor(user.id).catch(() => []),
    listFavoritedPostsForViewer().catch(() => ({ posts: [] })),
    listDraftsForViewer().catch(() => ({ posts: [] })),
  ]);

  const favorites = favoritesResult.posts ?? [];
  const drafts = draftsResult.posts ?? [];

  return (
    <Container className="page-section">
      <ProfilePageContent
        user={user}
        publishedPosts={publishedPosts}
        favorites={favorites}
        drafts={drafts}
      />
    </Container>
  );
}
