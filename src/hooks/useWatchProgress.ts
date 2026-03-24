"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { useWatchProgressBatch, useLastSeen, useNotificationBaselines, invalidateAfterProgressUpdate } from "@/hooks/api";

export type VideoMeta = Record<string, { folderId: string; modifiedTime: string | null; name: string }>;

const FLUSH_INTERVAL_MS = 5_000;
const WATCHED_THRESHOLD = 0.9;
const EMPTY_PROGRESS: Record<string, { currentTime: number; duration: number; watched: boolean }> = {};
const EMPTY_LAST_SEEN: Record<string, string> = {};
const EMPTY_BASELINES: Record<string, string> = {};

export function useWatchProgress(videoIds: string[], videoMeta: VideoMeta) {
  const { data: progressData, mutate: mutateProgress } = useWatchProgressBatch(videoIds);
  const progressMap = useMemo(() => progressData?.progress ?? EMPTY_PROGRESS, [progressData]);

  const folderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const meta of Object.values(videoMeta)) {
      ids.add(meta.folderId);
    }
    return [...ids];
  }, [videoMeta]);

  const { data: lastSeenData, mutate: mutateLastSeen } = useLastSeen(folderIds);
  const lastSeenMap = useMemo(() => lastSeenData?.lastSeen ?? EMPTY_LAST_SEEN, [lastSeenData]);
  const lastSeenLoaded = !!lastSeenData;

  const { data: baselinesData } = useNotificationBaselines(folderIds);
  const baselinesMap = useMemo(() => baselinesData?.baselines ?? EMPTY_BASELINES, [baselinesData]);

  const bufferRef = useRef<{
    videoId: string;
    currentTime: number;
    duration: number;
    folderId?: string;
    videoModifiedTime?: string;
    videoName?: string;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushBuffer = useCallback(async () => {
    const buf = bufferRef.current;
    if (!buf) return;

    const { videoId, currentTime, duration, folderId, videoModifiedTime, videoName } = buf;
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

    // Optimistically update last-seen when watched
    if (watched && folderId && videoModifiedTime) {
      void mutateLastSeen(
        (prev) => {
          if (!prev) return prev;
          const current = prev.lastSeen[folderId];
          if (!current || videoModifiedTime > current) {
            return { lastSeen: { ...prev.lastSeen, [folderId]: videoModifiedTime } };
          }
          return prev;
        },
        { revalidate: false },
      );
    }

    try {
      await fetch("/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          videoId,
          currentTime,
          duration,
          folderId,
          videoModifiedTime,
          videoName,
        }),
      });

      // Also update last-seen via dedicated endpoint when watched
      if (watched && folderId && videoModifiedTime) {
        await fetch("/api/progress/last-seen", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ folderId, videoModifiedTime }),
        });
      }

      // Invalidate continue-watching and has-new caches in background
      invalidateAfterProgressUpdate();
    } catch {
      // Silently ignore — the optimistic update still holds
    }
  }, [mutateProgress, mutateLastSeen]);

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
        videoModifiedTime: meta?.modifiedTime ?? undefined,
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

  // Compute effective last-seen per folder (min modifiedTime as fallback for first visit)
  const effectiveLastSeen = useMemo(() => {
    const result: Record<string, string> = { ...lastSeenMap };
    // For folders with no DB record, use minimum modifiedTime (all videos show as NOT SEEN)
    for (const fId of folderIds) {
      if (!result[fId]) {
        let minTime: string | null = null;
        for (const meta of Object.values(videoMeta)) {
          if (
            meta.folderId === fId &&
            meta.modifiedTime &&
            (!minTime || meta.modifiedTime < minTime)
          ) {
            minTime = meta.modifiedTime;
          }
        }
        if (minTime) {
          result[fId] = minTime;
        }
      }
    }
    return result;
  }, [lastSeenMap, folderIds, videoMeta]);

  // NOT SEEN: video is newer than last-seen threshold and unwatched
  const isNotSeen = useCallback(
    (videoId: string): boolean => {
      if (!lastSeenLoaded) return false;
      const meta = videoMeta[videoId];
      if (!meta?.modifiedTime) return false;
      const threshold = effectiveLastSeen[meta.folderId];
      if (!threshold) return false;
      return meta.modifiedTime > threshold && !isWatched(videoId);
    },
    [videoMeta, effectiveLastSeen, isWatched, lastSeenLoaded],
  );

  // NEW: video is newer than notification baseline (genuinely new content)
  const isNew = useCallback(
    (videoId: string): boolean => {
      const meta = videoMeta[videoId];
      if (!meta?.modifiedTime) return false;
      const baseline = baselinesMap[meta.folderId];
      if (!baseline) return false;
      return meta.modifiedTime > baseline;
    },
    [videoMeta, baselinesMap],
  );

  return { recordTime, flush, getInitialTime, isWatched, isNotSeen, isNew };
}
