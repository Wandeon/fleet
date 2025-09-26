# Dashboard Error State

```
┌─────────────────────────────── Fleet Console ──────────────────────────────┐
│ ┌───────────── Devices (Left Column) ─────────────┐ ┌─── System Status ───┐ │
│ │ ⚠ Failed to load devices                       │ │ ⚠ Service alerts  │ │
│ │ Retry • Contact support                        │ │ Retry connection  │ │
│ └──────────────────────────────────────────────────┘ └────────────────────┘ │
│ ┌───────────── Device Detail (Right Column) ───────┐ ┌──── Live Logs ──────┐ │
│ │ Device context unavailable                      │ │ No logs available  │ │
│ │ Show diagnostic ID: 8F2A-44                     │ │ Inspect stacktrace │ │
│ │ Buttons: Retry • Download diagnostics           │ │ Buttons: Retry    │ │
│ └──────────────────────────────────────────────────┘ └────────────────────┘ │
│ ┌──────────────────── Inline Alert ─────────────────────────────────────────┐ │
│ │ "Connection to telemetry broker lost. Reconnecting in 14 seconds…"       │ │
│ │ Provide: Retry now • View status page                                     │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Notes**

- Error blocks use high-contrast banner with iconography and provide immediate recovery actions.
- Device retry is prioritized; health panel links to status page for transparency.
- Logs area explains absence of data and keeps troubleshooting links visible.
