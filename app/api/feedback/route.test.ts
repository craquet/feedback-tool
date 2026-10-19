import { mkdtempSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { closeDb, getDb } from "@/db/client"
import { feedback, services } from "@/db/schema"
import { POST } from "./route"

let dbPath: string
let screenshotsDir: string
let serviceCounter = 0

beforeAll(() => {
    dbPath = path.join(
        mkdtempSync(path.join(tmpdir(), "feedback-api-")),
        "test.db",
    )
    screenshotsDir = mkdtempSync(path.join(tmpdir(), "feedback-shots-"))
    process.env.DB_PATH = dbPath
    process.env.SCREENSHOTS_DIR = screenshotsDir
})

afterAll(() => {
    closeDb()
    rmSync(path.dirname(dbPath), { recursive: true, force: true })
    rmSync(screenshotsDir, { recursive: true, force: true })
})

beforeEach(() => {
    serviceCounter += 1
    getDb()
        .insert(services)
        .values({
            name: `Service ${serviceCounter}`,
            slug: `svc-${serviceCounter}`,
            embedKey: `key-${serviceCounter}`,
        })
        .run()
})

function makeRequest(key: string, form: FormData, ip = "10.0.0.1"): Request {
    return new Request("http://localhost/api/feedback", {
        method: "POST",
        body: form,
        headers: { "x-forwarded-for": ip },
    })
}

async function submit(key: string, form: FormData, ip = "10.0.0.1") {
    return POST(makeRequest(key, form, ip))
}

function minimalForm(key: string): FormData {
    const form = new FormData()
    form.set("embedKey", key)
    form.set("message", "The export button does nothing")
    return form
}

describe("POST /api/feedback", () => {
    function feedbackCount(key: string): number {
        const svc = getDb()
            .select()
            .from(services)
            .where(eq(services.embedKey, key))
            .all()[0]
        return getDb()
            .select()
            .from(feedback)
            .where(eq(feedback.serviceId, svc.id))
            .all().length
    }

    async function rowById(response: Response) {
        const body = await response.json()
        return getDb()
            .select()
            .from(feedback)
            .where(eq(feedback.id, body.id))
            .all()[0]
    }

    it("stores minimal feedback for the service matching the embed key", async () => {
        const response = await submit("key-1", minimalForm("key-1"))

        expect(response.status).toBe(201)
        const row = await rowById(response)
        expect(row.message).toBe("The export button does nothing")
        expect(row.status).toBe("new")
        expect(row.serviceId).toBe(
            getDb()
                .select()
                .from(services)
                .where(eq(services.embedKey, "key-1"))
                .all()[0].id,
        )
        expect(row.screenshotPath).toBeNull()
        expect(row.email).toBeNull()
    })

    it("records pageUrl, email and user agent when provided", async () => {
        const form = minimalForm("key-1")
        form.set("email", "user@example.com")
        form.set("pageUrl", "https://app.example.com/reports")

        const response = await POST(
            new Request("http://localhost/api/feedback", {
                method: "POST",
                body: form,
                headers: {
                    "x-forwarded-for": "10.0.0.2",
                    "user-agent": "Mozilla/5.0 TestAgent",
                },
            }),
        )

        expect(response.status).toBe(201)
        const row = await rowById(response)
        expect(row.email).toBe("user@example.com")
        expect(row.pageUrl).toBe("https://app.example.com/reports")
        expect(row.userAgent).toBe("Mozilla/5.0 TestAgent")
    })

    it("stores an attached screenshot on disk and links it", async () => {
        const form = minimalForm("key-1")
        form.set(
            "screenshot",
            new File([new Uint8Array([1, 2, 3])], "shot.png", {
                type: "image/png",
            }),
        )

        const response = await submit("key-1", form, "10.0.0.3")

        expect(response.status).toBe(201)
        const row = await rowById(response)
        expect(row.screenshotPath).toMatch(/^svc-1\/[0-9a-f-]+\.png$/)
        expect(
            existsSync(path.join(screenshotsDir, row.screenshotPath ?? "")),
        ).toBe(true)
    })

    it("rejects an unknown embed key with 401", async () => {
        const before = feedbackCount("key-1")

        const response = await submit("no-such-key", minimalForm("no-such-key"))

        expect(response.status).toBe(401)
        expect(feedbackCount("key-1")).toBe(before)
    })

    it("rejects an empty message with 400 and an error message", async () => {
        const form = new FormData()
        form.set("embedKey", "key-1")
        form.set("message", "   ")
        const before = feedbackCount("key-1")

        const response = await submit("key-1", form, "10.0.0.4")

        expect(response.status).toBe(400)
        const body = await response.json()
        expect(body.error).toBeDefined()
        expect(feedbackCount("key-1")).toBe(before)
    })

    it("rejects an invalid email with 400", async () => {
        const form = minimalForm("key-1")
        form.set("email", "nope")

        const response = await submit("key-1", form, "10.0.0.5")

        expect(response.status).toBe(400)
    })

    it("rejects a non-image screenshot with 400", async () => {
        const form = minimalForm("key-1")
        form.set(
            "screenshot",
            new File([new Uint8Array(10)], "evil.exe", {
                type: "application/octet-stream",
            }),
        )
        const before = feedbackCount("key-1")

        const response = await submit("key-1", form, "10.0.0.6")

        expect(response.status).toBe(400)
        expect(feedbackCount("key-1")).toBe(before)
    })

    it("rate limits bursts of submissions from the same key and ip", async () => {
        const form = minimalForm("key-1")
        const statuses: number[] = []
        for (let i = 0; i < 8; i++) {
            const response = await submit("key-1", form, "10.9.9.9")
            statuses.push(response.status)
        }

        expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201])
        expect(statuses.slice(5)).toEqual([429, 429, 429])
    })

    it("rejects reports with 403 when the service has disabled report receiving", async () => {
        getDb()
            .update(services)
            .set({ acceptingReports: false })
            .where(eq(services.embedKey, "key-1"))
            .run()
        const before = feedbackCount("key-1")

        const response = await submit("key-1", minimalForm("key-1"), "10.0.0.7")

        expect(response.status).toBe(403)
        const body = await response.json()
        expect(body.error).toMatch(/not accepting/i)
        expect(feedbackCount("key-1")).toBe(before)
    })

    it("rejects screenshots with 400 when the service has disabled screenshot receiving", async () => {
        getDb()
            .update(services)
            .set({ acceptingReports: true, acceptingScreenshots: false })
            .where(eq(services.embedKey, "key-1"))
            .run()
        const before = feedbackCount("key-1")

        const form = minimalForm("key-1")
        form.set(
            "screenshot",
            new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" }),
        )
        const response = await submit("key-1", form, "10.0.0.8")

        expect(response.status).toBe(400)
        const body = await response.json()
        expect(body.error).toMatch(/screenshot/i)
        expect(feedbackCount("key-1")).toBe(before)
    })

    it("still accepts text-only reports when screenshots are disabled", async () => {
        getDb()
            .update(services)
            .set({ acceptingReports: true, acceptingScreenshots: false })
            .where(eq(services.embedKey, "key-1"))
            .run()

        const response = await submit("key-1", minimalForm("key-1"), "10.0.0.9")

        expect(response.status).toBe(201)
        const row = await rowById(response)
        expect(row.screenshotPath).toBeNull()
    })
})
