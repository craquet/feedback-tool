import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "./route";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

beforeAll(() => {
  process.env.ADMIN_PASSWORD = "test-password";
  process.env.ADMIN_SESSION_SECRET = "test-secret";
});

function makeLoginRequest(password: unknown): Request {
  return new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

describe("POST /api/admin/login", () => {
  it("sets a signed session cookie for the correct password", async () => {
    const response = await POST(makeLoginRequest("test-password"));

    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
    const token = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))![1];
    expect(
      verifySessionToken(token, { secret: "test-secret", now: () => Date.now() }),
    ).toBe(true);
  });

  it("rejects a wrong password with 401 and sets no cookie", async () => {
    const response = await POST(makeLoginRequest("wrong"));

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a non-string password with 400", async () => {
    const response = await POST(makeLoginRequest(42));

    expect(response.status).toBe(400);
  });
});
