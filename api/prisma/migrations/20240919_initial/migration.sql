-- Create Device table
CREATE TABLE IF NOT EXISTS "Device" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "role" TEXT,
  "name" TEXT NOT NULL,
  "alias" TEXT,
  "online" INTEGER NOT NULL DEFAULT 0,
  "last_seen" DATETIME,
  "address" TEXT NOT NULL DEFAULT '{}',
  "capabilities" TEXT NOT NULL DEFAULT '[]',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create DeviceState table
CREATE TABLE IF NOT EXISTS "DeviceState" (
  "device_id" TEXT PRIMARY KEY,
  "state" TEXT NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'unknown',
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen" DATETIME,
  "offline_reason" TEXT,
  CONSTRAINT "DeviceState_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create DeviceEvent table
CREATE TABLE IF NOT EXISTS "DeviceEvent" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "device_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" TEXT NOT NULL DEFAULT '{}',
  "origin" TEXT,
  "job_id" TEXT,
  "correlation_id" TEXT,
  "at_month" DATETIME NOT NULL DEFAULT (strftime('%Y-%m-01T00:00:00Z', 'now')),
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceEvent_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeviceEvent_device_idx" ON "DeviceEvent"("device_id", "created_at");
CREATE INDEX IF NOT EXISTS "DeviceEvent_type_idx" ON "DeviceEvent"("device_id", "event_type", "created_at");
CREATE INDEX IF NOT EXISTS "DeviceEvent_month_idx" ON "DeviceEvent"("at_month");

-- Create Job table
CREATE TABLE IF NOT EXISTS "Job" (
  "id" TEXT PRIMARY KEY,
  "device_id" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "payload" TEXT NOT NULL DEFAULT '{}',
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "result" TEXT,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "dedupe_key" TEXT,
  "correlation_id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  "next_run_at" DATETIME,
  "last_attempt_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" DATETIME,
  CONSTRAINT "Job_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Job_status_nextRun_idx" ON "Job"("status", "next_run_at");
CREATE UNIQUE INDEX IF NOT EXISTS "Job_dedupe_key_unique" ON "Job"("dedupe_key") WHERE "dedupe_key" IS NOT NULL;
