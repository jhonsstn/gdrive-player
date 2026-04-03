"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { useWatchProgressBatch, invalidateAfterProgressUpdate } from "@/hooks/api";

export type VideoMeta = Record<string, { folderId: string; modifiedTime: string | null; name: string }>;

const FLUSH_INTERVAL_MS = 5_000;
const WATCHED_THRESHOLD = 0.9;
const EMPTY_PROGRESS: Record<string, { currentTime: number; duration: number; watched: boolean }> = {};

export function useWatchProgress(videoIds: string[], videoMeta: VideoMeta) {
  const { data: progressData, mutate: mutateProgress } = useWatchProgressBatch(videoIds);
  const progressMap = useMemo(() => progressData?.progress ?? EMPTY_PROGRESS, [progressData]);

  const bufferRef = useRef<{
    videoId: string;
    currentTime: number;
    duration: number;
    folderId?: string;
    videoName?: string;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushBuffer = useCallback(async () => {
    const buf = bufferRef.current;
    if (!buf) return;

    const { videoId, currentTime, duration, folderId, videoName } = buf;
    bufferRef.current = null;

    const watched = duration > 0 && currentTime / duration >= WATCHED_THRESHOLD;

    // Optimistically update local SWR cache
    void mutateProgress(
      (prev) => {
        if (!prev) return prev;
        return {
          progress: {
            ...prev.progress,
            [videoId]: { currentTime, duration, watched },
          },
        };
      },
      { revalidate: false },
    );

    try {
      await fetch("/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId, currentTime, duration, folderId, videoName }),
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
      const meta = videoMeta[videoId];
      bufferRef.current = {
        videoId,
        currentTime,
        duration,
        folderId: meta?.folderId,
        videoName: meta?.name,
      };
    },
    [videoMeta],
  );

  const flush = useCallback(() => {
    void flushBuffer();
  }, [flushBuffer]);

  const getInitialTime = useCallback(
    (videoId: string): number => {
      const entry = progressMap[videoId];
      if (!entry) return 0;
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
