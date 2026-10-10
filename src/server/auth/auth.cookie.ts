import "server-only";

import type { NextResponse } from "next/server";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

import type { User } from "@shared";
import { AUTH_TOKEN_COOKIE, AUTH_STATUS_COOKIE } from "@shared";
import { env } from "@server/common/config/env";
import { signToken } from "@server/common/token";

function cookieOptions(overrides: { httpOnly: boolean; maxAge?: number }) {
  return {
    secure: env.isProd,
    sameSite: "lax" as const,
    path: "/" as const,
    maxAge: env.COOKIE_MAX_AGE,
    ...overrides,
  };
}

function issueToken(user: User): string {
  return signToken({ id: user.id, tokenVersion: user.tokenVersion ?? 0 });
}

export function setAuthCookiesOnResponse(response: NextResponse, user: User): void {
  response.cookies.set(AUTH_TOKEN_COOKIE, issueToken(user), cookieOptions({ httpOnly: true }));
  response.cookies.set(AUTH_STATUS_COOKIE, "1", cookieOptions({ httpOnly: false }));
}

export function setAuthCookiesOnStore(cookieStore: ReadonlyRequestCookies, user: User): void {
  cookieStore.set(AUTH_TOKEN_COOKIE, issueToken(user), cookieOptions({ httpOnly: true }));
  cookieStore.set(AUTH_STATUS_COOKIE, "1", cookieOptions({ httpOnly: false }));
}

export function clearAuthCookiesOnStore(cookieStore: ReadonlyRequestCookies): void {
  cookieStore.set(AUTH_TOKEN_COOKIE, "", cookieOptions({ httpOnly: true, maxAge: 0 }));
  cookieStore.set(AUTH_STATUS_COOKIE, "", cookieOptions({ httpOnly: false, maxAge: 0 }));
}
