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
      <div className="flex min-h-screen flex-col">
        <AppHeader userImage={session.user.image} userName={session.user.name} />
        <main className="flex justify-center px-8 py-16">
          <div className="w-full max-w-[500px] rounded-xl border border-red-500/10 bg-zinc-900 px-8 py-12 text-center shadow-sm">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="mx-auto mb-6 text-red-500"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h2 className="mb-2 text-xl font-semibold tracking-tight">Access Denied</h2>
            <p className="mb-8 text-zinc-400">
              Your account ({session.user.email}) is not authorized to access the admin
              configuration.
            </p>
            <Link
              href="/player"
              className="inline-flex rounded-md bg-zinc-800 px-4 py-2 font-medium text-zinc-50"
            >
              Return to Player
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const [folders, seriesWithSeasons] = await Promise.all([
    db.configuredFolder.findMany({ orderBy: { createdAt: "desc" } }),
    db.series.findMany({
      include: { seasons: { orderBy: { seasonNumber: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader userImage={session.user.image} userName={session.user.name} />
      <main className="mx-auto w-full max-w-[1366px] px-8 py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Drive Folders</h2>
            <p className="mt-2 text-zinc-400">Manage the folders synced to the video player.</p>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-1 text-sm text-zinc-400">
            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
            {session.user.email}
          </div>
        </div>

        <FolderConfigForm
          initialFolders={folders.map((folder) => ({
            ...folder,
            createdAt: folder.createdAt.toISOString(),
            updatedAt: folder.updatedAt.toISOString(),
          }))}
          initialSeries={seriesWithSeasons.map((s) => ({
            id: s.id,
            name: s.name,
            seasons: s.seasons.map((sn) => {
              const folder = folders.find((f) => f.folderId === sn.folderId);
              return {
                id: sn.id,
                seasonNumber: sn.seasonNumber,
                folderId: sn.folderId,
                folderName: folder?.name ?? null,
              };
            }),
          }))}
        />
      </main>
    </div>
  );
}
