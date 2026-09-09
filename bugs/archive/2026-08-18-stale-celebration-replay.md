# Bug-fix brief: old stories replay their celebration toast on the owner's own profile

**Date drafted:** August 18, 2026 (daily triage, evening intake)
**Scope:** BUG-167
**Severity:** P2
**Run mode:** diagnosis-first, then client-only. PIPELINE-SAFE on the defaults below (no migration, no write path).
**Estimated:** 1 to 1.5 hr.

---

## Goal

A celebration toast should fire when a member adds something, and never for an entry they added months ago. Jay got two toasts for old stories just by opening his own profile.

---

## DECISIONS (review before building)

**D1. Add a recency gate, do not just patch the seen-set.** Recommended default: a celebration fires only when the newly-unseen entry is actually new, defined as `created_at` within the last 10 minutes. Anything older is marked seen silently. This kills the whole class of replay bugs regardless of why an old id showed up unseen, which matters because the seen-set has now been patched twice.
Alternative: keep the unseen-set as the only gate and hunt the specific cause of the unseen ids. Riskier, because the seen-set is a localStorage high-water mark and any read-path change that surfaces previously hidden rows re-breaks it.

**D2. Which timestamp to compare.** Recommended default: `created_at` (when the row was written), never `story_date` (the date the story is about, which can be 1993). Confirm during the session that `created_at` is present on the `Story` and `Claim` objects returned by `GET /api/stories` and the claims read; if a field is missing from the select, add it to the select rather than falling back to `story_date`.
Alternative: compare against a mount timestamp and celebrate only entries that appear after the first settled render. Works for the add-in-session case, but misses a genuine add that races the initial load.

**D3. Threshold.** Recommended default 10 minutes. Long enough to cover a slow add plus an accidental reload, short enough that nothing historical can slip through.

**D4. Apply to both effects.** Recommended default: gate the claim effect and the story effect identically, plus the first-3-stories loop where it keys off arrival rather than a persisted flag. One shared helper, one threshold constant.

**D5. Keep the seen-set.** Recommended default: leave the existing seen-set in place and keep writing to it. Recency is an additional gate, not a replacement. Removing the seen-set would let a genuinely new entry re-celebrate on every reload within the window.

---

## Report

- **August 18, 16:30 UTC**, from `OWNER`, desktop Chrome 1411x965, `https://linestry.com/people/jay_balmer`:
  "I just went to my own page when signed in via the Riders tab, and a couple of notifications popped up in the bottom right corner about stories that I posted a long time ago, and have already seen. No recent activity."
- Session replay: `posthog replay S-44 (link in bugs/private/session-ids.md)`
- No screenshot. **Open the replay first**: it will show how many toasts fired, in what order, and which titles, which distinguishes "two separate effect fires" from "one effect firing twice".

---

## Verified facts (grepped against the live repo this run, `main` at `7e400df`)

1. Bottom-right toasts come from `src/components/ui/toast.tsx` (`fixed right-4 ... bottom-4`, lifted to `bottom-36` when a Tier 1-2 celebration card is present). Story celebrations are queued via `queueCelebration` and surface through `CelebrationOverlay`, also bottom-right. Both match the reporter's description.
2. The two effects that can fire on a profile visit live in `src/components/profile/owner-timeline-panel.tsx`: the claim effect at ~line 486 and the story effect at ~line 586. The story effect queues a Tier 2 card titled `"<title>" is now on the record`, which is exactly the "stories I posted a long time ago" shape.
3. `/people/[id]` renders `OwnerTimelinePanel` for the owner (the branch at `src/app/people/[id]/page.tsx:209`, the same branch BUG-154 was about), so visiting your own rider page runs both effects. Jay arrived via the Riders tab, which is a client navigation, so the component mounted fresh.
4. The existing guard is a localStorage high-water mark: `src/lib/seen-celebrations.ts`, keyed `lineage_seen_entry_celebrations:<userId>:<kind>` with `kind` in `claim | story`. `null` means never initialised and seeds silently; any id not in the set is treated as a fresh add.
5. `storiesLoaded` gates the story seed and is set in a `.finally()` after a `Promise.all` of two fetches (`owner-timeline-panel.tsx:412` to `424`), so within a single mount the merged array is set before the flag flips. A same-mount partial seed is therefore unlikely and is NOT the leading hypothesis.
6. **Leading hypothesis:** `stories` is the union of authored (`author_id=<me>&on_timeline=true&limit=100`) and tagged-in (`rider_id=<me>&limit=100`). Any change that makes previously invisible rows visible adds OLD ids that are legitimately absent from the seen-set, and they then read as fresh adds. PR #188 (BUG-157 and BUG-138: own non-public stories now appear on every viewer list, and trust auto-approves a trusted asserter's tags) did exactly that. A `limit=100` boundary crossing does the same thing.
7. Secondary hypothesis worth 5 minutes: the seen-set is keyed by uid, and Jay signed a second account into the same browser six minutes after this report (BUG-168). If the store's `activePersonId` was ever transiently the other uid, a seed could have been written under the wrong key. Check the ordering in the replay; the toasts came first, so this is unlikely to be the cause here, but the two bugs should not be built in the same PR.
8. The story effect queues only `unseen[0]` per fire, so two toasts means either two separate effect fires (claim effect plus story effect) or two renders where `stories.length` changed. The replay settles which.

