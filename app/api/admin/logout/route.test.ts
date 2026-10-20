import { describe, expect, it } from "vitest"
import { POST } from "./route"
import { SESSION_COOKIE_NAME } from "@/lib/auth"

describe("POST /api/admin/logout", () => {
    it("clears the session cookie", async () => {
        const response = await POST(
            new Request("http://localhost/api/admin/logout", {
                method: "POST",
            }),
        )

        expect(response.status).toBe(200)
        const cookie = response.headers.get("set-cookie") ?? ""
        expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`)
        expect(cookie).toMatch(/max-age=0|expires=thu, 01 jan 1970/i)
    })

    it("does not mark the cleared cookie Secure over plain HTTP", async () => {
        const response = await POST(
            new Request("http://localhost/api/admin/logout", {
                method: "POST",
            }),
        )

        const cookie = response.headers.get("set-cookie") ?? ""
        expect(cookie.toLowerCase()).not.toContain("secure")
    })
})
