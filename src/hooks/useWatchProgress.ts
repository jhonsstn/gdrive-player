"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProgressEntry = {
  currentTime: number;
  duration: number;
  watched: boolean;
};

type ProgressMap = Record<string, ProgressEntry>;

export type VideoMeta = Record<string, { folderId: string; modifiedTime: string | null; name: string }>;

const FLUSH_INTERVAL_MS = 5_000;
const WATCHED_THRESHOLD = 0.9;

export function useWatchProgress(videoIds: string[], videoMeta: VideoMeta) {
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, string>>({});
  const lastSeenLoaded = useRef(false);
  const bufferRef = useRef<{
    videoId: string;
    currentTime: number;
    duration: number;
    folderId?: string;
    videoModifiedTime?: string;
    videoName?: string;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Batch fetch progress on mount / when videoIds change
  useEffect(() => {
    if (videoIds.length === 0) return;

    let cancelled = false;
    async function fetchProgress() {
      const response = await fetch(`/api/progress?videoIds=${videoIds.join(",")}`);
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

  // Fetch last-seen timestamps
  const folderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const meta of Object.values(videoMeta)) {
      ids.add(meta.folderId);
    }
    return [...ids];
  }, [videoMeta]);

  useEffect(() => {
    if (folderIds.length === 0) return;

    let cancelled = false;
    async function fetchLastSeen() {
      const response = await fetch(`/api/progress/last-seen?folderIds=${folderIds.join(",")}`);
      if (!response.ok || cancelled) return;
      const data = (await response.json()) as {
        lastSeen: Record<string, string>;
      };
      if (!cancelled) {
        setLastSeenMap(data.lastSeen);
        lastSeenLoaded.current = true;
      }
    }

    void fetchLastSeen();
    return () => {
      cancelled = true;
    };
  }, [folderIds]);

  const flushBuffer = useCallback(async () => {
    const buf = bufferRef.current;
    if (!buf) return;

    const { videoId, currentTime, duration, folderId, videoModifiedTime, videoName } = buf;
    bufferRef.current = null;

    const watched = duration > 0 && currentTime / duration >= WATCHED_THRESHOLD;

    // Optimistically update local state
    setProgressMap((prev) => ({
      ...prev,
      [videoId]: { currentTime, duration, watched },
    }));

    // Optimistically update last-seen when watched
    if (watched && folderId && videoModifiedTime) {
      setLastSeenMap((prev) => {
        const current = prev[folderId];
        if (!current || videoModifiedTime > current) {
          return { ...prev, [folderId]: videoModifiedTime };
        }
        return prev;
      });
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
    // For folders with no DB record, use minimum modifiedTime (all videos show as NEW)
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

  const isNew = useCallback(
    (videoId: string): boolean => {
      if (!lastSeenLoaded.current) return false;
      const meta = videoMeta[videoId];
      if (!meta?.modifiedTime) return false;
      const threshold = effectiveLastSeen[meta.folderId];
      if (!threshold) return false;
      return meta.modifiedTime > threshold && !isWatched(videoId);
    },
    [videoMeta, effectiveLastSeen, isWatched],
  );

  return { recordTime, flush, getInitialTime, isWatched, isNew };
}
