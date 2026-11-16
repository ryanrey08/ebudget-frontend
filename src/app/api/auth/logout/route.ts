import { NextResponse, type NextRequest } from "next/server";
import {
  BackendUnavailable,
  callBackend,
  clearSessionCookie,
  readSessionToken,
  rejectCrossSite,
} from "@/lib/server/backend-auth";

/**
 * POST /api/auth/logout → POST {backend}/api/v1/{system}/auth/logout
 *
 * Revokes the current token on the backend (204) and always clears the
 * session cookie, even when the token had already expired (401). If the
 * backend cannot be reached the cookie is still cleared and 503 is returned;
 * the token then simply expires at its `expires_at`.
 */
export async function POST(request: NextRequest) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const token = readSessionToken(request);
  let response: NextResponse;
  if (!token) {
    response = new NextResponse(null, { status: 204 });
  } else {
    try {
      const result = await callBackend(request, "auth/logout", { method: "POST", token });
      response = result.status === 204 || result.status === 401 || result.status === 200
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json(result.body ?? { status: result.status, detail: "Sign-out failed." }, { status: result.status });
    } catch (error) {
      if (!(error instanceof BackendUnavailable)) throw error;
      response = error.response;
    }
  }
  clearSessionCookie(response);
  return response;
}
