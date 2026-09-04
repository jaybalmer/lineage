# Bug-fix Session 4: P2 polish batch

> Status: IN PROGRESS. Claude Code is already on branch `bugfix-session4-p2-batch`.
> This brief documents the scope so the handoff has a record to archive when the PR lands.
> It is NOT a cue to start a parallel session. If Session 4 is in fact still active, leave it alone;
> the next daily triage reconciles whatever BUG ids actually ship from the merged PR.

Drafted June 12, 2026 from the existing P2 entries in `bug-triage.md` plus the codebase `CLAUDE.md`. Full reporter context, screenshots, and replay links live under each BUG id in `bug-triage.md`. Severities are P2 unless a check escalates one (see BUG-030).

## Scope

The P2 polish batch: BUG-016, 017, 018, 019, 020, 021, 024, 026, 030, 032. BUG-025 is listed separately below as a probable carve-out (feature gap, not polish).

## Standing rules

- `npx tsc --noEmit` clean before commit.
- One PR. Name the BUG ids in the PR title or commit message; the daily triage reconciles Shipped by reading them.
- Do NOT edit the Shipped section of `bug-triage.md`; the triage reconcile does that.
- No em dashes anywhere (code, comments, UI copy). Use periods, commas, parentheses, colons, or semicolons.
- `bugs/` is gitignored; do not stage it.

## Items

### BUG-021: event year labels show an uppercase "S" (1990S)
- Surface: `/snowboarding/events` decade / plural-year group labels.
- Likely cause: a `text-transform: uppercase` on a label whose string already contains "1990s". Stop uppercasing that label (or preserve the trailing s); do not change the underlying string. Check the events group header and any shared decade-label component (FeedView groups by decade).
- Acceptance: plural-year labels read "1990s" everywhere.

### BUG-016: "Riders" tab relabels to "People" when selected
- Surface: `src/components/ui/nav.tsx` Row 3.
- Likely cause: the active label is derived from the route / page title ("People", from the PB-008 `/people` move) rather than the fixed nav label ("Riders"). Make the label constant across idle and active. Keep the noun the same one used at rest.
- Acceptance: the tab shows the same label idle and active.

### BUG-032: board model years doubled in the add-board picker
- Surface: the WHICH BOARD? model list in the claim flow; suspected `add-claim-modal.tsx` (around the board-year map, ~line 168) building the per-model year list without dedup.
- Likely cause: years mapped without de-duplication, or the boards query fans out. De-dupe model years per model before render, or fix the query.
- Acceptance: each model shows its years once.

### BUG-020: hide token UI on My Timeline for soft launch
- Surface: `/[community]/profile` (My Timeline) profile header / membership block.
- Likely cause: the header renders "200 tokens" and "Revenue share active" unconditionally. Gate behind a soft-launch flag (hide for now); leave no layout gap. This is the narrow hide, NOT the BUG-012 earn model (stays deferred). See `src/store/lineage-store.ts` membership slice.
- Acceptance: token count and revenue-share UI are hidden on the profile for soft launch.

### BUG-019: "/people" header says 25 riders in the community graph but only 9 render
- Surface: `/people` list header and the community graph node set.
- Likely cause: the header counts the full people directory (25, incl. catalog/ghost/unclaimed) while the graph plots a stricter set (9). Reconcile the label to the graph's actual node count, or reword so it does not claim a count the graph lacks. Same class as the BUG-027 count note shipped in #57.
- Acceptance: the count matches what is plotted, or the copy no longer implies it.

### BUG-017: landing hero "Start Your Timeline" CTA sits below the fold on mobile
- Surface: landing hero, `src/app/page.tsx` (user-as-hero layout, Session 19).
- Likely cause: wordmark + three nav rows + headline + two paragraphs + the bordered snowboarding card stack above the CTA, pushing it below the 414px fold. Lift the primary CTA higher or tighten the stacked copy so it is visible on first paint.
- Acceptance: on a 414px viewport the CTA is visible without scrolling, or is otherwise surfaced in the first screen.

### BUG-026: place photo Save button overflows the container on mobile
- Surface: `/places/[id]` photo-upload / ABOUT edit panel.
- Likely cause: the edit panel container lacks bottom padding or a sticky action bar, so Save escapes the frame on a short (414x790) viewport. Keep the action row inside the scroll container with safe-area padding. Distinct from the shipped BUG-008 / BUG-004.
- Acceptance: Save stays within the frame on a 414px viewport.

### BUG-024: Compare rider portraits render as solid black circles
- Surface: `/compare` rider pickers and dropdown lists.
- Likely cause: the avatar on `/compare` renders its initials fallback with a foreground matching the fill (dark on dark), or skips the PB-008 ring system in `rider-avatar.tsx`. Check whether `/compare` uses `rider-avatar.tsx` or a local avatar, and a `.postcard` / dark-token mismatch. Compare against `/people`, where initials render fine.
- Acceptance: `/compare` avatars show portrait or readable initials, matching `/people`.

### BUG-030: event Edit button is visible to non-editors  (verify before sizing)
- Surface: `/events/[id]` header action row; editor gating.
- Likely cause: the event page renders Edit unconditionally while the Brands card gates it. Gate behind `is_editor` / founding, as `/admin` does.
- OPEN CHECK that sets severity: confirm whether the event PATCH route enforces `requireEditor` server-side. If the server already blocks the write, this is cosmetic (hide the button, P2). If a non-editor can actually save edits, this is a data-integrity hole; raise it to P1 and note it for the next triage.
- Acceptance: non-editors do not see an active Edit button, and the PATCH enforces editor rights server-side.

### BUG-018: visual-consistency sweep (one pass)
- Surface: `/people`, `/snowboarding/brands`, `/snowboarding/stories`; list filter rows, section headers, primary buttons.
- Four small gaps to converge: (a) rider-card-to-section-text spacing on `/people`; (b) one filter-chip treatment across sections (some plain, some outlined, some shaded); (c) uniform section-header type scale (brands header is oversized); (d) button contrast: dark text on a dark violet button on `/snowboarding/stories` (violet is the riders/people/stories tier color, `bg-violet-500/10`, `border-violet-700`); set those buttons to white text or route through `--accent`.
- Likely cause: each list page rolls its own chips / header rather than sharing a component. Consider a shared FilterChips + section-header component and spacing tokens in `src/app/globals.css`. Do this as the last item since it touches the most surfaces.
- Acceptance: one chip treatment, uniform header sizes, consistent card spacing, no dark-on-violet button text.

## Probable carve-out (raise with Jay; likely its own session)

### BUG-025: admin has no surface to manage unclaimed members  (feature gap, not polish)
- This is an admin-tooling gap, not a regression: `/admin` has no people view filtered by `node_status` (catalog / unclaimed / claimed / verified). A minimal version is a people table filtered to non-claimed statuses with edit / delete behind `requireEditorPage()`, merges reusing `merge_person` carefully (Path B history). It is bigger than the rest of this batch. Recommend NOT bundling it into the P2 polish PR; let it be its own small session so the polish batch stays shippable. If Claude Code already pulled it into Session 4, fine; otherwise leave it out.

## Suggested order (only if useful; do not override work already done)

Mechanical first (021, 016, 032, 020, 019), then mobile layout (017, 026, 024), then BUG-030 with the server-enforcement check, then the BUG-018 consistency sweep last. BUG-025 separate.
