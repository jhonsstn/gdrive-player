"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { sortByNaturalName, type SortDirection } from "@/lib/sort";
import { Button } from "@/components/ui/Button";
import { SortButton } from "@/components/ui/SortButton";
import { Badge } from "@/components/ui/Badge";

type ConfiguredFolder = {
  id: string;
  folderId: string;
  name: string | null;
  sourceUrl: string;
  archived: boolean;
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
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [migratingId, setMigratingId] = useState<string | null>(null);
  const [migrateUrl, setMigrateUrl] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const hasFolders = useMemo(() => folders.length > 0, [folders.length]);

  const displayedFolders = useMemo(() => {
    const query = search.toLowerCase();
    const filtered = folders.filter(
      (f) =>
        (f.name ?? "").toLowerCase().includes(query) ||
        f.folderId.toLowerCase().includes(query),
    );
    const sorted = sortByNaturalName(
      filtered.map((f) => ({ ...f, name: f.name ?? "Unnamed folder" })),
      sortDirection,
    );
    return [...sorted.filter((f) => !f.archived), ...sorted.filter((f) => f.archived)];
  }, [folders, search, sortDirection]);

  async function handleAddFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/config/folders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }

      const parsed = (await response.json()) as { folder: ConfiguredFolder };
      setFolders((current) => [parsed.folder, ...current]);
      setSourceUrl("");
      toast.success("Folder added successfully.");
    } catch {
      toast.error("Failed to add folder.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMigrateFolder(id: string) {
    setMigrating(true);

    try {
      const response = await fetch("/api/config/folders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, sourceUrl: migrateUrl }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }

      const parsed = (await response.json()) as { folder: ConfiguredFolder };
      setFolders((current) => current.map((f) => (f.id === id ? parsed.folder : f)));
      toast.success("Folder migrated successfully.");
      setMigratingId(null);
      setMigrateUrl("");
    } catch {
      toast.error("Failed to migrate folder.");
    } finally {
      setMigrating(false);
    }
  }

  async function handleSyncFolder(folderId: string, folderDbId: string) {
    setSyncingId(folderDbId);
    try {
      const response = await fetch("/api/config/folders/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderId }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }

      const parsed = (await response.json()) as { count: number };
      toast.success(`Synced ${parsed.count} video${parsed.count !== 1 ? "s" : ""}.`);
    } catch {
      toast.error("Failed to sync folder.");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleSyncAll() {
    setSyncingAll(true);
    try {
      const response = await fetch("/api/config/folders/sync-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }

      const parsed = (await response.json()) as { count: number };
      toast.success(`Synced ${parsed.count} total video${parsed.count !== 1 ? "s" : ""} across all folders.`);
    } catch {
      toast.error("Failed to sync all folders.");
    } finally {
      setSyncingAll(false);
    }
  }

  async function handleDeleteFolder(id: string) {
    const response = await fetch("/api/config/folders", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      toast.error(await readApiError(response));
      return;
    }

    setFolders((current) => current.filter((folder) => folder.id !== id));
    toast.success("Folder removed.");
  }

  async function handleArchiveToggle(id: string, currentArchived: boolean) {
    setArchivingId(id);
    try {
      const response = await fetch("/api/config/folders", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, archived: !currentArchived }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }

      const parsed = (await response.json()) as { folder: ConfiguredFolder };
      setFolders((current) => current.map((f) => (f.id === id ? parsed.folder : f)));
      toast.success(!currentArchived ? "Folder archived." : "Folder unarchived.");
    } catch {
      toast.error("Failed to toggle archive status.");
    } finally {
      setArchivingId(null);
    }
  }

  async function handleRenameFolder(id: string) {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    setRenamingId(id);
    try {
      const response = await fetch("/api/config/folders", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, name: trimmed }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }

      const parsed = (await response.json()) as { folder: ConfiguredFolder };
      setFolders((current) => current.map((f) => (f.id === id ? parsed.folder : f)));
      setEditingId(null);
      setEditingName("");
      toast.success("Folder renamed.");
    } catch {
      toast.error("Failed to rename folder.");
    } finally {
      setRenamingId(null);
    }
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
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Saving..." : "Add folder"}
          </Button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold tracking-tight">
            Configured Folders ({folders.length})
          </h3>
          {hasFolders && (
            <SortButton
              direction={sortDirection}
              onToggle={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
            />
          )}
        </div>

        {hasFolders && (
          <div className="mb-4 flex items-center justify-between gap-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search folders…"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-50 placeholder:text-zinc-500 focus:outline-2 focus:outline-blue-500 sm:w-64"
            />
            <Button
              variant="secondary"
              disabled={syncingAll}
              onClick={handleSyncAll}
              className="whitespace-nowrap"
            >
              {syncingAll ? "Syncing All…" : "Sync All"}
            </Button>
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
                className={`rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm transition-opacity${folder.archived ? " opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between px-6 py-5">
                  <div className="overflow-hidden pr-4">
                    <div className="mb-1 flex items-center gap-2">
                      {editingId === folder.id ? (
                        <>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameFolder(folder.id);
                              if (e.key === "Escape") { setEditingId(null); setEditingName(""); }
                            }}
                            disabled={renamingId === folder.id}
                            autoFocus
                            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm font-medium text-zinc-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
                          />
                          <button
                            onClick={() => handleRenameFolder(folder.id)}
                            disabled={renamingId === folder.id || !editingName.trim()}
                            aria-label="Save name"
                            className="text-zinc-400 transition-colors hover:text-blue-400 disabled:opacity-40"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditingName(""); }}
                            disabled={renamingId === folder.id}
                            aria-label="Cancel rename"
                            className="text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-40"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-zinc-50">{folder.name ?? "Unnamed folder"}</p>
                          <button
                            onClick={() => { setEditingId(folder.id); setEditingName(folder.name ?? ""); }}
                            aria-label="Edit folder name"
                            className="text-zinc-600 transition-colors hover:text-zinc-300"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </>
                      )}
                      {folder.archived && <Badge variant="zinc" size="sm">Archived</Badge>}
                    </div>
                    <code className="mb-2 inline-block rounded-md bg-zinc-800 px-2 py-1 text-[0.8rem] text-zinc-400">
                      ID: {folder.folderId}
                    </code>
                    <div
                      className="overflow-hidden text-[0.9rem] text-ellipsis whitespace-nowrap text-zinc-400"
                      title={folder.sourceUrl}
                    >
                      {folder.sourceUrl}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      disabled={syncingId === folder.id}
                      onClick={() => handleSyncFolder(folder.folderId, folder.id)}
                    >
                      {syncingId === folder.id ? "Syncing…" : "Sync"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setMigratingId(migratingId === folder.id ? null : folder.id);
                        setMigrateUrl("");
                      }}
                    >
                      Migrate
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={archivingId === folder.id}
                      onClick={() => handleArchiveToggle(folder.id, folder.archived)}
                    >
                      {archivingId === folder.id
                        ? "Saving…"
                        : folder.archived
                          ? "Unarchive"
                          : "Archive"}
                    </Button>
                    <Button variant="destructive" onClick={() => handleDeleteFolder(folder.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
                {migratingId === folder.id && (
                  <div className="border-t border-zinc-800 px-6 py-4">
                    <p className="mb-3 text-sm text-zinc-400">
                      Enter the new Google Drive folder URL. Watch progress will be preserved.
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={migrateUrl}
                        onChange={(e) => setMigrateUrl(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/..."
                        disabled={migrating}
                        className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 transition-all duration-200 placeholder:text-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <Button
                        variant="primary"
                        disabled={migrating || !migrateUrl.trim()}
                        onClick={() => handleMigrateFolder(folder.id)}
                      >
                        {migrating ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={migrating}
                        onClick={() => { setMigratingId(null); setMigrateUrl(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
