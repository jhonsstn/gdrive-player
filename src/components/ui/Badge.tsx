type BadgeProps = {
  /** "sm" is used in list rows (smaller, uppercase); "md" is used in larger playlist items */
  size?: "sm" | "md";
  children: React.ReactNode;
};

export function Badge({ size = "md", children }: BadgeProps) {
  return (
    <span
      className={`rounded bg-amber-400/10 font-bold text-amber-400 ${
        size === "sm"
          ? "shrink-0 px-1.5 py-0.5 text-[11px] tracking-wider uppercase"
          : "px-2 py-1 text-xs"
      }`}
    >
      {children}
    </span>
  );
}
