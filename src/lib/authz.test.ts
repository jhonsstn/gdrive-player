import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getEnv: mocks.getEnv,
}));

import { getAdminEmailSet, isAdminEmail, isAdminSession } from "@/lib/authz";

describe("authz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEnv.mockReturnValue({ ADMIN_EMAILS: "admin@test.com,BOSS@Test.COM" });
  });

  describe("getAdminEmailSet", () => {
    it("returns normalized lowercase emails", () => {
      const set = getAdminEmailSet();
      expect(set.has("admin@test.com")).toBe(true);
      expect(set.has("boss@test.com")).toBe(true);
      expect(set.size).toBe(2);
    });

    it("filters out empty entries from trailing commas", () => {
      mocks.getEnv.mockReturnValue({ ADMIN_EMAILS: "a@b.com,,c@d.com," });
      const set = getAdminEmailSet();
      expect(set.size).toBe(2);
    });
  });

  describe("isAdminEmail", () => {
    it("returns true for admin email (case-insensitive)", () => {
      expect(isAdminEmail("Admin@Test.COM")).toBe(true);
    });

    it("returns true for admin email with whitespace", () => {
      expect(isAdminEmail("  admin@test.com  ")).toBe(true);
    });

    it("returns false for non-admin email", () => {
      expect(isAdminEmail("user@test.com")).toBe(false);
    });

    it("returns false for null or undefined", () => {
      expect(isAdminEmail(null)).toBe(false);
      expect(isAdminEmail(undefined)).toBe(false);
    });
  });

  describe("isAdminSession", () => {
    it("returns true for admin session", () => {
      const session = { user: { email: "admin@test.com" }, expires: "" };
      expect(isAdminSession(session)).toBe(true);
    });

    it("returns false for non-admin session", () => {
      const session = { user: { email: "user@test.com" }, expires: "" };
      expect(isAdminSession(session)).toBe(false);
    });

    it("returns false for null session", () => {
      expect(isAdminSession(null)).toBe(false);
    });

    it("returns false for session without email", () => {
      const session = { user: {}, expires: "" };
      expect(isAdminSession(session)).toBe(false);
    });
  });
});
