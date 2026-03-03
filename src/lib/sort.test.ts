import { describe, expect, it } from "vitest";

import { parseSortDirection, sortByNaturalName } from "@/lib/sort";

describe("sort utilities", () => {
  it("defaults to ascending when sort param is invalid", () => {
    expect(parseSortDirection(undefined)).toBe("asc");
    expect(parseSortDirection("bad")).toBe("asc");
    expect(parseSortDirection("desc")).toBe("desc");
  });

  it("sorts naturally in ascending and descending order", () => {
    const items = [{ name: "Video 10" }, { name: "Video 2" }, { name: "Video 1" }];

    expect(sortByNaturalName(items, "asc").map((item) => item.name)).toEqual([
      "Video 1",
      "Video 2",
      "Video 10",
    ]);

    expect(sortByNaturalName(items, "desc").map((item) => item.name)).toEqual([
      "Video 10",
      "Video 2",
      "Video 1",
    ]);
  });
});
