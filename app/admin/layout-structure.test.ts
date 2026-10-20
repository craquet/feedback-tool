import { existsSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Regression guard for the "login loop" bug.
//
// The authenticated admin chrome (the header with links to /admin and
// /admin/new) must NOT wrap the login page. Next.js prefetches links in the
// viewport, so if the login page rendered those protected links, the
// unauthenticated prefetch would be answered by the proxy with a redirect to
// /admin/login. That redirect response is cached in the client router and
// replayed after a successful login — which is what made "New service" bounce
// back to the login screen even though the session cookie was valid.
//
// The fix keeps the chrome in `app/admin/(dashboard)/layout.tsx`, a route
// group the login page is not part of. These tests assert that structure so a
// future refactor cannot quietly move the layout back over the login route.
const adminDir = path.resolve(__dirname)

describe("admin route layout structure", () => {
    it("keeps the authenticated chrome layout out of app/admin root", () => {
        expect(existsSync(path.join(adminDir, "layout.tsx"))).toBe(false)
    })

    it("places the authenticated chrome in the (dashboard) route group", () => {
        expect(
            existsSync(path.join(adminDir, "(dashboard)", "layout.tsx")),
        ).toBe(true)
    })

    it("does not put the login page inside the (dashboard) route group", () => {
        expect(existsSync(path.join(adminDir, "login", "page.tsx"))).toBe(true)
        expect(existsSync(path.join(adminDir, "(dashboard)", "login"))).toBe(
            false,
        )
    })
})
