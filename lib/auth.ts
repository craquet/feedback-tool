import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "fb_admin_session";

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

export interface SessionTokenOptions {
  secret: string;
  ttlMs: number;
  now: () => number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(options: SessionTokenOptions): string {
  const { secret, ttlMs, now } = options;
  const payload = Buffer.from(
    JSON.stringify({ exp: now() + ttlMs }),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string,
  options: Omit<SessionTokenOptions, "ttlMs">,
): boolean {
  const { secret, now } = options;
  const parts = token.split(".");
  if (parts.length !== 2) {
    return false;
  }
  const [payload, signature] = parts;
  const expected = sign(payload, secret);
  if (!safeEquals(signature, expected)) {
    return false;
  }
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      exp: number;
    };
    return typeof exp === "number" && exp > now();
  } catch {
    return false;
  }
}

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function verifyAdminPassword(
  provided: string,
  expected: string | undefined,
): boolean {
  if (!expected) {
    return false;
  }
  return safeEquals(provided, expected);
}

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isSessionValid(request: Request, secret: string | undefined): boolean {
  if (!secret) {
    return false;
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  const token = match?.slice(SESSION_COOKIE_NAME.length + 1);
  if (!token) {
    return false;
  }
  return verifySessionToken(token, { secret, now: () => Date.now() });
}
