# Dashboard Loading State

```
┌─────────────────────────────── Fleet Console ──────────────────────────────┐
│ ┌───────────── Devices (Left Column) ─────────────┐ ┌─── System Status ───┐ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │ ░░░░░░░░░░░░░░░░░ │ │
│ │ ░ Loading device roster…                       │ │ Loading metrics…  │ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ └────────────────────┘ │
│ └──────────────────────────────────────────────────┘ ┌──── Live Logs ──────┐ │
│ ┌───────────── Device Detail (Right Column) ───────┐ │ ░ Fetching logs…  │ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │ ░░░░░░░░░░░░░░░░░ │ │
│ │ ░ Initializing stream connections…              │ └────────────────────┘ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ┌── Quick Actions ──┐ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │ ░ Preparing…     │ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ └────────────────────┘ │
│ └──────────────────────────────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Notes**
- Skeleton placeholders indicate asynchronous loading for each content block.
- Progress dots animate horizontally to show activity.
- Quick actions remain disabled until device data is returned.
