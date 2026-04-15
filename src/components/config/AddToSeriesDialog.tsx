"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@/components/ui/Dialog";

type Series = {
  id: string;
  name: string;
  seasons: { id: string; seasonNumber: number; folderId: string; folderName: string | null }[];
};

type AddToSeriesDialogProps = {
  open: boolean;
  onClose: () => void;
  folderName: string;
  folderId: string;
  seriesList: Series[];
  saving: boolean;
  onSave: (params: {
    seriesId: string;
    newSeriesName: string;
    seasonNumber: number;
    folderId: string;
  }) => void;
};

export function AddToSeriesDialog({
  open,
  onClose,
  folderName,
  folderId,
  seriesList,
  saving,
  onSave,
}: AddToSeriesDialogProps) {
  const [mode, setMode] = useState<"existing" | "new">(
    seriesList.length > 0 ? "existing" : "new",
  );
  const [search, setSearch] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(
    seriesList.length > 0 ? seriesList[0].id : null,
  );
  const [newSeriesName, setNewSeriesName] = useState("");
  const [seasonNumber, setSeasonNumber] = useState(1);

  // Reset state when dialog opens
  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    setMode(seriesList.length > 0 ? "existing" : "new");
    setSearch("");
    setSelectedSeriesId(seriesList.length > 0 ? seriesList[0].id : null);
    setNewSeriesName("");
    setSeasonNumber(1);
  }
  if (open !== prevOpen) setPrevOpen(open);

  const filteredSeries = useMemo(() => {
    if (!search.trim()) return seriesList;
    const q = search.toLowerCase();
    return seriesList.filter((s) => s.name.toLowerCase().includes(q));
  }, [seriesList, search]);

  const selectedSeries = seriesList.find((s) => s.id === selectedSeriesId);

  // Auto-suggest next season number when selecting a series
  function selectSeries(id: string) {
    setSelectedSeriesId(id);
    const series = seriesList.find((s) => s.id === id);
    if (series && series.seasons.length > 0) {
      const maxSeason = Math.max(...series.seasons.map((s) => s.seasonNumber));
      setSeasonNumber(maxSeason + 1);
    } else {
      setSeasonNumber(1);
    }
  }

  function handleSubmit() {
    if (mode === "new") {
      onSave({
        seriesId: "__new__",
        newSeriesName: newSeriesName.trim(),
        seasonNumber,
        folderId,
      });
    } else if (selectedSeriesId) {
      onSave({
        seriesId: selectedSeriesId,
        newSeriesName: "",
        seasonNumber,
        folderId,
      });
    }
  }

  const canSave =
    mode === "new"
      ? newSeriesName.trim().length > 0
      : selectedSeriesId !== null;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent>
        <DialogHeader>
          <h3 className="text-base font-semibold text-zinc-50">Add to Series</h3>
          <p className="mt-1 text-sm text-zinc-400 truncate" title={folderName}>
            {folderName}
          </p>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-5">
          {/* Mode tabs */}
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "existing"
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Existing Series
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "new"
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              New Series
            </button>
          </div>

          {mode === "existing" ? (
            <div className="flex flex-col gap-3">
              {/* Search */}
              <div className="relative">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search series..."
                  autoFocus
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Series list */}
              <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-800">
                {filteredSeries.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-zinc-500">
                    {seriesList.length === 0
                      ? "No series yet. Create one first."
                      : "No series match your search."}
                  </div>
                ) : (
                  filteredSeries.map((series) => (
                    <button
                      key={series.id}
                      type="button"
                      onClick={() => selectSeries(series.id)}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                        selectedSeriesId === series.id
                          ? "bg-blue-500/10 text-blue-400"
                          : "text-zinc-300 hover:bg-zinc-800/50"
                      }`}
                    >
                      <span className="font-medium">{series.name}</span>
                      <span className="text-xs text-zinc-500">
                        {series.seasons.length} season{series.seasons.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Selected series info */}
              {selectedSeries && selectedSeries.seasons.length > 0 && (
                <div className="rounded-lg bg-zinc-950/50 px-3 py-2 text-xs text-zinc-500">
                  Seasons: {selectedSeries.seasons.map((s) => `S${s.seasonNumber}`).join(", ")}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                Series name
              </label>
              <input
                type="text"
                value={newSeriesName}
                onChange={(e) => setNewSeriesName(e.target.value)}
                placeholder="e.g. Naruto"
                autoFocus
                disabled={saving}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSave && !saving) handleSubmit();
                }}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          )}

          {/* Season number — always visible */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">
              Season number
            </label>
            <input
              type="number"
              min={1}
              value={seasonNumber}
              onChange={(e) => setSeasonNumber(parseInt(e.target.value) || 1)}
              disabled={saving}
              className="w-20 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={saving || !canSave}
            onClick={handleSubmit}
          >
            {saving ? "Saving..." : "Add to Series"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
