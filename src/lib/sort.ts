export type SortDirection = "asc" | "desc";

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function parseSortDirection(
  value: string | null | undefined,
): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

export function compareNaturalName(
  left: string,
  right: string,
  direction: SortDirection,
): number {
  const baseCompare = naturalCollator.compare(left, right);
  return direction === "asc" ? baseCompare : baseCompare * -1;
}

export function sortByNaturalName<T extends { name: string }>(
  items: readonly T[],
  direction: SortDirection,
): T[] {
  return [...items].sort((left, right) =>
    compareNaturalName(left.name, right.name, direction),
  );
}
