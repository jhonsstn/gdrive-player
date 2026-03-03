"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/AppHeader";

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFolders() {
      setStatusMessage("Loading folders...");

      const response = await fetch("/api/folders");
      const payload = (await response.json()) as FoldersApiResponse;

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setFolders([]);
        setStatusMessage(payload.error ?? "Failed to load folders");
        return;
      }

      setFolders(payload.folders);
      setStatusMessage(payload.folders.length === 0 ? "No folders configured." : null);
    }

    void loadFolders();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader userImage={userImage} userName={userName} showAdminLink={isAdmin} />

      <main className="flex-1 p-8 max-w-[1200px] w-full mx-auto">
        <h2 className="text-xl font-semibold tracking-tight mb-6">
          Select a Folder
        </h2>

        {statusMessage ? (
          <div className="p-4 rounded-md bg-zinc-900 border border-zinc-800 text-center text-zinc-400">
            {statusMessage}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => (
              <Link
                key={folder.id}
                href={`/player/${folder.folderId}`}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 transition-all duration-200 hover:border-blue-500/50 hover:bg-zinc-800/50"
              >
                <div className="flex items-center gap-3 mb-3">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-500 shrink-0"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <h3 className="font-medium text-zinc-50 truncate">
                    {folder.name ?? folder.folderId}
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 truncate">
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
