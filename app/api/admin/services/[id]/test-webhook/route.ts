import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isSessionValid } from "@/lib/auth";
import { deliverWebhook } from "@/lib/notify";
import { getDb } from "@/db/client";
import { services } from "@/db/schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isSessionValid(request, process.env.ADMIN_SESSION_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const serviceId = Number(id);
  const service = Number.isInteger(serviceId)
    ? getDb().select().from(services).where(eq(services.id, serviceId)).all()[0]
    : undefined;
  if (!service) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { webhookUrl } = (body ?? {}) as { webhookUrl?: unknown };
  if (typeof webhookUrl !== "string" || !/^https?:\/\//.test(webhookUrl)) {
    return NextResponse.json(
      { error: "A valid http(s) webhook URL is required" },
      { status: 400 },
    );
  }

  const payload = JSON.stringify({
    test: true,
    serviceName: service.name,
    message: "This is a test notification from the feedback service.",
  });

  const outcome = await deliverWebhook(webhookUrl, payload);
  return NextResponse.json(outcome);
}
