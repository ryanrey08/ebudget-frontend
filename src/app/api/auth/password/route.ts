import { NextResponse, type NextRequest } from "next/server";
import {
  BackendUnavailable,
  callBackend,
  clearSessionCookie,
  forwardError,
  problem,
  readSessionToken,
  rejectCrossSite,
} from "@/lib/server/backend-auth";

/**
 * PUT /api/auth/password → PUT {backend}/api/v1/{system}/auth/password
 *
 * Body: { current_password, password, password_confirmation }. 204 on
 * success: the backend revokes every other token of the user, and this one
 * keeps working. 422 per field (wrong current password, weak or breached new
 * password), 429 when throttled. Five wrong current passwords revoke the
 * token (401), which also clears the session cookie here.
 */
export async function PUT(request: NextRequest) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const token = readSessionToken(request);
  if (!token) return problem(401, "unauthenticated", "Authentication is required.");

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return problem(415, "invalid_body", "Send the passwords as a JSON object.");
  }
  const pick = (key: string) => (typeof body[key] === "string" ? body[key] : "");

  try {
    const result = await callBackend(request, "auth/password", {
      method: "PUT",
      token,
      body: {
        current_password: pick("current_password"),
        password: pick("password"),
        password_confirmation: pick("password_confirmation"),
      },
    });
    if (result.status === 204 || result.status === 200) return new NextResponse(null, { status: 204 });
    const response = forwardError(result);
    if (result.status === 401) clearSessionCookie(response);
    return response;
  } catch (error) {
    if (error instanceof BackendUnavailable) return error.response;
    throw error;
  }
}
