import { NextResponse, type NextRequest } from "next/server";
import {
  BackendUnavailable,
  callBackend,
  forwardError,
  problem,
  rejectCrossSite,
  setSessionCookie,
} from "@/lib/server/backend-auth";
import type { AuthResponse, User } from "@/features/auth/types";

/** Backend login response (SystemAuthController::login). */
interface BackendLoginResponse {
  token_type: "Bearer";
  access_token: string;
  expires_at: string;
  user: User;
}

const DEVICE_NAME = "ebudget-web";

/**
 * POST /api/auth/login → POST {backend}/api/v1/{system}/auth/login
 *
 * Body: { email, password, remember }. Answers { user, expiresAt } and sets
 * the httpOnly session cookie; the access token never reaches the browser.
 * Backend errors (422 invalid credentials / validation, 429 throttling) are
 * passed through as problem details.
 */
export async function POST(request: NextRequest) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return problem(415, "bad_request", "Send the credentials as JSON.");
  }
  const { email, password, remember } = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

  try {
    // Only the fields the backend accepts (LoginRequest: email, password, device_name).
    const result = await callBackend(request, "auth/login", {
      method: "POST",
      body: {
        email: typeof email === "string" ? email : "",
        password: typeof password === "string" ? password : "",
        device_name: DEVICE_NAME,
      },
    });
    if (result.status !== 200) return forwardError(result);

    const data = result.body as Partial<BackendLoginResponse> | null;
    const expiresAt = data?.expires_at ? new Date(data.expires_at) : null;
    if (!data?.access_token || !data.user || !expiresAt || Number.isNaN(expiresAt.getTime())) {
      return problem(502, "bad_gateway", "The eBudget server sent an unexpected response.");
    }

    const body: AuthResponse = { user: data.user, expiresAt: expiresAt.toISOString() };
    const response = NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
    setSessionCookie(response, data.access_token, expiresAt, remember === true);
    return response;
  } catch (error) {
    if (error instanceof BackendUnavailable) return error.response;
    throw error;
  }
}
