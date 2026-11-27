import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT as changePassword } from "@/app/api/auth/password/route";
import { SESSION_COOKIE } from "@/lib/auth/session";

/** PUT /api/auth/password → backend PUT /auth/password, with the backend replaced by a fetch stub. */
const ORIGIN = "http://localhost:3000";
const BACKEND = "http://backend.test/api/v1";

const request = (body: string) =>
  new NextRequest(`${ORIGIN}/api/auth/password`, {
    method: "PUT",
    headers: { origin: ORIGIN, "x-requested-with": "XMLHttpRequest", "content-type": "application/json", cookie: `${SESSION_COOKIE}=1|token` },
    body,
  });

describe("password route (src/app/api/auth/password)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubEnv("BACKEND_API_URL", BACKEND);
    vi.stubEnv("BACKEND_SYSTEM", "ebudget");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends only the three password fields with the bearer token and answers 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const body = JSON.stringify({ current_password: "old", password: "New-Passw0rd!x", password_confirmation: "New-Passw0rd!x", extra: "dropped" });
    const res = await changePassword(request(body));
    expect(res.status).toBe(204);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BACKEND}/ebudget/auth/password`);
    expect(init.method).toBe("PUT");
    expect(init.headers.get("Authorization")).toBe("Bearer 1|token");
    expect(JSON.parse(init.body)).toEqual({ current_password: "old", password: "New-Passw0rd!x", password_confirmation: "New-Passw0rd!x" });
  });

  it("passes the backend's 422 field errors through", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 422, code: "validation_failed", errors: { current_password: ["The password is incorrect."] } }), {
        status: 422,
        headers: { "content-type": "application/problem+json" },
      }),
    );
    const res = await changePassword(request(JSON.stringify({ current_password: "x", password: "y", password_confirmation: "y" })));
    expect(res.status).toBe(422);
    expect((await res.json()).errors.current_password[0]).toMatch(/incorrect/);
  });
});
