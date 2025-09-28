# D1 Release Readiness Checklist

_Automation objective: provide a single-page go/no-go view before shipping._

## Overall Recommendation
- **NO-GO** – Build and CI breakages still block deployable artifacts despite stable infrastructure.

## Must-Have Items
| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Build artifacts compile successfully | **NO-GO** | [BUILD-ERROR-REPORT.md](../../BUILD-ERROR-REPORT.md) | TypeScript compilation failures prevent API image creation, so no shippable build exists yet.【F:BUILD-ERROR-REPORT.md†L1-L132】 |
| Main branch CI pipelines green | **NO-GO** | [ops/ci-recovery/20250926-1132/analysis.md](../ci-recovery/20250926-1132/analysis.md)<br>[current-status.txt](../ci-recovery/20250926-1132/current-status.txt) | Latest main runs show 100% failure across workflows due to configuration/type issues, so regressions would land unnoticed.【F:ops/ci-recovery/20250926-1132/analysis.md†L1-L55】【F:ops/ci-recovery/20250926-1132/current-status.txt†L1-L5】 |
| Merge-blocking regressions resolved | **NO-GO** | [ops/ci-health/20250926-1056/POST-MERGE-STATUS.md](../ci-health/20250926-1056/POST-MERGE-STATUS.md) | PR #85 introduced breaking API/type changes with ongoing hotfix work; reverting or forward-fixing is still pending before shipping.【F:ops/ci-health/20250926-1056/POST-MERGE-STATUS.md†L1-L77】 |
| Production deployment plan executable today | **NO-GO** | [DEPLOYMENT-STATUS-SUMMARY.md](../../DEPLOYMENT-STATUS-SUMMARY.md)<br>[EVIDENCE-PACKAGE.md](../../EVIDENCE-PACKAGE.md) | Deployment remains blocked until two repo fixes land; plan exists but cannot proceed without code updates.【F:DEPLOYMENT-STATUS-SUMMARY.md†L3-L72】【F:EVIDENCE-PACKAGE.md†L1-L118】 |
| Critical device coverage for launch | **NO-GO** | [EVIDENCE-PACKAGE.md](../../EVIDENCE-PACKAGE.md)<br>[docs/ops/OBSERVABILITY-STATUS.md](../../docs/ops/OBSERVABILITY-STATUS.md) | Only 1 of 4 Pi devices is operational; the rest need recovery before promising multi-device audio experiences.【F:EVIDENCE-PACKAGE.md†L60-L76】【F:docs/ops/OBSERVABILITY-STATUS.md†L16-L88】 |
| High-severity UI/API defects cleared | **NO-GO** | [MISSION_COMPLETE.md](../../MISSION_COMPLETE.md) | `/health` returns 500 and `/fleet/1` + `/settings` still 404, leaving critical operator flows broken for release day.【F:MISSION_COMPLETE.md†L83-L135】 |

## Nice-to-Have Items
| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Observability dashboards/alerting tuned for launch | **GO** | [docs/ops/OBSERVABILITY-STATUS.md](../../docs/ops/OBSERVABILITY-STATUS.md)<br>[EVIDENCE-PACKAGE.md](../../EVIDENCE-PACKAGE.md) | Monitoring stack, alert rules, and credentials are live; only dashboard polish remains optional for launch.【F:docs/ops/OBSERVABILITY-STATUS.md†L7-L140】【F:EVIDENCE-PACKAGE.md†L16-L158】 |
| Security & environment configuration validated | **GO** | [EVIDENCE-PACKAGE.md](../../EVIDENCE-PACKAGE.md) | Bearer tokens, API auth, and env variables confirmed present; no blockers identified here.【F:EVIDENCE-PACKAGE.md†L120-L135】 |
| Release documentation matches current state | **NO-GO** | [CHANGELOG.md](../../CHANGELOG.md)<br>[DEPLOYMENT-STATUS-SUMMARY.md](../../DEPLOYMENT-STATUS-SUMMARY.md) | Changelog advertises Phase C features already shipped, conflicting with deployment blockers; needs correction before announcement.【F:CHANGELOG.md†L9-L55】【F:DEPLOYMENT-STATUS-SUMMARY.md†L3-L44】 |
| Operational validation artifacts archived | **GO** | [MISSION_COMPLETE.md](../../MISSION_COMPLETE.md) | Prior mission logged evidence bundle (screens, logs) that remains accessible for future regression comparisons.【F:MISSION_COMPLETE.md†L66-L118】 |

## Immediate Blockers to Resolve Before Go
1. Land the two TypeScript fixes and restore green CI, then rebuild API/UI images.【F:BUILD-ERROR-REPORT.md†L1-L166】【F:ops/ci-recovery/20250926-1132/analysis.md†L1-L55】
2. Recover offline Pi devices (audio-02, video-01, camera-01) to guarantee fleet-wide coverage.【F:EVIDENCE-PACKAGE.md†L60-L76】【F:docs/ops/OBSERVABILITY-STATUS.md†L16-L88】
3. Ship hotfix for `/health`, `/fleet/1`, and `/settings` routes prior to public launch messaging.【F:MISSION_COMPLETE.md†L83-L135】
4. Update release communications once blockers clear to avoid overselling readiness.【F:CHANGELOG.md†L9-L55】【F:DEPLOYMENT-STATUS-SUMMARY.md†L3-L44】
