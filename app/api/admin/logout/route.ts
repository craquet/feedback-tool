import { NextResponse } from "next/server"
import { SESSION_COOKIE_NAME } from "@/lib/auth"

export async function POST(request: Request): Promise<Response> {
    const response = NextResponse.json({ ok: true })
    response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: "",
        httpOnly: true,
        // Must match how the login route flags the cookie, otherwise it is not
        // cleared consistently across HTTP and HTTPS deployments.
        secure: request.headers.get("x-forwarded-proto") === "https",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    })
    return response
}
