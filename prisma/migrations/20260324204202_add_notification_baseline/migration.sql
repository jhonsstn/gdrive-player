-- CreateTable
CREATE TABLE "UserNotificationBaseline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userEmail" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "baselineDate" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationBaseline_userEmail_folderId_key" ON "UserNotificationBaseline"("userEmail", "folderId");
