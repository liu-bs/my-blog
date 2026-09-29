/**
 * @file api/health/route.ts
 * @description 健康检查接口，供部署平台 / 探针判断服务与数据库是否可用
 */
import { NextResponse } from "next/server";
import { sendSuccess } from "@server/common/http/api-response";
import { logger } from "@server/common/logger";
import { getPrisma } from "@server/common/db";

/**
 * 健康检查（GET /api/health）
 * @description 用一条最轻量的 `SELECT 1` 探活数据库；只有数据库连通才算健康，避免进程存活但下游不可用的假阳性
 * @returns 统一响应体：正常时 { code: 0, data: { status: "ok" }, message: "OK" }；数据库异常时返回 503
 */
export async function GET() {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
  } catch (err) {
    /** 数据库不可达时记日志并返回 503，让探针能据此重启或摘流 */
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
