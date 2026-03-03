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
    <section>
      <h2>Player</h2>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <button type="button" onClick={onPrevious} disabled={!canGoPrevious}>
          Previous
        </button>
        <button type="button" onClick={onNext} disabled={!canGoNext}>
          Next
        </button>
      </div>

      {video ? (
        <>
          <p>{video.name}</p>
          <video
            key={video.id}
            controls
            preload="metadata"
            style={{ width: "100%", maxWidth: 900 }}
          >
            <source src={`/api/stream/${video.id}`} type={video.mimeType} />
            Your browser does not support HTML5 video playback.
          </video>
        </>
      ) : (
        <p>Select a video to start playback.</p>
      )}
    </section>
  );
}
