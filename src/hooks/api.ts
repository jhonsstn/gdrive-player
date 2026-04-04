import useSWR, { mutate as globalMutate } from "swr";
import useSWRInfinite from "swr/infinite";

type Folder = {
  id: string;
  folderId: string;
  name: string | null;
};

type ContinueWatchingItem = {
  videoId: string;
  videoName: string;
  folderId: string;
  currentTime: number;
  duration: number;
  updatedAt: string;
};

type PlayerVideo = {
  id: string;
  name: string;
  mimeType: string;
  sourceUrl: string;
  folderId: string;
  modifiedTime: string | null;
  folderVideoId: string | null;
};

type ProgressEntry = {
  currentTime: number;
  duration: number;
  watched: boolean;
};

type SortDirection = "asc" | "desc";

// ── Folders ──

export function useFolders() {
  return useSWR<{ folders: Folder[] }>("/api/folders", {
    dedupingInterval: 5 * 60 * 1000,
  });
}

// ── Has New (Drive API — revalidate on focus) ──

export function useFoldersHasNew(folderIds: string[]) {
  const key = folderIds.length > 0
    ? `/api/folders/has-new?folderIds=${folderIds.join(",")}`
    : null;

  return useSWR<{ hasNew: Record<string, boolean>; hasNotSeen: Record<string, boolean>; isEmpty: Record<string, boolean> }>(key, {
    dedupingInterval: 60 * 1000,
    revalidateOnFocus: true,
  });
}

// ── Continue Watching ──

export function useContinueWatching() {
  return useSWR<{ items: ContinueWatchingItem[] }>("/api/progress/continue-watching", {
    dedupingInterval: 30 * 1000,
    revalidateOnFocus: true,
  });
}

// ── Videos (paginated via useSWRInfinite) ──

export function useVideos(folderId: string, sort: SortDirection) {
  const { data, error, isLoading, size, setSize, isValidating } = useSWRInfinite<{
    videos: PlayerVideo[];
    sort: SortDirection;
    nextPageToken?: string;
  }>(
    (pageIndex, previousPageData) => {
      // Stop fetching if there's no next page
      if (previousPageData && !previousPageData.nextPageToken) return null;

      const params = new URLSearchParams({
        sort,
        folderId,
      });

      if (previousPageData?.nextPageToken) {
        params.set("pageToken", previousPageData.nextPageToken);
      }

      return `/api/videos?${params.toString()}`;
    },
    {
      dedupingInterval: 2 * 60 * 1000,
      revalidateFirstPage: false,
    },
  );

  const videos = data ? data.flatMap((page) => page.videos) : [];
  const hasMore = data ? !!data[data.length - 1]?.nextPageToken : false;
  const isLoadingMore = size > 0 && data && typeof data[size - 1] === "undefined" && isValidating;

  return {
    videos,
    isLoading,
    error,
    hasMore,
    isLoadingMore: !!isLoadingMore,
    loadMore: () => setSize(size + 1),
  };
}

// ── Watch Progress (batch) ──

export function useWatchProgressBatch(folderVideoIds: (string | null)[]) {
  const validIds = folderVideoIds.filter((id): id is string => id !== null);
  const key = validIds.length > 0
    ? `/api/progress?folderVideoIds=${validIds.join(",")}`
    : null;

  return useSWR<{ progress: Record<string, ProgressEntry> }>(key, {
    dedupingInterval: 30 * 1000,
    keepPreviousData: true,
  });
}

// ── Cache Invalidation ──

export async function invalidateAfterProgressUpdate(folderId?: string) {
  // Invalidate all progress-related caches
  // IMPORTANT: Do not pass 'undefined' as data or it will clear the cache before revalidating
  const promises: Promise<unknown>[] = [
    globalMutate(
      (key: unknown) => typeof key === "string" && key.startsWith("/api/progress"),
      undefined,
      { revalidate: true, populateCache: false },
    ),
  ];

  if (folderId) {
    // Revalidate folder badges
    promises.push(
      globalMutate(
        (key: unknown) => typeof key === "string" && key.startsWith("/api/folders/has-new"),
        undefined,
        { revalidate: true, populateCache: false },
      ),
    );
  }

  await Promise.all(promises);
}
