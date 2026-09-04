# 2026-08-20: Collapse the podcast mention group to its header (BUG-175)

**Scope: BUG-175.** The BUG-172 episode-group card (shipped yesterday, PR #197) folds same-episode podcast mentions into one card, but its collapsed state still previews 3 full MentionRow lines. Jay's follow-up report: "The podcast summary shows 3 posts, and still feels crowded. Cleaner to hide all titles and only show when expanded."

**Goal (one line):** collapsed, the group card shows ONLY its header (count + episode + date + episode link); the mention lines render only after the reader expands.

**Session type:** PIPELINE-SAFE (client-only, one component, no migration, no write path). Fine for the 05:00 auto slot or a quick attended session.

---

## DECISIONS (review before building)

1. **Collapsed preview count: zero.** Recommended: collapsed shows no MentionRow lines at all (Jay: "hide all titles and only show when expanded"). Alternative: keep 1 teaser line. Build on zero.
2. **Expand control: keep the existing "Show all N" button, relabeled "Show the N mentions".** It sits directly under the header. Alternative: make the whole header row a toggle target too (larger tap area); nice but not required. Build on the button only.
3. **"Expand all" / "Collapse all" placement:** with zero rows visible collapsed, the excerpt-level "Expand all" toggle is meaningless until the list is open. Recommended: render it only when the list is expanded. Alternative: leave it always visible. Build on expanded-only.
4. **Threshold:** today the Show-all button only renders when `mentions.length > PREVIEW_COUNT` (4+). With a zero-line collapsed state the button must render for EVERY group (2+ mentions), or a 2-mention group would be permanently sealed. Not really a decision, but calling it out because it inverts the current conditional.

No other open decisions.

---

## Verified facts (checked against main, 2026-08-20)

- Component: `src/components/feed/mention-episode-group.tsx` (100 lines). `PREVIEW_COUNT = 3` at line 24; `visible = showAll ? mentions : mentions.slice(0, PREVIEW_COUNT)` at line 39; Show-all button gated by `mentions.length > PREVIEW_COUNT` at line 76; "Expand all"/"Collapse all" header button at lines 53-59.
- Rendered from `src/components/feed/feed-view.tsx` (timeline) and `src/components/feed/entity-mentions.tsx` (entity mention lists), both via `groupMentionsByEpisode` in `src/lib/mentions.ts`. The change is entirely inside `mention-episode-group.tsx`; neither call site passes a preview-related prop.
- Rows are `MentionRow` with `nested` + `openSignal`; do not touch `mention-row.tsx`.
- The header line already reads "Mentioned N times on {label}", so a sealed collapsed card still communicates the content. Keep the date chip and the "Episode page" link visible collapsed (the episode link at lines 88-97 is outside the row list; leave it outside the expand gate).

## Implementation sketch

In `mention-episode-group.tsx`:
1. Replace the `visible` slice with: `const visible = showAll ? mentions : []` (or drop `PREVIEW_COUNT` entirely).
2. Render the `divide-y` row container only when `showAll`.
3. Move the "Expand all" header button inside the `showAll` branch (Decision 3).
4. Change the toggle button to render whenever `mentions.length > 0` group exists (it is only mounted for 2+ by the grouping helper), label: `Show the ${mentions.length} mentions` / `Show less`. Drop the `(${hidden} more)` suffix (no longer meaningful).
5. No em dashes in any copy.

## Acceptance criteria (BUG-175)

- On a timeline with a 3-mention episode group (Sean's timeline, FNRad episode): collapsed card shows header + date + "Show the 3 mentions" + Episode page link, and NO mention rows or titles.
- Clicking "Show the 3 mentions" reveals all rows; "Expand all" appears only in this state and still flips every excerpt.
- "Show less" reseals to header-only.
- A 2-mention group is expandable (regression check on the inverted threshold).
- Lone mentions (not grouped) are untouched.
- `npx tsc --noEmit` clean.

## Wrap

- Name BUG-175 in the PR title or commit message (the daily reconcile keys on it).
- No migration this session (state that explicitly in the ship log).
- Full Ship sequence per repo CLAUDE.md; append a `bugs/SHIP-LOG.md` entry (`status: merged` once merged).
- Report context: Jay, 2026-08-20 06:40 UTC, on `/people/sean_spud_balmer`, desktop Chrome 1271x965, replay `S-46`. No image.
