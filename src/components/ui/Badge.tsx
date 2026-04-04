type BadgeVariant = "amber" | "zinc";

type BadgeProps = {
  /** "sm" is used in list rows (smaller, uppercase); "md" is used in larger playlist items */
  size?: "sm" | "md";
  variant?: BadgeVariant;
  children: React.ReactNode;
};

const variantClasses: Record<BadgeVariant, string> = {
  amber: "bg-amber-400/10 text-amber-400",
  zinc: "bg-zinc-700/50 text-zinc-400",
};

export function Badge({ size = "md", variant = "amber", children }: BadgeProps) {
  return (
    <span
      className={`rounded font-bold ${variantClasses[variant]} ${
        size === "sm"
          ? "shrink-0 px-1.5 py-0.5 text-[11px] tracking-wider uppercase"
          : "px-2 py-1 text-xs"
      }`}
    >
      {children}
    </span>
  );
}
