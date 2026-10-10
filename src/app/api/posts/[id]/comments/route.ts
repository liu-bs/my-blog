import { defineRoute } from "@server/common/http/route-handler";
import { requireId } from "@server/common/action-result";
import { sendSuccess } from "@server/common/http/api-response";
import { listComments } from "@server/comment/comment.service";
import { parseNonNegativeInt } from "@shared";

export const GET = defineRoute<{ id: string }>(
  async ({ auth, params, request }) => {
    const postId = requireId(params.id, "Post not found");
    const search = new URL(request.url).searchParams;

    const commentsPage = await listComments({
      postId,
      viewerId: auth?.id,
      limit: parseNonNegativeInt(search.get("limit")),
      offset: parseNonNegativeInt(search.get("offset")),
    });

    return sendSuccess(commentsPage, "Comments fetched");
  },

  { auth: "optional" },
);
