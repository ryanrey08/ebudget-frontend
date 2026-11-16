/**
 * Name of the session cookie checked by middleware to guard protected routes.
 * In real auth mode it holds the backend's bearer token and is set by the
 * Next.js auth proxy as httpOnly (+ Secure in production), so scripts cannot
 * read it. The mock API sets a non-sensitive placeholder from the browser.
 */
export const SESSION_COOKIE = "ebudget_session";

/** Query parameter used to send the user back after signing in. */
export const REDIRECT_PARAM = "next";

/** Only allow same-origin relative redirects. */
export function sanitizeRedirect(target: string | null | undefined, fallback: string): string {
  if (!target || !target.startsWith("/") || target.startsWith("//")) return fallback;
  return target;
}
