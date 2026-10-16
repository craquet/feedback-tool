import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/auth";
import { closeDb, getDb } from "@/db/client";
import { services } from "@/db/schema";
import { POST } from "./route";

let dbPath: string;
let serviceId: number;

beforeAll(() => {
  dbPath = path.join(mkdtempSync(path.join(tmpdir(), "testhook-")), "test.db");
  process.env.DB_PATH = dbPath;
  process.env.ADMIN_SESSION_SECRET = "test-secret";
  const svc = getDb()
    .insert(services)
    .values({ name: "App X", slug: "app-x", embedKey: "k1" })
    .returning()
    .get();
  serviceId = svc.id;
});

afterAll(() => {
  closeDb();
  rmSync(path.dirname(dbPath), { recursive: true, force: true });
  vi.unstubAllGlobals();
});

function authedRequest(body: unknown): Request {
  const token = createSessionToken({
    secret: "test-secret",
    ttlMs: 60_000,
    now: () => Date.now(),
  });
  return new Request(
    `http://localhost/api/admin/services/${serviceId}/test-webhook`,
    {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/admin/services/[id]/test-webhook", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const response = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ webhookUrl: "https://hooks.example.com" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: String(serviceId) }) },
    );

    expect(response.status).toBe(401);
  });

  it("rejects a missing or invalid webhook url with 400", async () => {
    const noUrl = await POST(authedRequest({}), {
      params: Promise.resolve({ id: String(serviceId) }),
    });
    const badUrl = await POST(
      authedRequest({ webhookUrl: "not a url" }),
      { params: Promise.resolve({ id: String(serviceId) }) },
    );

    expect(noUrl.status).toBe(400);
    expect(badUrl.status).toBe(400);
  });

  it("posts a test payload and reports success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      authedRequest({ webhookUrl: "https://hooks.example.com/team" }),
      { params: Promise.resolve({ id: String(serviceId) }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.responseStatus).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.test).toBe(true);
    expect(payload.serviceName).toBe("App X");
  });

  it("reports a failed delivery without throwing", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      authedRequest({ webhookUrl: "https://hooks.example.com/team" }),
      { params: Promise.resolve({ id: String(serviceId) }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/connection refused/);
  });
});
