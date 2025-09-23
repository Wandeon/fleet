# Fleet API (Express)

Backend service that orchestrates edge devices (audio, video, camera, zigbee) and acts as the single source of truth for state and commands.

## Quick start

```bash
cd api
npm install
npm run migrate
npm run generate
npm run seed:yaml   # import inventory/device-interfaces.yaml
npm run dev         # starts the API with background worker
```

SQLite is used by default (`DATABASE_URL=file:./data/fleet.db`). Switch to Postgres by changing `DATABASE_URL` and running migrations again.

## Key Endpoints

### Core
- `GET /api/health`
- `GET /api/devices`
- `GET /api/devices/:id`
- `GET /api/devices/:id/state`
- `GET /api/device_states`
- `GET /api/device_events?device_id=&since=`
- `GET /api/jobs/:jobId`
- `GET /api/logs`
- `GET /stream` (Server-Sent Events feed)
- `GET /metrics`

### Operations
- `POST /api/operations/:deviceId/:operationId`
  - Executes any operation declared in `inventory/device-interfaces.yaml`.
- `POST /api/video/devices/:id/tv/power_on`
- `POST /api/video/devices/:id/tv/power_off`
- `POST /api/video/devices/:id/tv/input`

Authentication and rate limiter settings remain unchanged (bearer tokens or UI session cookies).

## Architecture

- **Prisma ORM + SQLite** hold device definitions, state snapshots, append-only events, and command jobs.
- **Command queue** (`Job` table) records every intent. API endpoints enqueue work and return `{ accepted: true, job_id }` immediately.
- **Background worker** (`src/worker/processor.js`) continuously pulls pending jobs, calls the device HTTP endpoint, updates `device_state`, and appends success/error events.
- **Server-Sent Events stream** (`GET /api/stream`) pushes snapshots and incremental updates (`state.updated`, `job.updated`, `event.appended`) so frontends can stay in sync without polling.

## Environment

Copy `.env.example` and populate secrets:

```bash
DATABASE_URL="file:./data/fleet.db"
PORT=3005
NODE_ENV=production
SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
ADMIN_TOKEN=3e4f6b2f76cb888ff5730a98e2de066cdbc11cb41b7575ef6f58536a180cc3fc

APP_BASE_URL=https://app.beautyheadspabymartina.hr

AUDIO_PI_AUDIO_01_TOKEN=7d12cb8f5efe204d31923be1befaf5540a5b700ba8f026f3a3e5b8eba7d8245a
AUDIO_PI_AUDIO_02_TOKEN=06db5c8f2535e983d024e8f42eef2e81ca4a71905270847560a33f8a79faf27b
HDMI_PI_VIDEO_01_TOKEN=74b0e1dbcd87967188124aff34003e64591f00aed3676d416328b5209bc28502
CAMERA_PI_CAMERA_01_TOKEN=343355540e6d5b07ee605aedd3c635ef3e75dffa8dc55d4a0d8d18439e676683

WORKER_POLL_INTERVAL_MS=2000
```

Set `DATABASE_URL` to Postgres for production. The background worker starts automatically inside the API process; for a dedicated worker container run `npm run worker` instead.

## Deployment Notes

1. Run `npm run migrate` on boot (or via entrypoint) to apply pending migrations.
2. Seed the DB (`npm run seed:yaml`) whenever `inventory/device-interfaces.yaml` changes.
3. Expose `/api/stream` through your reverse proxy with keep-alive enabled for SSE.
4. Prometheus can continue scraping edge devices; API metrics will be expanded in follow-up work.

## Development Utilities

- `npm run dev` — API with automatic restarts and embedded worker.
- `npm run worker` — standalone worker process.
- `npm run seed:yaml` — sync database with inventory YAML.
- `npm run migrate:dev` — create & apply new migrations while developing.

