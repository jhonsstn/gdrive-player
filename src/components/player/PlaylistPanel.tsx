type PlaylistVideo = {
  id: string;
  name: string;
  mimeType: string;
  sourceUrl: string;
  folderId: string;
};

type PlaylistPanelProps = {
  videos: PlaylistVideo[];
  currentVideoId: string | null;
  onSelect: (videoId: string) => void;
};

export function PlaylistPanel({
  videos,
  currentVideoId,
  onSelect,
}: PlaylistPanelProps) {
  return (
    <aside
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 12rem)",
        padding: "1rem 0",
      }}
    >
      <div style={{ padding: "0 1.5rem", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-secondary)" }}>
          Playlist
        </h3>
      </div>
      
      {videos.length === 0 ? (
        <p style={{ padding: "0 1.5rem" }}>No videos available.</p>
      ) : null}

      <div style={{ overflowY: "auto", flex: 1, padding: "0 1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {videos.map((video) => {
            const active = video.id === currentVideoId;

            return (
              <button
                key={video.id}
                type="button"
                onClick={() => onSelect(video.id)}
                style={{
                  textAlign: "left",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  backgroundColor: active ? "var(--bg-tertiary)" : "transparent",
                  color: active ? "var(--accent-primary)" : "var(--text-primary)",
                  fontWeight: active ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "24px",
                  }}
                >
                  {active ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--text-muted)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                      <line x1="7" y1="2" x2="7" y2="22"></line>
                      <line x1="17" y1="2" x2="17" y2="22"></line>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <line x1="2" y1="7" x2="7" y2="7"></line>
                      <line x1="2" y1="17" x2="7" y2="17"></line>
                      <line x1="17" y1="17" x2="22" y2="17"></line>
                      <line x1="17" y1="7" x2="22" y2="7"></line>
                    </svg>
                  )}
                </div>
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {video.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
