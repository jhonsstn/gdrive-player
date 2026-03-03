import type { Session } from "next-auth";

import { getEnv } from "@/lib/env";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getAdminEmailSet(): Set<string> {
  const { ADMIN_EMAILS } = getEnv();
  return new Set(
    ADMIN_EMAILS.split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return getAdminEmailSet().has(normalizeEmail(email));
}

export function isAdminSession(session: Session | null): boolean {
  return isAdminEmail(session?.user?.email);
}
