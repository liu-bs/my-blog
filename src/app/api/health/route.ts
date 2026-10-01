/**
 * @file route.ts
 * @description 健康检查接口：GET /api/health。执行一条 Prisma 原生查询验证数据库连通性，
 *              供部署平台探活/监控使用；数据库不可用时返回 503
 */
import { NextResponse } from "next/server";
import { sendSuccess } from "@server/common/http/api-response";
import { logger } from "@server/common/logger";
import { getPrisma } from "@server/common/db";

/**
 * 健康检查
 * @returns 数据库连通时返回统一成功响应；失败时返回 503 并记录错误日志
 */
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
