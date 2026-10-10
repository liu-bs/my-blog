import "server-only";

import { cacheLife, cacheTag, updateTag } from "next/cache";

import type { CommentsListData } from "@shared";
import { listComments } from "./comment.service";

const COMMENTS_LIFE = { stale: 300, revalidate: 300, expire: 86_400 } as const;

export function invalidateCommentsCache(postId: string): void {
  updateTag(`comments:${postId}`);
}

export async function listCommentsCached(postId: string, limit: number): Promise<CommentsListData> {
  "use cache";
  cacheTag(`comments:${postId}`);
  cacheLife(COMMENTS_LIFE);
  return listComments({ postId, limit, offset: 0 });
}
