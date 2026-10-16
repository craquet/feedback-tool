import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteScreenshot, readScreenshot, saveScreenshot } from "./storage";

describe("saveScreenshot", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), "screenshots-"));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("saves a png under the service slug dir and returns its relative path", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const file = new File([bytes], "shot.png", { type: "image/png" });

    const result = await saveScreenshot({
      rootDir,
      serviceSlug: "app-x",
      file,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = path.join(rootDir, result.path);
    expect(existsSync(stored)).toBe(true);
    expect(result.path).toMatch(/^app-x\/[0-9a-f-]+\.png$/);
    expect(Buffer.from(readFileSync(stored))).toEqual(Buffer.from(bytes));
  });

  it("maps jpeg, gif and webp to the right extension", async () => {
    const jpeg = await saveScreenshot({
      rootDir,
      serviceSlug: "s",
      file: new File([new Uint8Array(1)], "x", { type: "image/jpeg" }),
    });
    const gif = await saveScreenshot({
      rootDir,
      serviceSlug: "s",
      file: new File([new Uint8Array(1)], "x", { type: "image/gif" }),
    });
    const webp = await saveScreenshot({
      rootDir,
      serviceSlug: "s",
      file: new File([new Uint8Array(1)], "x", { type: "image/webp" }),
    });

    expect(jpeg.ok && jpeg.path.endsWith(".jpg")).toBe(true);
    expect(gif.ok && gif.path.endsWith(".gif")).toBe(true);
    expect(webp.ok && webp.path.endsWith(".webp")).toBe(true);
  });

  it("rejects non-image files", async () => {
    const result = await saveScreenshot({
      rootDir,
      serviceSlug: "app-x",
      file: new File([new Uint8Array(4)], "virus.exe", {
        type: "application/x-msdownload",
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/image/i);
    }
    expect(existsSync(path.join(rootDir, "app-x"))).toBe(false);
  });

  it("rejects images larger than 5 MB", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });

    const result = await saveScreenshot({ rootDir, serviceSlug: "app-x", file: big });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/5 MB|size/i);
    }
  });
});

describe("deleteScreenshot", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), "screenshots-"));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("removes the stored file", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "shot.png", {
      type: "image/png",
    });
    const result = await saveScreenshot({ rootDir, serviceSlug: "s", file });
    if (!result.ok) throw new Error("setup failed");

    deleteScreenshot(rootDir, result.path);

    expect(existsSync(path.join(rootDir, result.path))).toBe(false);
  });

  it("does not throw when the file is missing", () => {
    expect(() => deleteScreenshot(rootDir, "s/does-not-exist.png")).not.toThrow();
  });

  it("refuses paths that escape the root dir", () => {
    expect(() => deleteScreenshot(rootDir, "../outside.png")).toThrow();
  });
});

describe("readScreenshot", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), "screenshots-"));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("returns the stored bytes and content type", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    const file = new File([bytes], "shot.png", { type: "image/png" });
    const saved = await saveScreenshot({ rootDir, serviceSlug: "s", file });
    if (!saved.ok) throw new Error("setup failed");

    const read = readScreenshot(rootDir, saved.path);

    expect(read).not.toBeNull();
    expect(read?.contentType).toBe("image/png");
    expect(Buffer.from(read?.data ?? new Uint8Array())).toEqual(Buffer.from(bytes));
  });

  it("refuses paths that escape the root dir", () => {
    expect(() => readScreenshot(rootDir, "../../etc/passwd")).toThrow();
  });
});
