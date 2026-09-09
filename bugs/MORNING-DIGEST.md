# Linestry morning digest, September 9, 2026

**Overnight: nothing merged (main still `f0cc660`); the 5:00 auto-fix aborted again on the dirty tree (10th abort in 11 mornings); triage completed and logged 2 new bugs incl. a P1 from a real user (BUG-190).**

## Auto-fix run

The 5:00 run fired and aborted: "working tree has uncommitted changes to tracked files, leaving your work alone." That is the same structural failure as the last nine mornings. The checked-out branch is `feat/funnel-drop-off-repairs-tier2` (a feature session in progress, commit `8c37a9a` not on main), so the tree is dirty and the pipeline refuses to build over it. RUN-LOG row for today is already written. No draft PR is waiting on you. Net effect: the pipeline-safe bug backlog (BUG-190, BUG-191, BUG-181/182, BUG-120) is NOT getting shipped autonomously, and will not until the tree issue is fixed.

## Triage run

Completed (bug-triage.md dated today). Two genuinely new bugs logged from live use: **BUG-190** (P1) rapid taps on a board's "Add to timeline" created 10 duplicate owned_board claims for a real early user on mobile; and **BUG-191** (P2) a single vertical story photo cropped in the feed card. Three of the five bug-lane reports this window were already processed September 8; idea lane returned two, both already filed. Next free id is BUG-192. One open P1 (BUG-190), zero open P0.

## Feature side

No feature PR merged overnight (main unchanged since the September 8 evening reconcile). A feature session is mid-flight on `feat/funnel-drop-off-repairs-tier2` (funnel drop-off repairs PR 2), not yet pushed to main. Current feature lead per NEXT-FEATURE is **Presenting partner surfacing** (featured brand group + landing card, ~2 to 3 hr, no migration, driven off `orgs.curation_tier = 'founding'`), timed against episode 1 and the FNRad Season 12 deal. Ahead of it sits a short ops item: **Ops tree hygiene** (~30 to 45 min), which is what fixes the dirty-tree abort the pipeline keeps hitting. No unmatched feature ships and no Drive brief moves this run (nothing shipped).

## Feature/bug balance

Last 7 days: 10 bug PRs shipped vs ~15 feature/fix PRs shipped (catalog imports and the episode-1 run dominate the feature side). Most recent bug ship: BUG-185 via #245 (Sep 8). Most recent feature ship: #246 (Sep 8). Queued: 4 build-ready bug briefs (BUG-190 lead, then BUG-191, BUG-181/182, BUG-120), 2 build-ready feature briefs (Ops tree hygiene DO-FIRST, then Presenting partner surfacing LEAD) plus the deeper funnel and PB-010 backlog. The split is healthy and if anything feature-heavy, so no rebalancing nudge. One caveat, not a balance problem: an open P1 (BUG-190) is sitting while a feature session is checked out, and the pipeline that would normally clear it is stuck, so the P1 should take priority over resuming feature work today.

## Suggested today

1. **START HERE. BUG-190 (P1), attended. Brief: `bugs/2026-09-09-board-add-duplicate-claims.md`.** The only open P1, and it hit a real early user (10 duplicate Winterstick claims from rapid mobile taps). It is tagged pipeline-safe, but the 5:00 pipeline has aborted 10 of the last 11 mornings (again today), so it will not ship on its own. The code fix is one file (an in-flight guard plus an already-has-claim short-circuit in `board-parts.tsx`), no migration. The dedupe of the existing duplicate rows and the optional unique index are a GATED follow-up (delete existing rows), so they are your call, not part of the auto-merge PR. Small.
2. **Ops tree hygiene. Brief: `features/ops-tree-hygiene-brief.md`. ~30 to 45 min, one PR, no migration, SAFE.** This is the enabler: it stops the wrapper counting dirt under `bugs/` and `features/` and finishes the half-done PR #214 tracker commit, which is what unblocks the 05:00 pipeline so the three remaining pipeline-safe bugs start clearing themselves overnight. High leverage for its size.
3. **Presenting partner surfacing (feature LEAD). Brief: `features/presenting-partner-surfacing-brief.md`. ~2 to 3 hr, no migration, SAFE.** First directly commercial ask from the idea lane; featured brand group on the brands index plus a presenting-partner card on the landing page, generic on `curation_tier`. Timed against episode 1 (1 to 2 weeks out) and the FNRad S12 deal. Worth pulling once the P1 is clear.

## Needs you today

- **GATED dedupe for BUG-190:** the cleanup of the existing duplicate Winterstick rows (and optional DB unique index) deletes existing rows, so it waits for your go-ahead. Approve it alongside the BUG-190 fix or hold it.
- **BUG-189 decision:** every catalog entity appears twice in the signed-in pickers and the 2.6 MB catalog is fetched twice per load (same store slice as the BUG-188 P0). It is a nine-read-site design call on what `userEntities` should mean, and needs your decision before a brief can be drafted. Strongest candidate for the next bug-drafting pass.
- **PR #214 is still half-done:** the tracker migration that puts all 60 bug/feature briefs into git is seven-plus days incomplete, which is part of why the pipeline keeps stranding. Folded into the Ops tree hygiene brief above.
- No draft PR is awaiting review.

## Today's leads

- **Bug lead (NEXT-SESSION):** BUG-190, P1, `bugs/2026-09-09-board-add-duplicate-claims.md`. Pipeline-safe code fix + GATED dedupe follow-up.
- **Feature lead (NEXT-FEATURE):** Presenting partner surfacing, `features/presenting-partner-surfacing-brief.md`, with Ops tree hygiene (`features/ops-tree-hygiene-brief.md`) staged as the DO-FIRST short item.
