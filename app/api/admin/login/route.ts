import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionToken,
  verifyAdminPassword,
} from "@/lib/auth";

export async function POST(request: Request): Promise<Response> {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !secret) {
    return NextResponse.json(
      { error: "Admin auth is not configured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { password: provided } = (body ?? {}) as { password?: unknown };
  if (typeof provided !== "string") {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  if (!verifyAdminPassword(provided, password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = createSessionToken({
    secret,
    ttlMs: SESSION_TTL_MS,
    now: () => Date.now(),
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return response;
}
