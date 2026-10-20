import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/auth";

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = "test-secret";
});

function adminRequest(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
  });
}

function validToken(): string {
  return createSessionToken({
    secret: "test-secret",
    ttlMs: 60_000,
    now: () => Date.now(),
  });
}

describe("proxy", () => {
  it("redirects unauthenticated /admin requests to the login page", () => {
    const response = proxy(adminRequest("/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/login");
  });

  it("redirects unauthenticated /admin subpages too", () => {
    const response = proxy(adminRequest("/admin/app-x"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/login");
  });

  it("lets requests through with a valid session cookie", () => {
    const response = proxy(adminRequest("/admin", validToken()));

    expect(response.status).not.toBe(307);
  });

  it("redirects on a tampered cookie", () => {
    const response = proxy(adminRequest("/admin", "tampered.token"));

    expect(response.status).toBe(307);
  });

  it("leaves non-admin paths untouched", () => {
    const response = proxy(adminRequest("/embed?k=x"));

    expect(response.status).not.toBe(307);
  });

  it("allows the embed page to be framed from other origins", () => {
    const response = proxy(adminRequest("/embed?k=x"));

    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors https:");
  });

  it("denies framing for authenticated admin pages", () => {
    const response = proxy(adminRequest("/admin", validToken()));

    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("denies framing for the login redirect", () => {
    const response = proxy(adminRequest("/admin"));

    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("does not redirect the login page itself — unauthenticated access must render the form", () => {
    const response = proxy(adminRequest("/admin/login"));

    expect(response.status).not.toBe(307);
  });

  it("returns 401 JSON for unauthenticated admin API routes", () => {
    const response = proxy(adminRequest("/api/admin/services/1/export"));

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("lets authenticated admin API routes through", () => {
    const response = proxy(
      adminRequest("/api/admin/feedback/1/screenshot", validToken()),
    );

    expect(response.status).not.toBe(401);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps the login and logout API routes public", () => {
    expect(proxy(adminRequest("/api/admin/login")).status).not.toBe(401);
    expect(proxy(adminRequest("/api/admin/logout")).status).not.toBe(401);
  });

  it("still leaves non-admin API routes untouched", () => {
    const response = proxy(adminRequest("/api/feedback"));

    expect(response.status).not.toBe(401);
  });
});
