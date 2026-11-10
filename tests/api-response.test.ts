import { describe, expect, it } from "vitest";
import { defaultNormalizeResponse } from "@/lib/api/api-response";
import { ApiRequestError, errorFromResponse, toPlainApiError } from "@/lib/api/api-error";

describe("response normalization", () => {
  it("unwraps the { success, data } envelope", () => {
    expect(defaultNormalizeResponse({ success: true, data: { id: "a" } })).toEqual({ id: "a" });
  });

  it("converts envelope + Laravel meta into Paginated", () => {
    const body = { success: true, data: [{ id: 1 }], meta: { current_page: 2, per_page: 10, total: 11, last_page: 2 } };
    expect(defaultNormalizeResponse(body)).toEqual({ items: [{ id: 1 }], total: 11, page: 2, pageSize: 10 });
  });

  it("converts a Laravel resource collection and a raw paginator", () => {
    expect(defaultNormalizeResponse({ data: [1, 2], links: {}, meta: { current_page: 1, per_page: 2, total: 5 } })).toEqual({
      items: [1, 2], total: 5, page: 1, pageSize: 2,
    });
    expect(defaultNormalizeResponse({ data: [1], current_page: 3, per_page: 1, total: 9, last_page: 9 })).toEqual({
      items: [1], total: 9, page: 3, pageSize: 1,
    });
  });

  it("unwraps a JsonResource and leaves plain objects alone", () => {
    expect(defaultNormalizeResponse({ data: { id: "x" } })).toEqual({ id: "x" });
    const plain = { items: [], total: 0, page: 1, pageSize: 10 };
    expect(defaultNormalizeResponse(plain)).toBe(plain);
    expect(defaultNormalizeResponse({ message: "ok" })).toEqual({ message: "ok" });
  });

  it("turns success: false into a validation error", () => {
    expect(() => defaultNormalizeResponse({ success: false, message: "Nope", errors: { a: ["bad"] } })).toThrowError(ApiRequestError);
    try {
      defaultNormalizeResponse({ success: false, message: "Nope", errors: { a: ["bad"] } });
    } catch (e) {
      expect(toPlainApiError(e)).toMatchObject({ status: 422, code: "VALIDATION", message: "Nope", fieldErrors: { a: "bad" } });
    }
  });
});

describe("error normalization", () => {
  it("keeps backend messages and flattens Laravel field errors", () => {
    const err = errorFromResponse(422, { message: "The given data was invalid.", errors: { email: ["Taken.", "Other"] } });
    expect(err.toJSON()).toEqual({ status: 422, code: "VALIDATION", message: "The given data was invalid.", fieldErrors: { email: "Taken." } });
  });

  it("hides server internals on 5xx responses", () => {
    const err = errorFromResponse(500, { message: "SQLSTATE[42S02]: Base table not found", trace: ["..."] });
    expect(err.message).toBe("The server encountered an error. Please try again later.");
    expect(err.code).toBe("SERVER_ERROR");
  });

  it("maps statuses to codes", () => {
    expect(errorFromResponse(401, {}).code).toBe("UNAUTHORIZED");
    expect(errorFromResponse(403, {}).code).toBe("FORBIDDEN");
    expect(errorFromResponse(404, {}).code).toBe("NOT_FOUND");
    expect(errorFromResponse(409, {}).code).toBe("CONFLICT");
    expect(new ApiRequestError("FETCH_ERROR").code).toBe("NETWORK_ERROR");
    expect(new ApiRequestError("TIMEOUT_ERROR").code).toBe("TIMEOUT");
  });
});
