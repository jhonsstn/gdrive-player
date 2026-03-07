"use client";

import { useMemo, useState } from "react";

import { sortByNaturalName, type SortDirection } from "@/lib/sort";

type ConfiguredFolder = {
  id: string;
  folderId: string;
  name: string | null;
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
};

type FolderConfigFormProps = {
  initialFolders: ConfiguredFolder[];
};

async function readApiError(response: Response): Promise<string> {
  try {
    const parsed = (await response.json()) as { error?: string };
    return parsed.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export function FolderConfigForm({ initialFolders }: FolderConfigFormProps) {
  const [folders, setFolders] = useState<ConfiguredFolder[]>(initialFolders);
  const [sourceUrl, setSourceUrl] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const hasFolders = useMemo(() => folders.length > 0, [folders.length]);

  const displayedFolders = useMemo(() => {
    const query = search.toLowerCase();
    const filtered = folders.filter(
      (f) =>
        (f.name ?? "").toLowerCase().includes(query) ||
        f.folderId.toLowerCase().includes(query),
    );
    return sortByNaturalName(
      filtered.map((f) => ({ ...f, name: f.name ?? "Unnamed folder" })),
      sortDirection,
    );
  }, [folders, search, sortDirection]);

  async function handleAddFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/config/folders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });

      if (!response.ok) {
        setMessage({ text: await readApiError(response), type: "error" });
        return;
      }

      const parsed = (await response.json()) as { folder: ConfiguredFolder };
      setFolders((current) => [parsed.folder, ...current]);
      setSourceUrl("");
      setMessage({ text: "Folder added successfully.", type: "success" });
    } catch {
      setMessage({ text: "Failed to add folder.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteFolder(id: string) {
    setMessage(null);

    const response = await fetch("/api/config/folders", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      setMessage({ text: await readApiError(response), type: "error" });
      return;
    }

    setFolders((current) => current.filter((folder) => folder.id !== id));
    setMessage({ text: "Folder removed.", type: "success" });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-sm">
        <h3 className="mb-6 text-lg font-semibold tracking-tight">Add New Folder</h3>

        <form onSubmit={handleAddFolder} className="flex items-end gap-4">
          <div className="flex-1">
            <label htmlFor="sourceUrl" className="mb-2 block text-sm font-medium text-zinc-400">
              Google Drive folder URL
            </label>
            <input
              id="sourceUrl"
              type="text"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              required
              disabled={submitting}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 transition-all duration-200 placeholder:text-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-[38px] cursor-pointer items-center justify-center rounded-md border border-transparent bg-blue-500 px-6 py-2 text-sm font-medium text-white transition-all duration-200 hover:not-disabled:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Add folder"}
          </button>
        </form>

        {message ? (
          <div
            className={`mt-4 flex items-center gap-2 rounded-md border px-4 py-3 text-[0.9rem] ${
              message.type === "error"
                ? "border-red-500 bg-red-500/10 text-red-500"
                : "border-green-500 bg-green-500/10 text-green-500"
            }`}
          >
            {message.type === "error" ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            )}
            {message.text}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold tracking-tight">
            Configured Folders ({folders.length})
          </h3>
          {hasFolders && (
            <button
              type="button"
              onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
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
          )}
        </div>

        {hasFolders && (
          <div className="mb-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search folders…"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-50 placeholder:text-zinc-500 focus:outline-2 focus:outline-blue-500 sm:w-64"
            />
          </div>
        )}

        {!hasFolders ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900 px-8 py-12 text-center text-zinc-500 shadow-sm">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto mb-4 opacity-50"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <p>No folders configured yet. Add one above.</p>
          </div>
        ) : displayedFolders.length === 0 ? (
          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4 text-center text-zinc-400">
            No folders match your search.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {displayedFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-5 shadow-sm"
              >
                <div className="overflow-hidden pr-4">
                  <p className="mb-1 font-medium text-zinc-50">{folder.name ?? "Unnamed folder"}</p>
                  <code className="mb-2 inline-block rounded-md bg-zinc-800 px-2 py-1 text-[0.8rem] text-blue-500">
                    ID: {folder.folderId}
                  </code>
                  <div
                    className="overflow-hidden text-[0.9rem] text-ellipsis whitespace-nowrap text-zinc-400"
                    title={folder.sourceUrl}
                  >
                    {folder.sourceUrl}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-red-500/10 bg-transparent px-4 py-2 text-sm font-medium text-red-500 transition-all duration-200 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
