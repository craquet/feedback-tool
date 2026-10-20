import { NextResponse } from "next/server"
import {
    SESSION_COOKIE_NAME,
    SESSION_TTL_MS,
    createSessionToken,
    verifyAdminPassword,
} from "@/lib/auth"
import { clientIp, createRateLimiter } from "@/lib/rate-limit"

// Brute-force protection: 10 attempts, then ~1 per 15 minutes per client.
// Buckets are in-memory, which is fine for this single-instance deployment.
const limiter = createRateLimiter({
    capacity: 10,
    refillPerMs: 1 / (15 * 60 * 1000),
    now: () => Date.now(),
})

const LOGIN_PATH = "/admin/login"

function isFormPost(request: Request): boolean {
    const contentType = request.headers.get("content-type") ?? ""
    return (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
    )
}

export async function POST(request: Request): Promise<Response> {
    const formPost = isFormPost(request)
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
    const redirectTo = (path: string, params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params)}` : ""
        return new URL(`${basePath}${path}${query}`, request.url)
    }

    const fail = (message: string, status: number): Response => {
        if (formPost) {
            // Native, pre-hydration submit: send the user back to the form with
            // an error instead of returning raw JSON.
            return NextResponse.redirect(
                redirectTo(LOGIN_PATH, { error: message }),
                303,
            )
        }
        return NextResponse.json({ error: message }, { status })
    }

    if (!limiter.allow(clientIp(request))) {
        return fail("Too many login attempts. Please try again later.", 429)
    }

    const password = process.env.ADMIN_PASSWORD
    const secret = process.env.ADMIN_SESSION_SECRET
    if (!password || !secret) {
        return fail("Admin auth is not configured", 500)
    }

    let provided: unknown
    if (formPost) {
        const form = await request.formData().catch(() => null)
        provided = form?.get("password")
    } else {
        let body: unknown
        try {
            body = await request.json()
        } catch {
            return fail("Invalid request", 400)
        }
        provided = (body ?? {}) && (body as { password?: unknown }).password
    }

    if (typeof provided !== "string") {
        return fail("Password is required", 400)
    }

    if (!verifyAdminPassword(provided, password)) {
        return fail("Wrong password", 401)
    }

    const token = createSessionToken({
        secret,
        ttlMs: SESSION_TTL_MS,
        now: () => Date.now(),
    })
    const response = formPost
        ? NextResponse.redirect(redirectTo("/admin"), 303)
        : NextResponse.json({ ok: true })
    response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        httpOnly: true,
        // Only mark the cookie Secure when the request actually arrived over
        // HTTPS. Otherwise browsers silently drop it over plain HTTP and the
        // user is bounced back to the login page.
        secure: request.headers.get("x-forwarded-proto") === "https",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
    })
    return response
}
