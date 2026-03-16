# Lineage.wtf — Collective Timeline Page
## Claude Code Brief

---

## Context

Lineage.wtf is a time-based social graph that connects people through events, artifacts, stories, and places from their personal timelines. The app builds collective histories of specific communities — the initial community is snowboarding.

There are four entry types across the whole app. Each has its own color and symbol that must be used consistently:

| Type | Symbol | Color |
|------|--------|-------|
| Event | ◈ | `#00d4ff` |
| Artifact | ◉ | `#ff9f43` |
| Story | ◎ | `#a29bfe` |
| Place | ◇ | `#55efc4` |

The visual design system is established and must be followed:
- **Background:** `#05080f`
- **Card:** `#0a1220`
- **Spine/axis:** `#142436`
- **Muted text:** `#2a4a5a`
- **Primary text:** `#d8eaf4`
- **Accent (shared moments):** `#00d4ff`
- **Fonts:** `Barlow Condensed` (display/headings) + `IBM Plex Mono` (labels, data, UI)
- **Node language:** circles = personal entries; ◆ rotated squares = shared/collective moments

---

## Page to Build

**Route:** `/collective` (or equivalent in the project's routing setup)

**Purpose:** Let a user explore the snowboarding community's collective timeline — all entries contributed by all users — understand the shape of the scene's history, and pull moments from it onto their own personal timeline.

---

## Layout — Mobile First

The page has three stacked zones:

```
┌─────────────────────────┐
│  HEADER                 │  Fixed. Title, 1Y/10Y toggle, type filter
├─────────────────────────┤
│                         │
│  CHART                  │  Horizontally scrollable SVG.
│  (line chart)           │  Four smooth line traces, one per type.
│                         │  Spine axis below with nodes.
│                         │
├─────────────────────────┤
│  INFO PANEL             │  Updates on tap/scrub. Entry breakdown,
│  (scrollable)           │  title, CTA to add to personal timeline.
└─────────────────────────┘
```

---

## Chart Specification

**Line chart — not a bar chart.**

- Draw four smooth `catmull-rom` spline lines through the data, one per type
- Each line has a subtle area fill beneath it using the type color at low opacity (~15%)
- Lines use their type color at 80% opacity when idle; glow at full opacity when active
- All four lines share the same Y axis (count of entries) and X axis (time)
- Y axis: no labels needed, just subtle horizontal grid lines at 25/50/75/100% intervals using `stroke-opacity: 0.03`

**Spine axis — sits below the chart area:**
- A horizontal line running the full chart width
- A node at every data point:
  - Circle `r=2.5` for standard years
  - Rotated square (◆) for years where the current user has a personal entry — these glow cyan (`#00d4ff`)
- Year labels below nodes — show every 4th year in 1Y mode, every decade label in 10Y mode; always show the active/scrubbed year

**Scrubber interaction:**
- On tap or drag, snap to nearest data point
- Show a vertical crosshair line from top of chart to the spine
- Active nodes on each of the four lines: outer ring + filled center dot in their type color, with glow filter
- Idle lines dim to 40% opacity; active lines return to 100% with glow
- The info panel below updates to show the scrubbed year's data

**1Y / 10Y toggle:**
- 1Y: one data point per year, ~22px horizontal spacing
- 10Y: one data point per decade, ~62px horizontal spacing
- Switching resets the scrubber

---

## Info Panel

Shown below the chart. Empty state: `"scrub or tap any node to explore"` in muted mono.

When a node is active, show:
- Year or decade label (mono, cyan, small caps)
- Event title/description for that period
- Whether this year overlaps with the user's personal timeline (show `◆ yours` badge)
- For each of the 4 types: symbol, label, count, percentage bar, percentage number
- Total entries count
- `+ ADD TO YOUR TIMELINE` button (outlined, cyan, full width)

---

## Filter Controls

In the header, a row of four toggleable pills — one per type:
- `◈ Events` `◉ Artifacts` `◎ Stories` `◇ Places`
- When a type is toggled off, its line and nodes disappear from the chart (animate opacity to 0)
- Inactive pill: dimmed, outlined
- Active pill: filled with type color at 20% background, type-colored border and text

---

## Data

Connect to the real database. The query needed:

```
For each year (or decade):
  COUNT of entries grouped by type
  WHERE community = 'snowboarding'
```

While connecting, use this static fallback shape so the chart renders immediately:

```js
// Each entry: { year, event, artifact, story, place, label }
// label = a short editorial title for that year/decade
// Values are entry counts per type
```

Mark years where the current user has at least one personal entry — these get the ◆ diamond node treatment on the spine.

---

## Interactions Summary

| Action | Result |
|--------|--------|
| Tap node on spine | Snap scrubber, update info panel |
| Drag across chart | Live scrub through years |
| Tap type pill filter | Toggle that line on/off |
| Toggle 1Y / 10Y | Re-render chart at new resolution, reset scrubber |
| Tap `+ ADD TO YOUR TIMELINE` | Add the active year's collective entry to user's personal timeline |
| Scroll chart horizontally | Explore time periods outside viewport |

---

## Animation

- Lines draw in on first load (stroke-dashoffset animation, 800ms, staggered by 100ms per type)
- Info panel content fades up (opacity + translateY, 200ms) on each new active node
- Type filter toggle: line fades over 300ms
- Scrubber crosshair appears instantly (no transition)
- Node glow: `drop-shadow` filter, no keyframe animation needed

---

## What Not To Do

- No bar charts anywhere on this page
- No tooltips that appear on hover — all info lives in the panel below
- No Y-axis numerical labels — the shape of the lines is the story, not the exact numbers
- No horizontal scrollbar visible (hide with `scrollbar-width: none`)
- Do not use Inter, Roboto, or system-ui for anything visible — only Barlow Condensed and IBM Plex Mono

---

## Reference

The interaction pattern and visual design were prototyped. The working prototype code is in `lineage-collective-lines.jsx` — use it as a reference for the chart math (catmull-rom path builder, area path builder, scrubber logic) but rebuild it properly integrated with the project's data layer, routing, and component structure.
