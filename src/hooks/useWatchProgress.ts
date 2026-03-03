"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ProgressEntry = {
  currentTime: number;
  duration: number;
  watched: boolean;
};

type ProgressMap = Record<string, ProgressEntry>;

const FLUSH_INTERVAL_MS = 8_000;
const WATCHED_THRESHOLD = 0.9;

export function useWatchProgress(videoIds: string[]) {
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const bufferRef = useRef<{
    videoId: string;
    currentTime: number;
    duration: number;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Batch fetch progress on mount / when videoIds change
  useEffect(() => {
    if (videoIds.length === 0) return;

    let cancelled = false;
    async function fetchProgress() {
      const response = await fetch(
        `/api/progress?videoIds=${videoIds.join(",")}`,
      );
      if (!response.ok || cancelled) return;
      const data = (await response.json()) as { progress: ProgressMap };
      if (!cancelled) {
        setProgressMap(data.progress);
      }
    }

    void fetchProgress();
    return () => {
      cancelled = true;
    };
  }, [videoIds]);

  const flushBuffer = useCallback(async () => {
    const buf = bufferRef.current;
    if (!buf) return;

    const { videoId, currentTime, duration } = buf;
    bufferRef.current = null;

    const watched = duration > 0 && currentTime / duration >= WATCHED_THRESHOLD;

    // Optimistically update local state
    setProgressMap((prev) => ({
      ...prev,
      [videoId]: { currentTime, duration, watched },
    }));

    try {
      await fetch("/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId, currentTime, duration }),
      });
    } catch {
      // Silently ignore — the optimistic update still holds
    }
  }, []);

  // Periodic flush
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void flushBuffer();
    }, FLUSH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [flushBuffer]);

  // beforeunload — sendBeacon for reliable save on tab close
  useEffect(() => {
    function handleBeforeUnload() {
      const buf = bufferRef.current;
      if (!buf) return;
      navigator.sendBeacon(
        "/api/progress",
        new Blob(
          [JSON.stringify(buf)],
          { type: "application/json" },
        ),
      );
      bufferRef.current = null;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const recordTime = useCallback(
    (videoId: string, currentTime: number, duration: number) => {
      bufferRef.current = { videoId, currentTime, duration };
    },
    [],
  );

  const flush = useCallback(() => {
    void flushBuffer();
  }, [flushBuffer]);

  const getInitialTime = useCallback(
    (videoId: string): number => {
      const entry = progressMap[videoId];
      if (!entry) return 0;
      // If already watched, start from the beginning
      if (entry.watched) return 0;
      return entry.currentTime;
    },
    [progressMap],
  );

  const isWatched = useCallback(
    (videoId: string): boolean => {
      return progressMap[videoId]?.watched ?? false;
    },
    [progressMap],
  );

  return { recordTime, flush, getInitialTime, isWatched };
}
