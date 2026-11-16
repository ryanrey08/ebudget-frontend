import { NextResponse, type NextRequest } from "next/server";
import {
  BackendUnavailable,
  callBackend,
  clearSessionCookie,
  forwardError,
  problem,
  readSessionToken,
} from "@/lib/server/backend-auth";

/**
 * GET /api/auth/me → GET {backend}/api/v1/{system}/auth/me
 *
 * Answers the backend's `{ data: CurrentSystemUser }` unchanged. A 401 (token
 * expired, revoked or from another system) clears the session cookie so the
 * route guard stops treating the visitor as signed in.
 */
export async function GET(request: NextRequest) {
  const token = readSessionToken(request);
  if (!token) return problem(401, "unauthenticated", "Authentication is required.");

  try {
    const result = await callBackend(request, "auth/me", { method: "GET", token });
    if (result.status === 401) {
      const response = forwardError(result);
      clearSessionCookie(response);
      return response;
    }
    if (result.status !== 200) return forwardError(result);
    return NextResponse.json(result.body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BackendUnavailable) return error.response;
    throw error;
  }
}
