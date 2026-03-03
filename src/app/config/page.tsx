import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppHeader } from "@/components/AppHeader";
import { FolderConfigForm } from "@/components/config/FolderConfigForm";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/");
  }

  if (!isAdminSession(session)) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader userImage={session.user.image} userName={session.user.name} />
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
      <AppHeader userImage={session.user.image} userName={session.user.name} />
      <main className="px-8 py-12 max-w-[1366px] w-full mx-auto">
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
