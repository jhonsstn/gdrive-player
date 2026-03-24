type StatusMessageProps = {
  type: "error" | "success";
  message: string;
};

export function StatusMessage({ type, message }: StatusMessageProps) {
  return (
    <div
      className={`mt-4 flex items-center gap-2 rounded-md border px-4 py-3 text-sm ${
        type === "error"
          ? "border-red-500 bg-red-500/10 text-red-500"
          : "border-green-500 bg-green-500/10 text-green-500"
      }`}
    >
      {type === "error" ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )}
      {message}
    </div>
  );
}
