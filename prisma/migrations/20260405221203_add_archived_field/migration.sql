-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ConfiguredFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folderId" TEXT NOT NULL,
    "name" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ConfiguredFolder" ("createdAt", "folderId", "id", "name", "sourceUrl", "updatedAt") SELECT "createdAt", "folderId", "id", "name", "sourceUrl", "updatedAt" FROM "ConfiguredFolder";
DROP TABLE "ConfiguredFolder";
ALTER TABLE "new_ConfiguredFolder" RENAME TO "ConfiguredFolder";
CREATE UNIQUE INDEX "ConfiguredFolder_folderId_key" ON "ConfiguredFolder"("folderId");
CREATE TABLE "new_WatchProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userEmail" TEXT NOT NULL,
    "folderVideoId" TEXT,
    "currentTime" REAL NOT NULL DEFAULT 0,
    "duration" REAL NOT NULL DEFAULT 0,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchProgress_folderVideoId_fkey" FOREIGN KEY ("folderVideoId") REFERENCES "FolderVideo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WatchProgress" ("currentTime", "duration", "folderVideoId", "id", "updatedAt", "userEmail", "watched") SELECT "currentTime", "duration", "folderVideoId", "id", "updatedAt", "userEmail", "watched" FROM "WatchProgress";
DROP TABLE "WatchProgress";
ALTER TABLE "new_WatchProgress" RENAME TO "WatchProgress";
CREATE UNIQUE INDEX "WatchProgress_userEmail_folderVideoId_key" ON "WatchProgress"("userEmail", "folderVideoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
