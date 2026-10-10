import { defineRoute } from "@server/common/http/route-handler";
import { requireId } from "@server/common/action-result";
import { sendSuccess } from "@server/common/http/api-response";
import { getClientIp, isRateLimited } from "@server/common/rate-limit";
import { RATE_LIMITS } from "@server/common/policy";
import { recordPostView } from "@server/post/post.service";

export const POST = defineRoute<{ id: string }>(async ({ request, params }) => {
  const id = requireId(params.id, "Post not found");

  if (!(await isRateLimited(`view:${id}:${getClientIp(request)}`, RATE_LIMITS.postViewByIp))) {
    await recordPostView(id);
  }

  return sendSuccess(null, "View recorded");
});
