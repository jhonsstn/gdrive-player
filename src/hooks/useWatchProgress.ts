"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { useWatchProgressBatch, invalidateAfterProgressUpdate } from "@/hooks/api";

// Keyed by Drive video ID, maps to folderVideoId
export type VideoMeta = Record<string, { folderVideoId: string | null }>;

const FLUSH_INTERVAL_MS = 5_000;
const WATCHED_THRESHOLD = 0.9;
const EMPTY_PROGRESS: Record<string, { currentTime: number; duration: number; watched: boolean }> = {};

export function useWatchProgress(videoIds: string[], videoMeta: VideoMeta) {
  const folderVideoIds = useMemo(
    () => videoIds.map((id) => videoMeta[id]?.folderVideoId ?? null),
    [videoIds, videoMeta],
  );

  const { data: progressData, mutate: mutateProgress } = useWatchProgressBatch(folderVideoIds);
  const progressMap = useMemo(() => progressData?.progress ?? EMPTY_PROGRESS, [progressData]);

  const bufferRef = useRef<{
    folderVideoId: string;
    currentTime: number;
    duration: number;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushBuffer = useCallback(async () => {
    const buf = bufferRef.current;
    if (!buf) return;

    const { folderVideoId, currentTime, duration } = buf;
    bufferRef.current = null;

    const watched = duration > 0 && currentTime / duration >= WATCHED_THRESHOLD;

    // Optimistically update local SWR cache
    void mutateProgress(
      (prev) => {
        if (!prev) return prev;
        return {
          progress: {
            ...prev.progress,
            [folderVideoId]: { currentTime, duration, watched },
          },
        };
      },
      { revalidate: false },
    );

    try {
      await fetch("/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderVideoId, currentTime, duration }),
      });

      invalidateAfterProgressUpdate();
    } catch {
      // Silently ignore — the optimistic update still holds
    }
  }, [mutateProgress]);

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
        new Blob([JSON.stringify(buf)], { type: "application/json" }),
      );
      bufferRef.current = null;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const recordTime = useCallback(
    (videoId: string, currentTime: number, duration: number) => {
      const folderVideoId = videoMeta[videoId]?.folderVideoId;
      if (!folderVideoId) return; // Can't track without folderVideoId
      bufferRef.current = { folderVideoId, currentTime, duration };
    },
    [videoMeta],
  );

  const flush = useCallback(() => {
    void flushBuffer();
  }, [flushBuffer]);

  const getInitialTime = useCallback(
    (videoId: string): number => {
      const folderVideoId = videoMeta[videoId]?.folderVideoId;
      if (!folderVideoId) return 0;
      const entry = progressMap[folderVideoId];
      if (!entry) return 0;
      if (entry.watched) return 0;
      return entry.currentTime;
    },
    [videoMeta, progressMap],
  );

  const isWatched = useCallback(
    (videoId: string): boolean => {
      const folderVideoId = videoMeta[videoId]?.folderVideoId;
      if (!folderVideoId) return false;
      return progressMap[folderVideoId]?.watched ?? false;
    },
    [videoMeta, progressMap],
  );

  return { recordTime, flush, getInitialTime, isWatched, mutateProgress };
}
