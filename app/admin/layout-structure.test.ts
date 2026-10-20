import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Regression guard for the "login loop" bug.
//
// There were two independent causes, both covered here:
//
// 1. The authenticated admin chrome (the header with links to /admin and
//    /admin/new) must NOT wrap the login page. Next.js prefetches links in the
//    viewport, so if the login page rendered those protected links, the
//    unauthenticated prefetch would be answered by the proxy with a redirect to
//    /admin/login. That redirect response is cached in the client router and
//    replayed after a successful login.
//
// 2. Every authenticated page must force dynamic rendering. `requireAdmin()`
//    reads the session cookie, which normally opts a page into dynamic
//    rendering, but `isAdmin()` short-circuits before touching `cookies()`
//    when ADMIN_SESSION_SECRET is unset. In the Docker image only
//    NEXT_PUBLIC_BASE_PATH is passed to `next build`, so routes like /admin/new
//    were statically prerendered with a redirect-to-login baked in, then served
//    from cache (s-maxage=31536000) to logged-in users forever.
const adminDir = path.resolve(__dirname)
const dashboardDir = path.join(adminDir, "(dashboard)")

describe("admin route layout structure", () => {
    it("keeps the authenticated chrome layout out of app/admin root", () => {
        expect(existsSync(path.join(adminDir, "layout.tsx"))).toBe(false)
    })

    it("places the authenticated chrome in the (dashboard) route group", () => {
        expect(existsSync(path.join(dashboardDir, "layout.tsx"))).toBe(true)
    })

    it("does not put the login page inside the (dashboard) route group", () => {
        expect(existsSync(path.join(adminDir, "login", "page.tsx"))).toBe(true)
        expect(existsSync(path.join(dashboardDir, "login"))).toBe(false)
    })

    it("forces the authenticated layout to render dynamically", () => {
        const source = readFileSync(
            path.join(dashboardDir, "layout.tsx"),
            "utf8",
        )
        expect(source).toMatch(
            /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/,
        )
    })
})
