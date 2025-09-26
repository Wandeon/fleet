# Fleet Design System Tokens

## Color Palette

| Token                      | Hex                      | Usage                                      |
| -------------------------- | ------------------------ | ------------------------------------------ |
| `color.background.canvas`  | `#0F111A`                | App background (dark slate for ops rooms). |
| `color.background.surface` | `#1A1D2A`                | Cards, panels.                             |
| `color.background.sunken`  | `#10121B`                | Device list backdrop, modals.              |
| `color.text.primary`       | `#F5F7FF`                | Primary text.                              |
| `color.text.muted`         | `#C3C8E5`                | Secondary text, labels.                    |
| `color.text.inverse`       | `#0F111A`                | Text on light pills/buttons.               |
| `color.accent.primary`     | `#4C8CFF`                | Primary actions, highlights.               |
| `color.accent.secondary`   | `#7D5CFF`                | Secondary actions, tab focus.              |
| `color.status.success`     | `#3CC885`                | Online status, positive alerts.            |
| `color.status.warning`     | `#F2C94C`                | Degraded status, caution banners.          |
| `color.status.danger`      | `#FF5E5E`                | Offline status, critical alerts.           |
| `color.status.info`        | `#4FD6FF`                | Informational banners, neutral states.     |
| `color.border.default`     | `#2D3142`                | Dividers, outlines.                        |
| `color.border.focus`       | `#4C8CFF`                | Focus ring, input focus.                   |
| `color.overlay.scrim`      | `rgba(15, 17, 26, 0.72)` | Modal overlay.                             |

## Typography

| Token                  | Font                | Size | Line Height                    | Usage            |
| ---------------------- | ------------------- | ---- | ------------------------------ | ---------------- |
| `font.family.base`     | "Inter", sans-serif | —    | —                              | Default UI font. |
| `font.size.xs`         | 12px                | 16px | Labels, helper text.           |
| `font.size.sm`         | 14px                | 20px | Body copy, logs.               |
| `font.size.md`         | 16px                | 24px | Primary body, form fields.     |
| `font.size.lg`         | 20px                | 28px | Section headers, device names. |
| `font.size.xl`         | 28px                | 36px | Dashboard hero metrics.        |
| `font.weight.regular`  | 400                 | —    | General text.                  |
| `font.weight.medium`   | 500                 | —    | Buttons, labels.               |
| `font.weight.semibold` | 600                 | —    | Headings, status pills.        |

## Spacing Scale

| Token       | Value |
| ----------- | ----- |
| `space.2xs` | 4px   |
| `space.xs`  | 8px   |
| `space.sm`  | 12px  |
| `space.md`  | 16px  |
| `space.lg`  | 24px  |
| `space.xl`  | 32px  |
| `space.2xl` | 48px  |

## Radius & Elevation

| Token       | Value                          | Usage                |
| ----------- | ------------------------------ | -------------------- |
| `radius.sm` | 4px                            | Input fields, pills. |
| `radius.md` | 8px                            | Cards, tiles.        |
| `radius.lg` | 12px                           | Modals, drawers.     |
| `shadow.sm` | `0 2px 4px rgba(0,0,0,0.25)`   | Hover elevation.     |
| `shadow.md` | `0 8px 16px rgba(0,0,0,0.35)`  | Cards, panels.       |
| `shadow.lg` | `0 16px 40px rgba(0,0,0,0.45)` | Overlays, dialogs.   |

## Component Specifications

### Button

- **Variants:** Primary, Secondary, Tertiary, Destructive.
- **Primary:** background `color.accent.primary`, text `color.text.inverse`, padding `space.sm` x `space.lg`, radius `radius.md`, shadow `shadow.sm` on hover.
- **Secondary:** transparent background, border `1px color.border.default`, text `color.text.primary`.
- **States:** Hover (lighten background 8%), Active (translateY(1px)), Focus (2px outline `color.border.focus`), Disabled (opacity 0.4, pointer-events none).

### Card

- Background `color.background.surface`, radius `radius.md`, padding `space.lg`, shadow `shadow.md`.
- Supports header row (title, action button) and body area with vertical spacing `space.md`.
- Variants: Metric (large numerals), Media (video/audio preview), Log summary.

### Slider

- Track height 4px, radius `radius.sm`, background `color.border.default`.
- Active track `color.accent.primary`.
- Thumb radius 10px, size 16px, focus ring `color.border.focus`.
- Tooltip showing value with `font.size.xs` on hover/drag.

### Status Pill

- Shape: capsule with radius `radius.lg`, padding `space.2xs` x `space.sm`.
- Color-coded background from status tokens; text `color.text.inverse` for success/danger/warning, `color.text.primary` for neutral.
- Includes optional dot indicator (6px) preceding text.

### Device Tile

- Layout: horizontal flex, padding `space.md`, background `color.background.sunken`, radius `radius.md`.
- Left: status pill + icon (24px), center: device name (`font.size.md`), metadata row (`font.size.xs`).
- Right: alert count badge, chevron indicator.
- States: Selected (border `2px color.accent.primary`), Hover (shadow `shadow.sm`), Disabled (opacity 0.5).

### Log Row

- Typography `font.size.sm`, monospace variant optional for payload preview.
- Structure: timestamp column (80px fixed), severity badge (status colors), message column flexible, metadata icons trailing (copy, expand).
- Hover state reveals inline actions (copy payload, open in viewer).
- Loading skeleton uses gradient shimmer bars matching column widths.
