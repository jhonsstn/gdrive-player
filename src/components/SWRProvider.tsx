"use client";

import { SWRConfig } from "swr";

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error((body as { error?: string }).error ?? `Request failed: ${response.status}`);
    (error as Error & { status: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
