import "server-only";

import type { NextRequest } from "next/server";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AuthPayload, SafeUser, User } from "@shared";
import { AUTH_TOKEN_COOKIE } from "@shared";
import { ForbiddenError, UnauthorizedError } from "@server/common/errors";
import { env } from "@server/common/config/env";
import { decodeToken, verifyToken } from "@server/common/token";
import { getUserById } from "@server/user/user.service";
import { ACCOUNT_DISABLED_MESSAGE, toSafeUser } from "./auth.service";

export const MISSING_TOKEN_MESSAGE = "Unauthorized, please log in first";

export const SESSION_EXPIRED_MESSAGE = "Login session has expired, please log in again";

export const SESSION_INVALID_MESSAGE = "Token is invalid, please log in again";

export const USER_WITHDRAWN_MESSAGE = "User not found, please log in again";

export interface Session {
  authPayload: AuthPayload;

  user: User;
}

type SessionFailure = "missing" | "expired" | "invalid" | "withdrawn" | "disabled" | "stale";

type SessionAssessment =
  { isUsable: true; session: Session } | { isUsable: false; failure: SessionFailure };

function isWithinRefreshGrace(payload: AuthPayload): boolean {
  if (typeof payload.exp !== "number") return false;
  return Math.floor(Date.now() / 1000) - payload.exp <= env.JWT_REFRESH_GRACE_SECONDS;
}

function readPayload(token: string, isRefreshFlow: boolean): SessionFailure | AuthPayload {
  const verification = verifyToken(token);
  if (verification.isValid) return verification.payload;

  if (!verification.isExpired) return "invalid";
  if (!isRefreshFlow) return "expired";

  const decoded = decodeToken(token);
  return decoded && isWithinRefreshGrace(decoded) ? decoded : "expired";
}

async function assessSession(
  token: string | undefined,
  isRefreshFlow: boolean,
): Promise<SessionAssessment> {
  if (!token) return { isUsable: false, failure: "missing" };

  const payload = readPayload(token, isRefreshFlow);
  if (typeof payload === "string") return { isUsable: false, failure: payload };

  const user = await getUserById(payload.id).catch(() => undefined);
  if (!user) return { isUsable: false, failure: "withdrawn" };
  if (user.disabled) return { isUsable: false, failure: "disabled" };
  if ((user.tokenVersion ?? 0) !== payload.tokenVersion) {
    return { isUsable: false, failure: "stale" };
  }

  return { isUsable: true, session: { authPayload: payload, user } };
}

function toSessionError(failure: SessionFailure): UnauthorizedError | ForbiddenError {
  switch (failure) {
    case "missing":
      return new UnauthorizedError(MISSING_TOKEN_MESSAGE);
    case "expired":
    case "stale":
      return new UnauthorizedError(SESSION_EXPIRED_MESSAGE);
    case "invalid":
      return new UnauthorizedError(SESSION_INVALID_MESSAGE);
    case "withdrawn":
      return new UnauthorizedError(USER_WITHDRAWN_MESSAGE);
    case "disabled":
      return new ForbiddenError(ACCOUNT_DISABLED_MESSAGE);
  }
}

async function requireSession(token: string | undefined, isRefreshFlow: boolean): Promise<Session> {
  const assessment = await assessSession(token, isRefreshFlow);
  if (!assessment.isUsable) throw toSessionError(assessment.failure);
  return assessment.session;
}

const readCookieToken = cache(async (): Promise<string | undefined> => {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_TOKEN_COOKIE)?.value;
});

const resolveSession = cache(async (): Promise<Session | null> => {
  const assessment = await assessSession(await readCookieToken(), false);
  return assessment.isUsable ? assessment.session : null;
});

export const getAuthPayload = cache(async (): Promise<AuthPayload | null> => {
  const session = await resolveSession();
  return session?.authPayload ?? null;
});

const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  const session = await resolveSession();
  return session ? toSafeUser(session.user) : null;
});

export async function requireAuthPayload(): Promise<AuthPayload> {
  const authPayload = await getAuthPayload();
  if (!authPayload) throw new UnauthorizedError();
  return authPayload;
}

export async function requireUserOrRedirect(redirectTo: string): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}&stale=1`);
  }
  return user;
}

export async function authenticate(request: NextRequest): Promise<AuthPayload> {
  const session = await requireSession(request.cookies.get(AUTH_TOKEN_COOKIE)?.value, false);
  return session.authPayload;
}

export async function tryAuthenticate(request: NextRequest): Promise<AuthPayload | null> {
  try {
    return await authenticate(request);
  } catch {
    return null;
  }
}

export function requireRefreshableSession(request: NextRequest): Promise<Session> {
  return requireSession(request.cookies.get(AUTH_TOKEN_COOKIE)?.value, true);
}
