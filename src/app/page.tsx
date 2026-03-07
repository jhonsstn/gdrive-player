import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.email) {
    redirect("/player");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-center border-b border-zinc-800 bg-zinc-900 px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="gradient-logo flex h-8 w-8 items-center justify-center rounded-md shadow-[0_2px_10px_rgba(59,130,246,0.3)]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">GDrivePlayer</h1>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-8 py-16">
        <div className="flex w-full max-w-100 flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900 px-8 py-12 text-center shadow-sm">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-zinc-700 bg-linear-to-br from-zinc-800 to-zinc-800">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="text-zinc-400"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>

          <h2 className="mb-2 text-xl font-semibold tracking-tight">Welcome to GDrivePlayer</h2>
          <p className="mb-10 text-[0.95rem] text-zinc-400">
            Sign in to access and manage your Google Drive videos.
          </p>

          <Link
            href="/api/auth/signin"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-3 font-medium text-black"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Link>
        </div>
      </main>
    </div>
  );
}
