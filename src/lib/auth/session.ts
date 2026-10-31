/**
 * Name of the session cookie checked by middleware to guard protected routes.
 * In production the backend should set it as an httpOnly, Secure cookie; the
 * mock API sets a non-sensitive placeholder value from the browser instead.
 */
export const SESSION_COOKIE = "ebudget_session";

/** Query parameter used to send the user back after signing in. */
export const REDIRECT_PARAM = "next";

/** Only allow same-origin relative redirects. */
export function sanitizeRedirect(target: string | null | undefined, fallback: string): string {
  if (!target || !target.startsWith("/") || target.startsWith("//")) return fallback;
  return target;
}
