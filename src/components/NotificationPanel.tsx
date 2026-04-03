"use client";

import { useRouter } from "next/navigation";

type NewFolder = {
  folderId: string;
  folderName: string;
};

type NotificationPanelProps = {
  folders: NewFolder[];
  onClear: (folderId: string) => void;
  onClearAll: () => void;
};

export function NotificationPanel({ folders, onClear, onClearAll }: NotificationPanelProps) {
  const router = useRouter();

  if (folders.length === 0) {
    return (
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
        <div className="px-4 py-6 text-center text-sm text-zinc-500">
          No new updates
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <span className="text-sm font-medium text-zinc-300">Notifications</span>
        <button
          type="button"
          onClick={onClearAll}
          className="cursor-pointer text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Clear all
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {folders.map((folder) => (
          <div
            key={folder.folderId}
            className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/60"
          >
            <button
              type="button"
              onClick={() => {
                onClear(folder.folderId);
                router.push(`/player/${folder.folderId}`);
              }}
              className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 border-none bg-transparent p-0 text-left"
            >
              <span className="truncate text-sm font-medium text-zinc-200">
                {folder.folderName}
              </span>
              <span className="text-xs text-amber-500/70">New content</span>
            </button>
            <button
              type="button"
              onClick={() => onClear(folder.folderId)}
              className="cursor-pointer rounded p-1 text-zinc-600 opacity-0 transition-all hover:bg-zinc-700 hover:text-zinc-300 group-hover:opacity-100"
              aria-label={`Dismiss notification for ${folder.folderName}`}
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
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
