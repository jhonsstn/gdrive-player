import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { getEnv } from "@/lib/env";

const { AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET } = getEnv();

async function refreshAccessToken(token: {
  refreshToken?: string;
  [key: string]: unknown;
}) {
  if (!token.refreshToken) {
    return {
      ...token,
      accessToken: undefined,
      accessTokenExpires: 0,
      error: "RefreshAccessTokenError",
    };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: AUTH_GOOGLE_ID,
        client_secret: AUTH_GOOGLE_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!response.ok || !data.access_token) {
      return {
        ...token,
        accessToken: undefined,
        accessTokenExpires: 0,
        error: "RefreshAccessTokenError",
      };
    }

    return {
      ...token,
      accessToken: data.access_token,
      accessTokenExpires: Date.now() + (data.expires_in ?? 3600) * 1000,
      error: undefined,
      // Google may rotate the refresh token
      refreshToken: data.refresh_token ?? token.refreshToken,
    };
  } catch {
    return {
      ...token,
      accessToken: undefined,
      accessTokenExpires: 0,
      error: "RefreshAccessTokenError",
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: AUTH_SECRET,
  providers: [
    Google({
      clientId: AUTH_GOOGLE_ID,
      clientSecret: AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/drive.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: store tokens and expiry
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
        };
      }

      // Token still valid. Refresh a minute early so long Drive requests do
      // not start with a token that is about to expire.
      const accessTokenExpires =
        typeof token.accessTokenExpires === "number" ? token.accessTokenExpires : 0;
      if (Date.now() < accessTokenExpires - 60_000) {
        return token;
      }

      // Token expired — refresh it
      return refreshAccessToken(token as { refreshToken: string });
    },
    async session({ session, token }) {
      if (token.accessToken && !token.error) {
        session.accessToken = token.accessToken as string;
      }
      if (token.error) {
        session.error = token.error as string;
      }

      return session;
    },
  },
});
