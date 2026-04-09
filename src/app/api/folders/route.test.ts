import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    configuredFolder: {
      findMany: mocks.findMany,
    },
  },
}));

import { GET } from "@/app/api/folders/route";

describe("/api/folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated users", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns folder list for authenticated users", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.findMany.mockResolvedValue([
      { id: "cfg_1", folderId: "folder_1", name: "My Folder" },
      { id: "cfg_2", folderId: "folder_2", name: null },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      folders: Array<{ id: string; folderId: string; name: string | null }>;
    };

    expect(payload.folders).toEqual([
      { id: "cfg_1", folderId: "folder_1", name: "My Folder" },
      { id: "cfg_2", folderId: "folder_2", name: null },
    ]);

    expect(mocks.findMany).toHaveBeenCalledWith({
      select: { id: true, folderId: true, name: true },
      where: { archived: false },
      orderBy: { createdAt: "asc" },
    });
  });
});
