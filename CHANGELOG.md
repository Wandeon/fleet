# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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