/**
 * @file route.ts (GET /api/health)
 * @description 服务健康检查路由：通过 Prisma 执行 `SELECT 1` 探测数据库连通性，
 * 供部署平台探针与监控系统调用。无鉴权、无限流。
 * 响应结构：正常 { code: 0, data: { status: "ok" }, message: "OK" }（200）；
 * 数据库不可用 { code: 503, data: null, message: "Service unavailable" }（503）。
 */
import { NextResponse } from "next/server";
import { sendSuccess } from "@server/common/http/api-response";
import { logger } from "@server/common/logger";
import { getPrisma } from "@server/common/db";

/**
 * GET /api/health
 * @returns 健康检查结果 JSON；DB 探测失败时记录错误日志并返回 503
 */
export async function GET() {
  try {
    // 最小化查询验证数据库连接可用
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
