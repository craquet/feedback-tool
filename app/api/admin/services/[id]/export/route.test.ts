import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/auth"
import { closeDb, getDb } from "@/db/client"
import { feedback, services } from "@/db/schema"
import { GET } from "./route"

let dbPath: string
let serviceId: number
let otherServiceId: number

beforeAll(() => {
    dbPath = path.join(mkdtempSync(path.join(tmpdir(), "csvexport-")), "test.db")
    process.env.DB_PATH = dbPath
    process.env.ADMIN_SESSION_SECRET = "test-secret"
    const db = getDb()
    const svc = db
        .insert(services)
        .values({ name: "App X", slug: "app-x", embedKey: "k1" })
        .returning()
        .get()
    serviceId = svc.id
    const other = db
        .insert(services)
        .values({ name: "App Y", slug: "app-y", embedKey: "k2" })
        .returning()
        .get()
    otherServiceId = other.id

    const now = Math.floor(Date.now() / 1000)
    db.insert(feedback)
        .values([
            {
                serviceId,
                message: "plain message",
                email: "a@example.com",
                createdAt: new Date(now - 20),
            },
            {
                serviceId,
                message: 'has, comma and "quote"\nand newline',
                email: "=SUM(A1)",
                pageUrl: "https://app.example.com/x",
                createdAt: new Date(now - 10),
            },
        ])
        .run()
    db.insert(feedback)
        .values({ serviceId: otherServiceId, message: "other service" })
        .run()
})

afterAll(() => {
    closeDb()
    rmSync(path.dirname(dbPath), { recursive: true, force: true })
})

function authedGet(pathWithQuery: string): Request {
    const token = createSessionToken({
        secret: "test-secret",
        ttlMs: 60_000,
        now: () => Date.now(),
    })
    return new Request(`http://localhost${pathWithQuery}`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    })
}

describe("GET /api/admin/services/[id]/export", () => {
    it("rejects unauthenticated requests with 401", async () => {
        const response = await GET(
            new Request(`http://localhost/api/admin/services/${serviceId}/export`),
            { params: Promise.resolve({ id: String(serviceId) }) },
        )
        expect(response.status).toBe(401)
    })

    it("returns 404 for an unknown service", async () => {
        const response = await GET(authedGet("/api/admin/services/9999/export"), {
            params: Promise.resolve({ id: "9999" }),
        })
        expect(response.status).toBe(404)
    })

    it("exports all feedback of the service oldest first as CSV", async () => {
        const response = await GET(
            authedGet(`/api/admin/services/${serviceId}/export`),
            { params: Promise.resolve({ id: String(serviceId) }) },
        )

        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toBe(
            "text/csv; charset=utf-8",
        )
        expect(response.headers.get("content-disposition")).toContain(
            'filename="feedback-app-x.csv"',
        )

        const bytes = new Uint8Array(await response.arrayBuffer())
        expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
        const body = new TextDecoder().decode(bytes.slice(3))
        const lines = body.split("\r\n")
        expect(lines[0]).toBe(
            "id,created_at,status,message,email,page_url,has_screenshot",
        )
        expect(lines).toHaveLength(4)
        expect(lines[1]).toContain("plain message")
        expect(lines[1]).toContain("a@example.com")
        expect(lines[2]).toContain('"has, comma and ""quote""\nand newline"')
        expect(lines[2]).toContain("'=SUM(A1)")
    })

    it("exports only the requested ids", async () => {
        const rows = getDb().select().from(feedback).all()
        const mine = rows.filter((r) => r.serviceId === serviceId)
        const other = rows.find((r) => r.serviceId === otherServiceId)
        const ids = [
            mine[0].id,
            other!.id,
        ].join(",")

        const response = await GET(
            authedGet(`/api/admin/services/${serviceId}/export?ids=${ids}`),
            { params: Promise.resolve({ id: String(serviceId) }) },
        )

        const bytes = new Uint8Array(await response.arrayBuffer())
        const body = new TextDecoder().decode(bytes.slice(3))
        const lines = body.split("\r\n")
        expect(lines).toHaveLength(3)
        expect(lines[2]).toBe("")
        expect(lines[1]).toContain("plain message")
        expect(lines[1]).not.toContain("has, comma")
        expect(lines[1]).not.toContain("other service")
    })

    it("returns 400 when the ids parameter contains no valid ids", async () => {
        const response = await GET(
            authedGet(`/api/admin/services/${serviceId}/export?ids=abc,,`),
            { params: Promise.resolve({ id: String(serviceId) }) },
        )
        expect(response.status).toBe(400)
    })
})
