-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PlaylistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "PlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
