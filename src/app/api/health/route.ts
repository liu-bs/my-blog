import { NextResponse } from "next/server";
import { sendSuccess } from "@server/common/http/api-response";
import { logger } from "@server/common/logger";
import { getPrisma } from "@server/common/db";

export async function GET() {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
  } catch (err) {

    logger.error("Health check failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { code: 503, data: null, message: "Service unavailable" },
      {
        status: 503,
      },
    );
  }

  return sendSuccess({ status: "ok" }, "OK");
}
