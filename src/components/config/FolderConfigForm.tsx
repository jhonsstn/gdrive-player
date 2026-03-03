"use client";

import { useMemo, useState } from "react";

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
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasFolders = useMemo(() => folders.length > 0, [folders.length]);

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
        setMessage({ text: await readApiError(response), type: 'error' });
        return;
      }

      const parsed = (await response.json()) as { folder: ConfiguredFolder };
      setFolders((current) => [parsed.folder, ...current]);
      setSourceUrl("");
      setMessage({ text: "Folder added successfully.", type: 'success' });
    } catch {
      setMessage({ text: "Failed to add folder.", type: 'error' });
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
      setMessage({ text: await readApiError(response), type: 'error' });
      return;
    }

    setFolders((current) => current.filter((folder) => folder.id !== id));
    setMessage({ text: "Folder removed.", type: 'success' });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-sm p-8">
        <h3 className="text-lg font-semibold tracking-tight mb-6">
          Add New Folder
        </h3>

        <form onSubmit={handleAddFolder} className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="sourceUrl" className="block mb-2 text-sm font-medium text-zinc-400">
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
              className="w-full py-2 px-3 text-sm rounded-md border border-zinc-800 bg-zinc-900 text-zinc-50 transition-all duration-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center text-sm font-medium rounded-md border border-transparent bg-blue-500 text-white cursor-pointer transition-all duration-200 hover:not-disabled:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-2 px-6 h-[38px]"
          >
            {submitting ? "Saving..." : "Add folder"}
          </button>
        </form>

        {message ? (
          <div
            className={`mt-4 py-3 px-4 rounded-md text-[0.9rem] flex items-center gap-2 border ${
              message.type === 'error'
                ? "bg-red-500/10 border-red-500 text-red-500"
                : "bg-green-500/10 border-green-500 text-green-500"
            }`}
          >
            {message.type === 'error' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            )}
            {message.text}
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="text-lg font-semibold tracking-tight mb-4">
          Configured Folders ({folders.length})
        </h3>

        {!hasFolders ? (
          <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl shadow-sm py-12 px-8 text-center text-zinc-500">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50 mx-auto">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <p>No folders configured yet. Add one above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-sm flex justify-between items-center py-5 px-6"
              >
                <div className="overflow-hidden pr-4">
                  <p className="font-medium text-zinc-50 mb-1">
                    {folder.name ?? "Unnamed folder"}
                  </p>
                  <code className="inline-block py-1 px-2 bg-zinc-800 rounded-md text-[0.8rem] mb-2 text-blue-500">
                    ID: {folder.folderId}
                  </code>
                  <div
                    className="whitespace-nowrap overflow-hidden text-ellipsis text-zinc-400 text-[0.9rem]"
                    title={folder.sourceUrl}
                  >
                    {folder.sourceUrl}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="inline-flex items-center justify-center text-sm font-medium rounded-md border border-red-500/10 bg-transparent text-red-500 cursor-pointer transition-all duration-200 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 py-2 px-4 shrink-0"
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
