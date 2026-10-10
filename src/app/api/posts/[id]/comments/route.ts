import { defineRoute, requireId } from "@server/common/http/route-handler";
import { sendSuccess } from "@server/common/http/api-response";
import { listComments } from "@server/comment/comment.service";
import { parseNonNegativeInt } from "@shared";

export const GET = defineRoute<{ id: string }>(
  async ({ auth, params, request }) => {
    const postId = requireId(params);
    const search = new URL(request.url).searchParams;

    const data = await listComments({
      postId,

      user: auth ?? undefined,
      limit: parseNonNegativeInt(search.get("limit")),
      offset: parseNonNegativeInt(search.get("offset")),
    });

    return sendSuccess(data, "获取成功");
  },

  { auth: "optional" },
);
