import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Emulates the backend's session cookie. The value is an opaque placeholder
 * (no credentials or personal data) so middleware can guard routes in mock mode.
 */
export function setMockSession(userId: string, remember: boolean) {
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
  const token = `mock.${userId}.${Math.random().toString(36).slice(2)}`;
  document.cookie = `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  return new Date(Date.now() + maxAge * 1000).toISOString();
}

export function getMockSessionUserId(): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const [, userId] = match.slice(SESSION_COOKIE.length + 1).split(".");
  return userId ?? null;
}

export function clearMockSession() {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
