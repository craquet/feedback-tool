import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  verifyAdminPassword,
  isSessionValid,
} from "./auth";

const SECRET = "test-secret";
const PASSWORD = "correct horse battery staple";

describe("createSessionToken + verifySessionToken", () => {
  it("verifies a freshly created token before expiry", () => {
    const token = createSessionToken({ secret: SECRET, ttlMs: 60_000, now: () => 1_000 });

    expect(verifySessionToken(token, { secret: SECRET, now: () => 5_000 })).toBe(true);
  });

  it("rejects an expired token", () => {
    const token = createSessionToken({ secret: SECRET, ttlMs: 60_000, now: () => 1_000 });

    expect(verifySessionToken(token, { secret: SECRET, now: () => 61_001 })).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken({ secret: SECRET, ttlMs: 60_000, now: () => 1_000 });
    const [payload] = token.split(".");
    const tampered = `${Buffer.from("evil").toString("base64url")}.${payload}`;

    expect(verifySessionToken(tampered, { secret: SECRET, now: () => 2_000 })).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken({ secret: SECRET, ttlMs: 60_000, now: () => 1_000 });

    expect(verifySessionToken(token, { secret: "other-secret", now: () => 2_000 })).toBe(false);
  });

  it("rejects garbage tokens", () => {
    expect(verifySessionToken("garbage", { secret: SECRET, now: () => 2_000 })).toBe(false);
    expect(verifySessionToken("", { secret: SECRET, now: () => 2_000 })).toBe(false);
  });
});

describe("verifyAdminPassword", () => {
  it("accepts the configured password", () => {
    expect(verifyAdminPassword(PASSWORD, PASSWORD)).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyAdminPassword("wrong", PASSWORD)).toBe(false);
  });

  it("rejects when the expected password is not configured", () => {
    expect(verifyAdminPassword(PASSWORD, undefined)).toBe(false);
    expect(verifyAdminPassword(PASSWORD, "")).toBe(false);
  });
});

describe("isSessionValid", () => {
  it("accepts a request carrying a valid session cookie", () => {
    const token = createSessionToken({ secret: SECRET, ttlMs: 60_000, now: () => Date.now() });
    const request = new Request("http://localhost/api/x", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    expect(isSessionValid(request, SECRET)).toBe(true);
  });

  it("rejects requests without the cookie, with a bad token, or without a secret", () => {
    const token = createSessionToken({ secret: SECRET, ttlMs: 60_000, now: () => Date.now() });
    const withToken = new Request("http://localhost/api/x", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    expect(isSessionValid(new Request("http://localhost/api/x"), SECRET)).toBe(false);
    expect(isSessionValid(withToken, undefined)).toBe(false);
  });
});
