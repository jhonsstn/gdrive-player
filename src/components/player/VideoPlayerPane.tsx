type VideoEntry = {
  id: string;
  name: string;
  mimeType: string;
};

type VideoPlayerPaneProps = {
  video: VideoEntry | null;
  canGoNext: boolean;
  canGoPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
};

export function VideoPlayerPane({
  video,
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
}: VideoPlayerPaneProps) {
  return (
    <section className="card" style={{ padding: "0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "1rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-tertiary)"
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {video ? video.name : "Select a video"}
        </h2>
        
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button 
            type="button" 
            onClick={onPrevious} 
            disabled={!canGoPrevious}
            style={{ padding: "0.4rem 0.75rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
            title="Previous video"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="19 20 9 12 19 4 19 20"></polygon>
              <line x1="5" y1="19" x2="5" y2="5"></line>
            </svg>
            <span style={{ display: "none" }}>Prev</span>
          </button>
          <button 
            type="button" 
            onClick={onNext} 
            disabled={!canGoNext}
            style={{ padding: "0.4rem 0.75rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
            title="Next video"
          >
            <span style={{ display: "none" }}>Next</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: "#000", width: "100%", display: "flex", justifyContent: "center", alignContent: "center", minHeight: "400px" }}>
        {video ? (
          <video
            key={video.id}
            controls
            preload="metadata"
            style={{ width: "100%", maxHeight: "calc(100vh - 16rem)", outline: "none" }}
            autoPlay
          >
            <source src={`/api/stream/${video.id}`} type={video.mimeType} />
            Your browser does not support HTML5 video playback.
          </video>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", width: "100%" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "1rem", opacity: 0.5 }}>
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <p style={{ margin: 0 }}>Select a video from the playlist to start playback</p>
          </div>
        )}
      </div>
    </section>
  );
}
