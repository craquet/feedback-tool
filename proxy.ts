import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth"

const LOGIN_PATH = "/admin/login"

// Endpoints under /api/admin that must remain reachable without a session.
const PUBLIC_API_PATHS = new Set(["/api/admin/login", "/api/admin/logout"])

export function proxy(request: NextRequest): NextResponse {
    const { pathname } = request.nextUrl

    if (pathname === "/embed") {
        const response = NextResponse.next()
        response.headers.set(
            "content-security-policy",
            "frame-ancestors https: http:",
        )
        return response
    }

    const isPage = pathname.startsWith("/admin") && pathname !== LOGIN_PATH
    const isApi =
        pathname.startsWith("/api/admin") && !PUBLIC_API_PATHS.has(pathname)

    // Optimistic pre-filter only — every admin page and route handler still
    // verifies the session itself (requireAdmin / isSessionValid).
    if (!isPage && !isApi) {
        return NextResponse.next()
    }

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    const secret = process.env.ADMIN_SESSION_SECRET
    const authenticated =
        secret !== undefined &&
        token !== undefined &&
        verifySessionToken(token, { secret, now: () => Date.now() })

    if (authenticated) {
        if (isApi) {
            return NextResponse.next()
        }
        const response = NextResponse.next()
        response.headers.set(
            "content-security-policy",
            "frame-ancestors 'none'",
        )
        return response
    }

    if (isApi) {
        // API clients expect JSON, not an HTML login redirect.
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // `request.nextUrl.pathname` is base-path-relative and `new URL()` against
    // `request.url` drops the base path, so prepend it explicitly.
    const loginUrl = new URL(
        `${request.nextUrl.basePath}${LOGIN_PATH}`,
        request.url,
    )
    const redirect = NextResponse.redirect(loginUrl)
    redirect.headers.set("content-security-policy", "frame-ancestors 'none'")
    return redirect
}

export const config = {
    matcher: ["/admin/:path*", "/api/admin/:path*", "/embed"],
}
