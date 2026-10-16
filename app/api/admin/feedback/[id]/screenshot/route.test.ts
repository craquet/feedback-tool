import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/auth";
import { closeDb, getDb } from "@/db/client";
import { feedback, services } from "@/db/schema";
import { saveScreenshot } from "@/lib/storage";
import { GET } from "./route";

let dbPath: string;
let screenshotsDir: string;

beforeAll(async () => {
  dbPath = path.join(mkdtempSync(path.join(tmpdir(), "shot-route-")), "test.db");
  screenshotsDir = mkdtempSync(path.join(tmpdir(), "shot-route-"));
  process.env.DB_PATH = dbPath;
  process.env.SCREENSHOTS_DIR = screenshotsDir;
  process.env.ADMIN_SESSION_SECRET = "test-secret";

  const svc = getDb()
    .insert(services)
    .values({ name: "App X", slug: "app-x", embedKey: "k1" })
    .returning()
    .get();
  const saved = await saveScreenshot({
    rootDir: screenshotsDir,
    serviceSlug: "app-x",
    file: new File([new Uint8Array([4, 5, 6])], "shot.png", { type: "image/png" }),
  });
  getDb()
    .insert(feedback)
    .values({ serviceId: svc.id, message: "with shot", screenshotPath: saved.ok ? saved.path : null })
    .run();
  getDb()
    .insert(feedback)
    .values({ serviceId: svc.id, message: "without shot" })
    .run();
});

afterAll(() => {
  closeDb();
  rmSync(path.dirname(dbPath), { recursive: true, force: true });
  rmSync(screenshotsDir, { recursive: true, force: true });
});

function authedRequest(id: string | number): Request {
  const token = createSessionToken({
    secret: "test-secret",
    ttlMs: 60_000,
    now: () => Date.now(),
  });
  return new Request(`http://localhost/api/admin/feedback/${id}/screenshot`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
  });
}

describe("GET /api/admin/feedback/[id]/screenshot", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const response = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown feedback id", async () => {
    const response = await GET(authedRequest(999), {
      params: Promise.resolve({ id: "999" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 when the feedback has no screenshot", async () => {
    const withoutShot = getDb()
      .select()
      .from(feedback)
      .all()
      .find((row) => row.message === "without shot")!;

    const response = await GET(authedRequest(withoutShot.id), {
      params: Promise.resolve({ id: String(withoutShot.id) }),
    });

    expect(response.status).toBe(404);
  });

  it("streams the screenshot with the right content type", async () => {
    const withShot = getDb()
      .select()
      .from(feedback)
      .all()
      .find((row) => row.message === "with shot")!;

    const response = await GET(authedRequest(withShot.id), {
      params: Promise.resolve({ id: String(withShot.id) }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes)).toEqual([4, 5, 6]);
  });
});
