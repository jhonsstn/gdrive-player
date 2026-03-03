"use client";

import { useMemo, useState } from "react";

type ConfiguredFolder = {
  id: string;
  folderId: string;
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
  const [message, setMessage] = useState<string | null>(null);
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
        setMessage(await readApiError(response));
        return;
      }

      const parsed = (await response.json()) as { folder: ConfiguredFolder };
      setFolders((current) => [parsed.folder, ...current]);
      setSourceUrl("");
      setMessage("Folder added.");
    } catch {
      setMessage("Failed to add folder.");
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
      setMessage(await readApiError(response));
      return;
    }

    setFolders((current) => current.filter((folder) => folder.id !== id));
    setMessage("Folder removed.");
  }

  return (
    <section style={{ maxWidth: 800 }}>
      <form onSubmit={handleAddFolder} style={{ display: "grid", gap: "0.75rem" }}>
        <label htmlFor="sourceUrl">Google Drive folder URL</label>
        <input
          id="sourceUrl"
          type="text"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
          required
          disabled={submitting}
          style={{ padding: "0.5rem" }}
        />
        <button type="submit" disabled={submitting} style={{ width: "fit-content" }}>
          {submitting ? "Saving..." : "Add folder"}
        </button>
      </form>

      {message ? <p>{message}</p> : null}

      <h2>Configured folders</h2>
      {!hasFolders ? <p>No folders configured yet.</p> : null}

      <ul style={{ paddingLeft: "1rem" }}>
        {folders.map((folder) => (
          <li key={folder.id} style={{ marginBottom: "0.75rem" }}>
            <code>{folder.folderId}</code>
            <div>{folder.sourceUrl}</div>
            <button
              type="button"
              onClick={() => handleDeleteFolder(folder.id)}
              style={{ marginTop: "0.25rem" }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
