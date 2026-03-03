import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FolderConfigForm } from "@/components/config/FolderConfigForm";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function AdminHeader() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md gradient-logo flex items-center justify-center shadow-[0_2px_10px_rgba(59,130,246,0.3)]">
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
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Admin Configuration
        </h1>
      </div>
      <Link
        href="/player"
        className="text-sm font-medium text-zinc-400 flex items-center gap-1.5 hover:text-zinc-300"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back to Player
      </Link>
    </header>
  );
}

export default async function ConfigPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/");
  }

  if (!isAdminSession(session)) {
    return (
      <div className="min-h-screen flex flex-col">
        <AdminHeader />
        <main className="px-8 py-16 flex justify-center">
          <div className="bg-zinc-900 border border-red-500/10 rounded-xl shadow-sm max-w-[500px] w-full text-center px-8 py-12">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-red-500 mb-6 mx-auto" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h2 className="text-xl font-semibold tracking-tight mb-2">Access Denied</h2>
            <p className="text-zinc-400 mb-8">Your account ({session.user.email}) is not authorized to access the admin configuration.</p>
            <Link href="/player" className="inline-flex py-2 px-4 bg-zinc-800 text-zinc-50 rounded-md font-medium">
              Return to Player
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const folders = await db.configuredFolder.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader />
      <main className="px-8 py-12 max-w-[1200px] w-full mx-auto">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Drive Folders</h2>
            <p className="text-zinc-400 mt-2">
              Manage the folders synced to the video player.
            </p>
          </div>
          <div className="py-1 px-3 bg-zinc-800 rounded-md text-sm text-zinc-400 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            {session.user.email}
          </div>
        </div>

        <FolderConfigForm
          initialFolders={folders.map((folder) => ({
            ...folder,
            createdAt: folder.createdAt.toISOString(),
            updatedAt: folder.updatedAt.toISOString(),
          }))}
        />
      </main>
    </div>
  );
}
