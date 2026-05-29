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

let isRedirectingToSignIn = false;

function redirectToSignIn() {
  if (isRedirectingToSignIn || typeof window === "undefined") return;

  isRedirectingToSignIn = true;
  const callbackUrl = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        onError: (error) => {
          if ((error as Error & { status?: number }).status === 401) {
            redirectToSignIn();
          }
        },
        revalidateOnFocus: false,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
