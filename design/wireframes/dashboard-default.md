# Dashboard Default State

```
┌─────────────────────────────── Fleet Console ──────────────────────────────┐
│ ┌───────────── Devices (Left Column) ─────────────┐ ┌─── System Status ───┐ │
│ │ ▸ Crane-01 (audio)   ● Online                 │ │ ▴ Uptime    99.98% │ │
│ │ ▸ Crane-02 (video)   ● Online                 │ │ ▴ Latency   34 ms │ │
│ │ ▸ Gate-14 (zigbee)   ○ Maintenance            │ │ ▴ Alerts    None  │ │
│ │ ▸ Camera-07          ● Online                 │ └────────────────────┘ │
│ │ ▸ Sensor-22          ● Online                 │ ┌──── Live Logs ──────┐ │
│ │ ▸ Add device…                                   │ │ 12:41 Device sync │ │
│ └──────────────────────────────────────────────────┘ │ 12:40 Audio ping │ │
│ ┌───────────── Device Detail (Right Column) ───────┐ │ 12:40 Health OK  │ │
│ │ Device: Crane-01                                 │ │ 12:38 Video load │ │
│ │ Audio Stream: Connected (48 kHz)                 │ │ 12:35 Alert ackd │ │
│ │ Video Stream: Standby                            │ └────────────────────┘ │
│ │ Zigbee Mesh: Stable (21 nodes)                   │                              │
│ │ Camera Feed: 1080p live preview                  │ ┌── Quick Actions ──┐ │
│ │ Health: All subsystems nominal                   │ │ • Pause audio     │ │
│ │ Logs: 4 new events                               │ │ • Restart device  │ │
│ └──────────────────────────────────────────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Notes**
- Left column is scrollable device roster grouped by type.
- Right column prioritizes the selected device summary, followed by system status, logs, and quick actions.
- Default charts and metrics update every 5 seconds.
