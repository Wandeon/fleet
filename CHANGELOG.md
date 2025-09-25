# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.3.0-phaseC] - 2025-09-25

### Added - Phase C: API Integration & Device Control
- **Health Overview**: Fixed `/health` 500 errors with reliable health metrics endpoint
- **Settings Management**: Complete `/settings` route with configuration panels and environment detection
- **Fleet Device Details**: Implemented `/fleet/:id` detail pages with device status and action controls
- **Live Device Connectivity**: Brought Pi devices online via Tailscale networking with host connectivity
- **Audio Upload Workflow**: Added modal-based audio file upload with progress tracking and validation
- **Video Display Controls**: Enabled functional HDMI/CEC power, input switching, and volume controls
- **Advanced Log Management**: Implemented comprehensive logs filtering by search, severity, and time range with export
- **Zigbee Device Pairing**: Complete pairing workflow with device discovery, confirmation, and real-time updates

### Fixed
- Docker network DNS resolution issues by migrating from host networking to dedicated bridge network
- 502 errors on all API endpoints by enabling proper container-to-container communication
- Container networking while maintaining external Tailscale device access

### Technical
- **API Endpoints**: 15+ new endpoints for device control (audio, video, zigbee pairing, logs filtering)
- **UI Components**: Enhanced modules with interactive controls, modals, and real-time status updates
- **Device Integration**: Created device shims for audio, video, and zigbee coordinators
- **Network Architecture**: Custom Docker bridge network for service discovery with external connectivity
- **Error Handling**: Comprehensive error states and graceful degradation patterns

### Infrastructure
- Deployed via Docker Compose with production-ready container orchestration
- Integrated with Caddy reverse proxy and TLS termination
- Environment configuration for production parity with proper token management
- UX artifacts captured under `/opt/fleet/ux-audit/` with CI timestamps

---

## [v0.7.0] - 2025-09-24

### Added

- SSR error boundaries and server-side API proxying for enhanced UI robustness
- Comprehensive error handling with `UiApiError` class (renamed from `CustomApiError`)
- Prisma JSON to TEXT column migration support (create-only migration included)
- Enhanced CI pipeline with proper Playwright browser installation (Chromium only)
- Prisma generate and validate steps in CI for better schema validation
- Environment variable configuration for database and engine validation

### Changed

- Improved SSR safeguards to prevent internal server errors on client-side navigation
- Strengthened CI workflow with targeted Playwright installation and Prisma validation
- Enhanced test environment alignment with production-like settings
- Updated API client error handling for better type safety

### Technical

- **Migration Note**: New Prisma migration `20250924102944_text_columns` created for JSON→TEXT column conversion. Review and apply manually in production environments.
- CI now uses Node 20.x with optimized dependency caching and proper environment variables
- Test coverage improved with SSR smoke tests and Prisma serialization validation

### Developer Experience

- Fixed CI instability issues with proper browser dependencies and database configuration
- Streamlined development workflow with consistent local and CI test environments
- Enhanced error reporting and debugging capabilities across UI and API layers