"use client";

type SortButtonProps = {
  direction: "asc" | "desc";
  onToggle: () => void;
};

export function SortButton({ direction, onToggle }: SortButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={direction === "desc"}
      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-transform duration-200 ${direction === "desc" ? "rotate-180" : ""}`}
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </svg>
      Sort {direction === "asc" ? "Ascending" : "Descending"}
    </button>
  );
}
