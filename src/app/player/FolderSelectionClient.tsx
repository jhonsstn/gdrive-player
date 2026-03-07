"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { sortByNaturalName, type SortDirection } from "@/lib/sort";

type Folder = {
  id: string;
  folderId: string;
  name: string | null;
};

type FoldersApiResponse = {
  folders: Folder[];
  error?: string;
};

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
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [search, setSearch] = useState("");
  const [newFolderIds, setNewFolderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadFolders() {
      setIsLoading(true);

      const response = await fetch("/api/folders");
      const payload = (await response.json()) as FoldersApiResponse;

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setFolders([]);
        setIsLoading(false);
        setStatusMessage(payload.error ?? "Failed to load folders");
        return;
      }

      setFolders(payload.folders);
      setIsLoading(false);
      setStatusMessage(payload.folders.length === 0 ? "No folders configured." : null);

      if (payload.folders.length > 0) {
        const ids = payload.folders.map((f) => f.folderId).join(",");
        try {
          const hasNewRes = await fetch(`/api/folders/has-new?folderIds=${ids}`);
          if (hasNewRes.ok && !cancelled) {
            const hasNewPayload = (await hasNewRes.json()) as { hasNew: Record<string, boolean> };
            setNewFolderIds(
              new Set(
                Object.entries(hasNewPayload.hasNew)
                  .filter(([, v]) => v)
                  .map(([k]) => k),
              ),
            );
          }
        } catch {
          // silently ignore
        }
      }
    }

    void loadFolders();

    return () => {
      cancelled = true;
    };
  }, []);

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

      <main className="mx-auto w-full max-w-[1366px] flex-1 p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Select a Folder</h2>
          <button
            type="button"
            onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${sortDirection === "desc" ? "rotate-180" : ""}`}
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
            Sort {sortDirection === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>

        <div className="mb-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search folders…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-50 placeholder:text-zinc-500 focus:outline-2 focus:outline-blue-500 sm:w-64"
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayedFolders.map((folder) => (
              <Link
                key={folder.id}
                href={`/player/${folder.folderId}`}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-all duration-200 hover:border-blue-500/50 hover:bg-zinc-800/50"
              >
                <div className="mb-3 flex items-center gap-3">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-blue-500"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <h3 className="truncate font-medium text-zinc-50">
                    {folder.name ?? folder.folderId}
                  </h3>
                  {newFolderIds.has(folder.folderId) && (
                    <span className="shrink-0 rounded bg-blue-400/10 px-1.5 py-0.5 text-xs font-medium text-blue-400">
                      NEW
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-zinc-500">{folder.folderId}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
