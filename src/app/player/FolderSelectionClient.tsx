"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { sortByNaturalName, type SortDirection } from "@/lib/sort";
import { Badge } from "@/components/ui/Badge";
import { SortButton } from "@/components/ui/SortButton";
import { useFolders, useFoldersHasNew, useContinueWatching, useNotifications } from "@/hooks/api";

type FolderSelectionClientProps = {
  userImage?: string | null;
  userName?: string | null;
  isAdmin?: boolean;
};

export function FolderSelectionClient({
  userImage,
  userName,
  isAdmin = false,
}: FolderSelectionClientProps) {
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [search, setSearch] = useState("");

  const { data: foldersData, isLoading: isFoldersLoading, error: foldersError } = useFolders();
  const folders = useMemo(() => foldersData?.folders ?? [], [foldersData]);

  const folderIds = useMemo(() => folders.map((f) => f.folderId), [folders]);
  const { data: hasNewData } = useFoldersHasNew(folderIds);
  const notSeenFolderIds = useMemo(() => {
    if (!hasNewData?.hasNew) return new Set<string>();
    return new Set(
      Object.entries(hasNewData.hasNew)
        .filter(([, v]) => v)
        .map(([k]) => k),
    );
  }, [hasNewData]);

  const { data: notifData } = useNotifications();
  const newFolderIds = useMemo(() => {
    if (!notifData?.notifications) return new Set<string>();
    return new Set(notifData.notifications.map((n) => n.folderId));
  }, [notifData]);

  const { data: cwData, isLoading: isContinueWatchingLoading } = useContinueWatching();
  const continueWatching = cwData?.items ?? [];

  const isLoading = isFoldersLoading;
  const statusMessage = foldersError
    ? "Failed to load folders"
    : !isLoading && folders.length === 0
      ? "No folders configured."
      : null;

  const displayedFolders = useMemo(() => {
    const query = search.toLowerCase();
    const filtered = folders.filter((f) => (f.name ?? f.folderId).toLowerCase().includes(query));
    return sortByNaturalName(
      filtered.map((f) => ({ ...f, name: f.name ?? f.folderId })),
      sortDirection,
    );
  }, [folders, search, sortDirection]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader userImage={userImage} userName={userName} showAdminLink={isAdmin} />

      <main className="mx-auto w-full max-w-341.5 flex-1 p-8">
        {isContinueWatchingLoading ? (
          <section className="mb-8">
            <div className="mb-4 h-6 w-48 animate-pulse rounded bg-zinc-800" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-zinc-800" />
                    <div className="h-4 flex-1 animate-pulse rounded bg-zinc-800" />
                  </div>
                  <div className="mx-4 mb-3 h-3 w-1/3 animate-pulse rounded bg-zinc-800" />
                  <div className="mx-4 mb-4 h-1 animate-pulse rounded-full bg-zinc-800" />
                </div>
              ))}
            </div>
          </section>
        ) : continueWatching.length > 0 ? (
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">Continue Watching</h2>
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-6 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {continueWatching.map((item) => {
                const folder = folders.find((f) => f.folderId === item.folderId);
                const percent = item.duration > 0 ? (item.currentTime / item.duration) * 100 : 0;
                return (
                  <Link
                    key={item.videoId}
                    href={`/player/${item.folderId}?videoId=${item.videoId}`}
                    className="group relative flex w-72 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-xl border border-zinc-800/60 bg-gradient-to-t from-zinc-900 via-zinc-900/80 to-zinc-800/30 p-5 transition-all duration-300 hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/20"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 w-full bg-zinc-800/50">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>

                    <div className="relative z-10 mt-6 flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 transition-transform duration-300 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="translate-x-0.5"
                          >
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </div>
                        <h3 className="line-clamp-2 min-h-[2.5rem] font-medium leading-snug text-zinc-50 transition-colors group-hover:text-blue-400">
                          {(item.videoName ?? item.videoId).replace(/\.[^.]+$/, "")}
                        </h3>
                      </div>

                      {folder && (
                        <div className="mt-2 flex items-center justify-between">
                          <p className="truncate text-xs text-zinc-500">
                            {folder.name ?? folder.folderId}
                          </p>
                          <span className="shrink-0 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                            Resume
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Select a Folder</h2>
          <SortButton
            direction={sortDirection}
            onToggle={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
          />
        </div>

        <div className="mb-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search folders…"
            aria-label="Search folders"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-zinc-50 placeholder:text-zinc-500 focus:outline-2 focus:outline-blue-500 sm:w-64 sm:px-3 sm:py-1.5 sm:text-sm"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-zinc-800" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-zinc-800" />
                </div>
                <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : statusMessage ? (
          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4 text-center text-zinc-400">
            {statusMessage}
          </div>
        ) : displayedFolders.length === 0 ? (
          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4 text-center text-zinc-400">
            No folders match your search.
          </div>
        ) : (
          <div className="flex flex-col gap-1 -mx-4 sm:mx-0">
            {displayedFolders.map((folder) => (
              <Link
                key={folder.id}
                href={`/player/${folder.folderId}`}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 rounded-xl px-4 py-4 transition-all duration-200 hover:bg-zinc-800/40"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800/50 text-zinc-400 transition-colors group-hover:bg-zinc-800 group-hover:text-zinc-300">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="truncate text-base font-medium text-zinc-100 transition-colors group-hover:text-blue-400">
                        {folder.name ?? folder.folderId}
                      </h3>
                      {newFolderIds.has(folder.folderId) ? (
                        <Badge size="sm">New</Badge>
                      ) : notSeenFolderIds.has(folder.folderId) ? (
                        <Badge size="sm">Not seen</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                <p className="pl-14 sm:pl-0 font-mono text-xs text-zinc-600 transition-colors group-hover:text-zinc-500">
                  {folder.folderId}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
