PRAGMA foreign_keys=OFF;

CREATE TABLE "AudioTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "durationSeconds" REAL NOT NULL,
    "format" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "tagsJson" TEXT,
    "metadataJson" TEXT,
    "filePath" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AudioPlaylist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "loop" BOOLEAN NOT NULL DEFAULT false,
    "syncMode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "AudioPlaylistTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startOffsetSeconds" REAL,
    "deviceOverridesJson" TEXT,
    CONSTRAINT "AudioPlaylistTrack_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "AudioPlaylist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AudioPlaylistTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "AudioTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AudioPlaylistTrack_playlistId_order_idx" ON "AudioPlaylistTrack"("playlistId", "order");

CREATE TABLE "AudioSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT,
    "trackId" TEXT,
    "deviceIdsJson" TEXT NOT NULL,
    "assignmentsJson" TEXT,
    "syncMode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "lastError" TEXT,
    "driftJson" TEXT,
    CONSTRAINT "AudioSession_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "AudioPlaylist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AudioSession_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "AudioTrack" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AudioDeviceStatus" (
    "deviceId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "group" TEXT,
    "volumePercent" INTEGER NOT NULL,
    "capabilitiesJson" TEXT NOT NULL,
    "playbackJson" TEXT NOT NULL,
    "lastUpdated" DATETIME NOT NULL,
    "lastError" TEXT,
    "timelineJson" TEXT
);

CREATE TABLE "AudioSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

PRAGMA foreign_keys=ON;
