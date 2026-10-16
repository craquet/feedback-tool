import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

const LOGIN_PATH = "/admin/login";

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname === "/embed") {
    const response = NextResponse.next();
    response.headers.set(
      "content-security-policy",
      "frame-ancestors https: http:",
    );
    return response;
  }

  if (!pathname.startsWith("/admin") || pathname === LOGIN_PATH) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;
  const authenticated =
    secret !== undefined &&
    token !== undefined &&
    verifySessionToken(token, { secret, now: () => Date.now() });

  if (authenticated) {
    const response = NextResponse.next();
    response.headers.set(
      "content-security-policy",
      "frame-ancestors 'none'",
    );
    return response;
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  const redirect = NextResponse.redirect(loginUrl);
  redirect.headers.set("content-security-policy", "frame-ancestors 'none'");
  return redirect;
}

export const config = {
  matcher: ["/admin/:path*", "/embed"],
};
