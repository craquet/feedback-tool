import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const MAX_SIZE = 5 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export type SaveScreenshotResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

function resolveWithin(rootDir: string, relativePath: string): string {
  const resolved = path.resolve(rootDir, relativePath);
  const root = path.resolve(rootDir) + path.sep;
  if (!resolved.startsWith(root)) {
    throw new Error("Screenshot path escapes storage root");
  }
  return resolved;
}

export async function saveScreenshot(args: {
  rootDir: string;
  serviceSlug: string;
  file: File;
}): Promise<SaveScreenshotResult> {
  const { rootDir, serviceSlug, file } = args;

  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return { ok: false, error: "Screenshot must be a PNG, JPEG, GIF or WebP image" };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: "Screenshot must be 5 MB or smaller" };
  }

  const slugDir = resolveWithin(rootDir, serviceSlug);
  const relativePath = path.posix.join(serviceSlug, `${randomUUID()}${ext}`);
  const target = resolveWithin(rootDir, relativePath);

  try {
    await mkdir(slugDir, { recursive: true });
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
  } catch {
    return { ok: false, error: "Could not store screenshot" };
  }
  return { ok: true, path: relativePath };
}

export function deleteScreenshot(rootDir: string, relativePath: string): void {
  const target = resolveWithin(rootDir, relativePath);
  try {
    unlinkSync(target);
  } catch {
    // best-effort; missing files are fine
  }
}

export function readScreenshot(
  rootDir: string,
  relativePath: string,
): { data: Buffer; contentType: string } | null {
  const target = resolveWithin(rootDir, relativePath);
  const ext = path.extname(target);
  const contentType = CONTENT_TYPE_BY_EXT[ext];
  if (!contentType) {
    throw new Error("Unknown screenshot file type");
  }
  try {
    return { data: readFileSync(target), contentType };
  } catch {
    return null;
  }
}
