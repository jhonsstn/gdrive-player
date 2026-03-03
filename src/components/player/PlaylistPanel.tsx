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
    <aside>
      <h2>Playlist</h2>
      {videos.length === 0 ? <p>No videos available.</p> : null}
      <ol style={{ paddingLeft: "1rem" }}>
        {videos.map((video) => {
          const active = video.id === currentVideoId;

          return (
            <li key={video.id} style={{ marginBottom: "0.5rem" }}>
              <button
                type="button"
                onClick={() => onSelect(video.id)}
                style={{
                  fontWeight: active ? "bold" : "normal",
                  textAlign: "left",
                }}
              >
                {video.name}
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
