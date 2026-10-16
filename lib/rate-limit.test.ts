import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows requests while tokens remain", () => {
    const limiter = createRateLimiter({ capacity: 3, refillPerMs: 0.001, now: () => 0 });

    expect(limiter.allow("k1")).toBe(true);
    expect(limiter.allow("k1")).toBe(true);
    expect(limiter.allow("k1")).toBe(true);
  });

  it("blocks once the bucket is empty", () => {
    const limiter = createRateLimiter({ capacity: 2, refillPerMs: 0.001, now: () => 0 });

    limiter.allow("k1");
    limiter.allow("k1");

    expect(limiter.allow("k1")).toBe(false);
  });

  it("refills tokens as time passes", () => {
    let time = 0;
    const limiter = createRateLimiter({ capacity: 1, refillPerMs: 0.1, now: () => time });

    expect(limiter.allow("k1")).toBe(true);
    expect(limiter.allow("k1")).toBe(false);

    time = 10_000;
    expect(limiter.allow("k1")).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ capacity: 1, refillPerMs: 0, now: () => 0 });

    limiter.allow("a");

    expect(limiter.allow("a")).toBe(false);
    expect(limiter.allow("b")).toBe(true);
  });
});
