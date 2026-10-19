import { NextResponse } from "next/server"
import { isSessionValid } from "@/lib/auth"
import { getDb } from "@/db/client"
import { feedback } from "@/db/schema"
import { readScreenshot } from "@/lib/storage"
import { eq } from "drizzle-orm"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    if (!isSessionValid(request, process.env.ADMIN_SESSION_SECRET)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const feedbackId = Number(id)
    if (!Number.isInteger(feedbackId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const row = getDb()
        .select({ screenshotPath: feedback.screenshotPath })
        .from(feedback)
        .where(eq(feedback.id, feedbackId))
        .all()[0]
    if (!row?.screenshotPath) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const screenshot = readScreenshot(
        process.env.SCREENSHOTS_DIR ?? "screenshots",
        row.screenshotPath,
    )
    if (!screenshot) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(screenshot.data), {
        headers: {
            "content-type": screenshot.contentType,
            "cache-control": "private, no-store",
        },
    })
}
