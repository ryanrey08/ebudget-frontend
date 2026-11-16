/**
 * Central place for API authentication state.
 *
 * Authentication itself does NOT use this token store: the backend's bearer
 * token is kept by the Next.js auth proxy in an httpOnly cookie
 * (src/lib/server/backend-auth.ts), so scripts never see it. This module
 * still carries the client's 401/403 session events, and `setAuthToken` is
 * kept for data APIs that may need an explicit bearer token later.
 *
 * Tokens are kept in memory and, so a reload keeps the session, in
 * sessionStorage (cleared when the tab closes). Nothing is ever hardcoded and
 * no token is stored in Redux or environment variables.
 */

const STORAGE_KEY = "ebudget.auth.token";

export type AuthEvent = "unauthorized" | "forbidden" | "token-changed";
type Listener = (event: AuthEvent) => void;

let token: string | null = null;
let loaded = false;
const listeners = new Set<Listener>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (!loaded) {
    token = storage()?.getItem(STORAGE_KEY) ?? null;
    loaded = true;
  }
  return token;
}

export function setAuthToken(next: string | null) {
  token = next;
  loaded = true;
  const s = storage();
  if (next) s?.setItem(STORAGE_KEY, next);
  else s?.removeItem(STORAGE_KEY);
  emitAuthEvent("token-changed");
}

export const clearAuthToken = () => setAuthToken(null);

/** Subscribe to session events raised by the API client (401/403). */
export function onAuthEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitAuthEvent(event: AuthEvent) {
  listeners.forEach((l) => l(event));
}
