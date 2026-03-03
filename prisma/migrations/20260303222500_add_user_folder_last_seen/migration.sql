-- CreateTable
CREATE TABLE "UserFolderLastSeen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userEmail" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "lastSeenDate" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFolderLastSeen_userEmail_folderId_key" ON "UserFolderLastSeen"("userEmail", "folderId");
