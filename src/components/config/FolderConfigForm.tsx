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
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <section className="card" style={{ padding: "2rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "1.5rem", fontSize: "1.125rem" }}>
          Add New Folder
        </h3>
        
        <form onSubmit={handleAddFolder} style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="sourceUrl" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
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
            />
          </div>
          <button type="submit" disabled={submitting} className="primary" style={{ padding: "0.5rem 1.5rem", height: "38px" }}>
            {submitting ? "Saving..." : "Add folder"}
          </button>
        </form>

        {message ? (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: message.type === 'error' ? "var(--error-bg)" : "rgba(34, 197, 94, 0.1)",
              border: `1px solid ${message.type === 'error' ? "var(--error)" : "#22c55e"}`,
              color: message.type === 'error' ? "var(--error)" : "#22c55e",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}
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
        <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.125rem" }}>
          Configured Folders ({folders.length})
        </h3>
        
        {!hasFolders ? (
          <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", borderStyle: "dashed" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "1rem", opacity: 0.5 }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <p style={{ margin: 0 }}>No folders configured yet. Add one above.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="card"
                style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  padding: "1.25rem 1.5rem" 
                }}
              >
                <div style={{ overflow: "hidden", paddingRight: "1rem" }}>
                  <code 
                    style={{ 
                      display: "inline-block",
                      padding: "0.25rem 0.5rem", 
                      backgroundColor: "var(--bg-tertiary)", 
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.8rem",
                      marginBottom: "0.5rem",
                      color: "var(--accent-primary)"
                    }}
                  >
                    ID: {folder.folderId}
                  </code>
                  <div 
                    style={{ 
                      whiteSpace: "nowrap", 
                      overflow: "hidden", 
                      textOverflow: "ellipsis",
                      color: "var(--text-secondary)",
                      fontSize: "0.9rem"
                    }}
                    title={folder.sourceUrl}
                  >
                    {folder.sourceUrl}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="destructive"
                  style={{ flexShrink: 0 }}
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
