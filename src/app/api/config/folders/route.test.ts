import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isAdminSession: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  getFolderName: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/authz", () => ({
  isAdminSession: mocks.isAdminSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    configuredFolder: {
      findMany: mocks.findMany,
      create: mocks.create,
      delete: mocks.delete,
    },
  },
}));

vi.mock("@/lib/drive", () => ({
  getFolderName: mocks.getFolderName,
}));

import { GET, POST } from "@/app/api/config/folders/route";

describe("/api/config/folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-admin users", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.isAdminSession.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("creates a folder with name for admin users", async () => {
    mocks.auth.mockResolvedValue({
      user: { email: "admin@example.com" },
      accessToken: "test-token",
    });
    mocks.isAdminSession.mockReturnValue(true);
    mocks.getFolderName.mockResolvedValue("My Videos Folder");
    mocks.create.mockResolvedValue({
      id: "cfg_1",
      folderId: "1AbCdEfGhIjKlMnOpQr",
      name: "My Videos Folder",
      sourceUrl: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQr",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await POST(
      new Request("http://localhost/api/config/folders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQr",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.getFolderName).toHaveBeenCalledWith("test-token", "1AbCdEfGhIjKlMnOpQr");
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        sourceUrl: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQr",
        folderId: "1AbCdEfGhIjKlMnOpQr",
        name: "My Videos Folder",
      },
    });
  });
});
