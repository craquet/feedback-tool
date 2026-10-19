import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { isSessionValid } from "@/lib/auth"
import { getDb } from "@/db/client"
import { services } from "@/db/schema"
import { listFeedbackForCsv } from "@/lib/queries"
import { toCsv } from "@/lib/csv"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    if (!isSessionValid(request, process.env.ADMIN_SESSION_SECRET)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const serviceId = Number(id)
    if (!Number.isInteger(serviceId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const db = getDb()
    const service = db
        .select()
        .from(services)
        .where(eq(services.id, serviceId))
        .all()[0]
    if (!service) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const idsParam = new URL(request.url).searchParams.get("ids")
    let ids: number[] | undefined
    if (idsParam !== null) {
        ids = idsParam
            .split(",")
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isInteger(value) && value > 0)
        if (ids.length === 0) {
            return NextResponse.json(
                { error: "No valid ids in the ids parameter" },
                { status: 400 },
            )
        }
    }

    const rows = listFeedbackForCsv(db, serviceId).filter(
        (row) => !ids || ids.includes(row.id),
    )

    const header = [
        "id",
        "created_at",
        "status",
        "message",
        "email",
        "page_url",
        "has_screenshot",
    ]
    const data = rows.map((row) => [
        row.id,
        row.createdAt.toISOString(),
        row.status,
        row.message,
        row.email,
        row.pageUrl,
        row.screenshotPath !== null,
    ])

    const csv = `\uFEFF${toCsv([header, ...data])}\r\n`
    return new NextResponse(csv, {
        headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="feedback-${service.slug}.csv"`,
        },
    })
}
