import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { feedback, services } from "@/db/schema";
import { parseFeedbackInput } from "@/lib/validation";
import { saveScreenshot } from "@/lib/storage";
import { createRateLimiter } from "@/lib/rate-limit";
import { sendFeedbackNotification } from "@/lib/notify";

const limiter = createRateLimiter({
  capacity: 5,
  refillPerMs: 0.002,
  now: () => Date.now(),
});

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request): Promise<Response> {
  const db = getDb();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form submission" }, { status: 400 });
  }

  const embedKey = form.get("embedKey");
  if (typeof embedKey !== "string" || embedKey === "") {
    return NextResponse.json({ error: "Missing embed key" }, { status: 401 });
  }

  const limitKey = `${embedKey}:${clientIp(request)}`;
  if (!limiter.allow(limitKey)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 },
    );
  }

  const service = db
    .select()
    .from(services)
    .where(eq(services.embedKey, embedKey))
    .all()[0];
  if (!service) {
    return NextResponse.json({ error: "Unknown embed key" }, { status: 401 });
  }

  const parsed = parseFeedbackInput({
    message: form.get("message"),
    email: form.get("email") ?? undefined,
    pageUrl: form.get("pageUrl") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  let screenshotPath: string | null = null;
  const screenshot = form.get("screenshot");
  if (screenshot instanceof File && screenshot.size > 0) {
    const result = await saveScreenshot({
      rootDir: process.env.SCREENSHOTS_DIR ?? "screenshots",
      serviceSlug: service.slug,
      file: screenshot,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    screenshotPath = result.path;
  }

  const inserted = db
    .insert(feedback)
    .values({
      serviceId: service.id,
      message: parsed.data.message,
      email: parsed.data.email ?? null,
      pageUrl: parsed.data.pageUrl ?? null,
      screenshotPath,
      userAgent: request.headers.get("user-agent"),
    })
    .returning()
    .get();

  if (service.webhookUrl) {
    void sendFeedbackNotification({
      db,
      webhookUrl: service.webhookUrl,
      adminUrl: `${process.env.ADMIN_BASE_URL ?? ""}/admin/${service.slug}/${inserted.id}`,
      serviceName: service.name,
      feedback: {
        id: inserted.id,
        message: inserted.message,
        email: inserted.email,
        pageUrl: inserted.pageUrl,
        screenshotPath: inserted.screenshotPath,
        createdAt: inserted.createdAt,
      },
    }).catch(() => {});
  }

  return NextResponse.json({ id: inserted.id }, { status: 201 });
}
