import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TTLCache } from "@/lib/cache";

describe("TTLCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for missing keys", () => {
    const cache = new TTLCache<string>(1000);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("stores and retrieves values", () => {
    const cache = new TTLCache<string>(1000);
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");
  });

  it("reports presence with has()", () => {
    const cache = new TTLCache<string>(1000);
    expect(cache.has("key")).toBe(false);
    cache.set("key", "value");
    expect(cache.has("key")).toBe(true);
  });

  it("expires entries after default TTL", () => {
    const cache = new TTLCache<string>(1000);
    cache.set("key", "value");

    vi.advanceTimersByTime(999);
    expect(cache.get("key")).toBe("value");

    vi.advanceTimersByTime(2);
    expect(cache.get("key")).toBeUndefined();
  });

  it("supports custom TTL per entry", () => {
    const cache = new TTLCache<string>(10_000);
    cache.set("short", "value", 500);

    vi.advanceTimersByTime(501);
    expect(cache.get("short")).toBeUndefined();
  });

  it("has() returns false for expired entries", () => {
    const cache = new TTLCache<string>(100);
    cache.set("key", "value");

    vi.advanceTimersByTime(101);
    expect(cache.has("key")).toBe(false);
  });

  it("deletes entries explicitly", () => {
    const cache = new TTLCache<string>(10_000);
    cache.set("key", "value");
    cache.delete("key");
    expect(cache.get("key")).toBeUndefined();
  });
});
