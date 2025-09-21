/*
  Warnings:

  - You are about to drop the column `alias` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `last_seen` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `online` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `Device` table. All the data in the column will be lost.
  - The primary key for the `DeviceEvent` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `at_month` on the `DeviceEvent` table. All the data in the column will be lost.
  - You are about to drop the column `correlation_id` on the `DeviceEvent` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `DeviceEvent` table. All the data in the column will be lost.
  - You are about to drop the column `device_id` on the `DeviceEvent` table. All the data in the column will be lost.
  - You are about to drop the column `event_type` on the `DeviceEvent` table. All the data in the column will be lost.
  - You are about to drop the column `job_id` on the `DeviceEvent` table. All the data in the column will be lost.
  - The primary key for the `DeviceState` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `device_id` on the `DeviceState` table. All the data in the column will be lost.
  - You are about to drop the column `last_seen` on the `DeviceState` table. All the data in the column will be lost.
  - You are about to drop the column `offline_reason` on the `DeviceState` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `DeviceState` table. All the data in the column will be lost.
  - You are about to drop the column `attempts` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `completed_at` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `correlation_id` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `dedupe_key` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `device_id` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `last_attempt_at` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `next_run_at` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `result` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `Job` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Device` table without a default value. This is not possible if the table is not empty.
  - Made the column `id` on table `Device` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `deviceId` to the `DeviceEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventType` to the `DeviceEvent` table without a default value. This is not possible if the table is not empty.
  - Made the column `origin` on table `DeviceEvent` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `deviceId` to the `DeviceState` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `DeviceState` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updatedAt` to the `DeviceState` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deviceId` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Made the column `id` on table `Job` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "groupId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,

    PRIMARY KEY ("groupId", "deviceId"),
    CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GroupMembership_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CommandLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "groupId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL,
    "managed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Device" ("address", "capabilities", "id", "kind", "name") SELECT "address", "capabilities", "id", "kind", "name" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";
CREATE TABLE "new_DeviceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origin" TEXT NOT NULL,
    "correlationId" TEXT,
    CONSTRAINT "DeviceEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DeviceEvent" ("id", "origin", "payload") SELECT "id", "origin", "payload" FROM "DeviceEvent";
DROP TABLE "DeviceEvent";
ALTER TABLE "new_DeviceEvent" RENAME TO "DeviceEvent";
CREATE INDEX "DeviceEvent_deviceId_at_idx" ON "DeviceEvent"("deviceId", "at");
CREATE INDEX "DeviceEvent_correlationId_idx" ON "DeviceEvent"("correlationId");
CREATE TABLE "new_DeviceState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "lastSeen" DATETIME,
    "state" TEXT NOT NULL,
    CONSTRAINT "DeviceState_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DeviceState" ("state", "status") SELECT "state", "status" FROM "DeviceState";
DROP TABLE "DeviceState";
ALTER TABLE "new_DeviceState" RENAME TO "DeviceState";
CREATE INDEX "DeviceState_deviceId_updatedAt_idx" ON "DeviceState"("deviceId", "updatedAt");
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("command", "error", "id", "payload", "status") SELECT "command", "error", "id", "payload", "status" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");
CREATE INDEX "Job_deviceId_createdAt_idx" ON "Job"("deviceId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
