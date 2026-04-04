-- CreateTable
CREATE TABLE "FolderVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folderId" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" TEXT,
    "modifiedTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FolderVideo_folderId_driveFileId_key" ON "FolderVideo"("folderId", "driveFileId");

-- CreateIndex
CREATE INDEX "FolderVideo_folderId_idx" ON "FolderVideo"("folderId");

-- Drop old WatchProgress (data loss accepted — personal app)
DROP TABLE "WatchProgress";

-- CreateTable (new schema)
CREATE TABLE "WatchProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userEmail" TEXT NOT NULL,
    "folderVideoId" TEXT NOT NULL,
    "currentTime" REAL NOT NULL DEFAULT 0,
    "duration" REAL NOT NULL DEFAULT 0,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchProgress_folderVideoId_fkey" FOREIGN KEY ("folderVideoId") REFERENCES "FolderVideo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_userEmail_folderVideoId_key" ON "WatchProgress"("userEmail", "folderVideoId");