---

## Pre-flight (READ-ONLY)

```sql
-- How old are the stories that could have fired? If created_at is months back,
-- the recency gate in D1 is provably sufficient on its own.
select id, title, story_date, created_at, visibility, on_timeline
from stories
where author_id = (select id from auth.users where email = 'OWNER')
order by created_at desc
limit 20;

-- Tagged-in rows that PR #188 or a trust auto-approve could have newly surfaced.
select sr.story_id, s.title, s.created_at, te.status, te.source, te.created_at as tag_created
from story_riders sr
join stories s on s.id = sr.story_id
left join tag_events te on te.id = sr.tag_event_id
where sr.rider_id = (select id from auth.users where email = 'OWNER')
order by s.created_at desc
limit 30;
```

Also check in the browser, before clearing anything: read `localStorage['lineage_seen_entry_celebrations:<jay-uid>:story']` and compare its length to the number of stories the second query returns. A shortfall confirms hypothesis 6 and is worth one line in the PR body.

---

## Suggested order

1. Open the replay. Count the toasts and note their titles.
2. Run the pre-flight. Record whether the ids are old (they almost certainly are).
3. Add a shared `isRecentlyCreated(iso: string | null | undefined, withinMs: number): boolean` helper next to `src/lib/seen-celebrations.ts` and a single exported threshold constant (D3).
4. Apply it in the claim effect and the story effect (D4): when an entry is unseen but not recent, add it to the seen set and return without queueing. Keep the FTUE `triggerPrefs` writes firing as they do today, since those are idempotent flags and gating them would change FTUE tracking.
5. Confirm `created_at` is actually present on the objects in hand (D2). If not, widen the select.
6. `npx tsc --noEmit`.

## Acceptance criteria (BUG-167)

1. With localStorage cleared for the seen keys, loading your own `/people/<you>` fires zero celebration toasts when every entry is older than the threshold.
2. Adding a story while on your own profile still fires exactly one celebration.
3. Adding a claim still fires exactly one contextual celebration, and the board milestone path (first or second board) still fires its Tier 4 modal.
4. Reloading immediately after a real add does not re-fire the celebration (the seen-set still does its job inside the window).
5. Navigating to your own page via the Riders tab, then away, then back, fires nothing.
6. The 3-of-3 stories celebration still fires once when the authored count crosses 3 in a session and never on a load where it was already 3 or more.
7. FTUE trigger prefs (`ftue_shared_story`, `ftue_added_board`, `ftue_added_event`) are still set on a genuine add.
8. `npx tsc --noEmit` clean.

---

## Out of scope

- BUG-168 (account-switch identity bleed). Separate brief, separate PR, even though both touch client-persisted state.
- Redesigning the celebration tiers or copy.
- Moving the celebration logic out of `owner-timeline-panel.tsx`. Tempting, not this session.

## Notes for the session

- No migration unless step 5 finds a missing column in a select, which is a query change, not a schema change.
- Name BUG-167 in the PR title.
- Append one `bugs/SHIP-LOG.md` entry. Record `migration: none`.
- No em dashes anywhere you write.
