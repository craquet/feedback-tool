import { beforeAll, describe, expect, it } from "vitest"
import { POST } from "./route"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth"

beforeAll(() => {
    process.env.ADMIN_PASSWORD = "test-password"
    process.env.ADMIN_SESSION_SECRET = "test-secret"
})

function makeLoginRequest(password: unknown): Request {
    return new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
    })
}

describe("POST /api/admin/login", () => {
    it("sets a signed session cookie for the correct password", async () => {
        const response = await POST(makeLoginRequest("test-password"))

        expect(response.status).toBe(200)
        const cookie = response.headers.get("set-cookie") ?? ""
        expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`)
        expect(cookie.toLowerCase()).toContain("httponly")
        const token = cookie.match(
            new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`),
        )![1]
        expect(
            verifySessionToken(token, {
                secret: "test-secret",
                now: () => Date.now(),
            }),
        ).toBe(true)
    })

    it("rejects a wrong password with 401 and sets no cookie", async () => {
        const response = await POST(makeLoginRequest("wrong"))

        expect(response.status).toBe(401)
        expect(response.headers.get("set-cookie")).toBeNull()
    })

    it("rejects a non-string password with 400", async () => {
        const response = await POST(makeLoginRequest(42))

        expect(response.status).toBe(400)
    })

    it("rate-limits repeated failed attempts per client", async () => {
        const headers = { "x-real-ip": "203.0.113.9" }

        let lastStatus = 0
        for (let i = 0; i < 11; i++) {
            const response = await POST(
                new Request("http://localhost/api/admin/login", {
                    method: "POST",
                    headers: { "content-type": "application/json", ...headers },
                    body: JSON.stringify({ password: "wrong" }),
                }),
            )
            lastStatus = response.status
        }

        expect(lastStatus).toBe(429)
    })

    it("does not mark the cookie Secure over plain HTTP", async () => {
        const response = await POST(makeLoginRequest("test-password"))

        const cookie = response.headers.get("set-cookie") ?? ""
        expect(cookie.toLowerCase()).not.toContain("secure")
    })

    it("marks the cookie Secure when the proxy reports HTTPS", async () => {
        const response = await POST(
            new Request("http://localhost/api/admin/login", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-forwarded-proto": "https",
                },
                body: JSON.stringify({ password: "test-password" }),
            }),
        )

        const cookie = response.headers.get("set-cookie") ?? ""
        expect(cookie.toLowerCase()).toContain("secure")
    })

    describe("native form post (no JavaScript)", () => {
        function makeFormRequest(password: string, basePath = ""): Request {
            return new Request("http://localhost/api/admin/login", {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ password }).toString(),
            })
        }

        it("redirects to the admin dashboard and sets the cookie", async () => {
            const response = await POST(makeFormRequest("test-password"))

            expect(response.status).toBe(303)
            expect(response.headers.get("location")).toBe(
                "http://localhost/admin",
            )
            expect(response.headers.get("set-cookie")).toContain(
                `${SESSION_COOKIE_NAME}=`,
            )
        })

        it("includes the base path in the redirect target", async () => {
            const previous = process.env.NEXT_PUBLIC_BASE_PATH
            process.env.NEXT_PUBLIC_BASE_PATH = "/feedback"
            try {
                const ok = await POST(makeFormRequest("test-password"))
                expect(ok.headers.get("location")).toBe(
                    "http://localhost/feedback/admin",
                )

                const bad = await POST(makeFormRequest("wrong"))
                expect(bad.headers.get("location")).toBe(
                    "http://localhost/feedback/admin/login?error=Wrong+password",
                )
            } finally {
                process.env.NEXT_PUBLIC_BASE_PATH = previous
            }
        })

        it("redirects back to the login page with an error on a wrong password", async () => {
            const response = await POST(makeFormRequest("wrong"))

            expect(response.status).toBe(303)
            expect(response.headers.get("location")).toContain(
                "/admin/login?error=",
            )
            expect(response.headers.get("set-cookie")).toBeNull()
        })
    })
})
