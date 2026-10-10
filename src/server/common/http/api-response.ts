import "server-only";
import { NextResponse } from "next/server";
import { isAppError, InternalServerError } from "@server/common/errors";
import { logger } from "@server/common/logger";

export function sendSuccess<T>(
  data: T,
  message = "Operation successful",
  status = 200,
  init?: { headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json({ code: 0, data, message }, { status, headers: init?.headers });
}

export function sendError(err: unknown): NextResponse {
  const reportedError = isAppError(err)
    ? err
    : new InternalServerError(err instanceof Error ? err.message : "Internal server error");

  if (reportedError.statusCode >= 500) {
    logger.error(reportedError.message, {
      code: reportedError.code,
      statusCode: reportedError.statusCode,
      stack: err instanceof Error ? err.stack : undefined,
    });
  } else {
    logger.warn(reportedError.message, {
      code: reportedError.code,
      statusCode: reportedError.statusCode,
    });
  }

  const message =
    reportedError.statusCode >= 500
      ? "Internal server error, please try again later"
      : reportedError.message;

  return NextResponse.json(
    {
      code: reportedError.statusCode,
      data: null,
      message,

      ...(reportedError.statusCode < 500 && reportedError.details
        ? { details: reportedError.details }
        : {}),
    },
    { status: reportedError.statusCode },
  );
}
