# Feature brief: contribution economy integrity (attendance split + quality-gated comp)

> Drafted August 3, 2026 in the BUG-151 session, from Jay's question: "the free membership
> is too easy to achieve, five days leads to a full year, we should change that threshold."
> Self-contained. Start from this file.
>
> Shape chosen by Jay in session: **quality-gated threshold** (not the top-N ranking
> alternative). The ranking model stays parked with BUG-057.
>
> No em dashes anywhere.

---

## Why this is urgent, and why it is cheap right now

`comp_earned_at` is null on **every** profile: no contributor comp has ever been granted.
So the rule can change with zero claw-back, zero recalculation and zero broken promise.
Both halves of this brief get materially harder the moment the first comp lands or the
first real paying member accumulates a balance. **This is a window, not a backlog item.**

---

## DECISIONS (review before building)

### D1. What happens to the daily visit token?
- **RECOMMENDED DEFAULT: keep the mechanic, change what it counts as.** Give it its own
  `token_type` (`engagement`) instead of `contribution`. The daily reward, the toast, the
  streak and the `DailyTokenChip` all stay exactly as they are; what changes is that
  attendance no longer counts as contribution, no longer counts toward the comp, and no
  longer carries equity weight.
- Rationale: the retention mechanic is real and already built (PR #115, #119). The problem
  is not that it exists, it is that it is filed under the wrong noun. A separate type makes
  the boundary structural, so no future call site has to remember to filter it out.
- ALTERNATIVE A: remove the daily visit reward entirely. Simplest ledger, but throws away a
  working habit loop for a problem that is really a labelling problem.
- ALTERNATIVE B: keep it as `contribution` and just exclude it at the comp and equity call
  sites. Smallest diff, but leaves a trap: every future reader of `token_contribution` has
  to know it silently includes attendance.

### D2. Retroactive or forward-only?
- **RECOMMENDED DEFAULT: retroactive.** Reclassify all 118 historical `daily_visit` rows.
- Rationale, measured in prod today: 101 of 118 attendance tokens belong to Jay (38),
  CY 1 (42, test), Cy 2b (15, test) and Sean (6). The remaining 17 are spread across five
  **free** members who are not in the equity pool at all (`isEquityEligible` counts
  annual / lifetime / founding only). So the retroactive version moves essentially nothing
  that anyone outside the founder + test set can see.
- ALTERNATIVE: forward-only, grandfathering the 118. Avoids touching history, but carries
  a 28% attendance distortion into the equity snapshot permanently.
- NOTE: this is the GATED half of the migration. See "Migration classification".

### D3. What counts toward the comp threshold?
- **RECOMMENDED DEFAULT: qualifying tokens only**, defined as contribution tokens that are
  ALL of:
  1. not `daily_visit` and not `backfill` (structural once D1 lands),
  2. earned on the member's **own** timeline, i.e. NOT a third-party tag where
     `subject_id <> asserted_by` (this closes the BUG-151 vector at the source: tagging
     other people can still earn equity weight, but can never buy a membership),
  3. **still standing**, i.e. the award's `source_ref` has not been net-reversed (PR #187
     already reverses on decline, so this is mostly free).
- ALTERNATIVE: count all contribution tokens but raise the number. Rejected in analysis:
  a cumulative counter with a one-time latch is farmable by construction, so raising 100 to
  500 converts a 5-day sprint into a 25-day sprint and changes nothing structural.

### D4. The numbers.
- **RECOMMENDED DEFAULT: 100 qualifying tokens, at most 5 counting per day, across at least
  30 distinct contributing days.**
- What that does to the farm: today the ceiling is 21 tokens/day (20 capped content plus the
  uncapped visit token), so the bar falls in 5 days. Under this rule the fastest possible
  path is **30 days of genuine, spread-out contribution**, and pure lurking earns nothing at
  all because attendance no longer qualifies.
- The per-day cap of 5 is preferred over a decay curve: same anti-burst effect, one number a
  member can actually understand and see on the membership page.
- CALIBRATION CHECK against real data: the best real free member currently has **0**
  qualifying tokens (their whole balance is attendance plus backfill), and the best real
  contribution total outside the founder is 15. So 100 is aspirational, which is the point.
  If it proves unreachable after a season of real usage, lower the number; do not loosen the
  spread requirement, which is the part doing the anti-farm work.

### D5. Is the comp permanent or renewable?
- **RECOMMENDED DEFAULT: 12 months, re-earnable.** Keep `comp_earned_at` as the anti-race
  latch for a single grant, but scope the qualifying window to a rolling period so a member
  who keeps contributing keeps the comp, and one who stops does not keep it forever.
- Rationale: converts "clear a bar once" into a standing incentive, and it removes the
  awkwardness noted in the BUG-151 session that a claw-back cannot undo a granted comp.
- ALTERNATIVE: keep the permanent one-time grant. Simpler, but the incentive dies the moment
  it is earned.

### D6. Should attendance keep equity weight?
- **RECOMMENDED DEFAULT: no.** Falls out of D1 automatically: `weightedTokens()` reads
  `TokenCounts.contribution`, so once attendance has its own type it stops weighting without
  any change to the equity code.
- This is the decision with the widest blast radius, because it changes the pool denominator.
  It is safe TODAY only because of the D2 measurement above. Confirm Jay is happy before
  building, and re-run the D2 query at build time in case new members have accrued since.

---

## Verified facts (measured in prod, August 3, 2026)

- `daily_visit` is written as `token_type = 'contribution'` via the `award_daily_visit` RPC
  (`src/app/api/me/route.ts:33`, migration-013) and is deliberately OUTSIDE
  `CAPPED_SOURCES` / `DAILY_CONTENT_TOKEN_CAP` (`src/lib/tokens.ts:29-38`).
- Ledger by source (net, `token_type='contribution'`): `daily_visit` **118**,
  `contribution_entry` 103, `backfill` 94, `contribution_entity` 42,
  `contribution_connection` 28, `contribution_media` 22, `contribution_source` 8.
  **Attendance is the single largest source, 28% of everything ever earned.**
- Real free members are almost entirely attendance: Erik Traulsen 14 total = 7 attendance +
  7 backfill + **0 contribution**; Alex Chalmers 4 = 4 attendance + 0; Cy 3 2 = 2 + 0;
  John Stewart 1 = 1 + 0. Bob Kronbauer 3 and steverecht 3 are the only non-zero real
  contribution totals among free members.
- `CONTRIBUTOR_COMP_THRESHOLD = 100` (`src/lib/equity-offer.ts`), granted by
  `maybeGrantContributorComp()` (`src/lib/tokens.ts`), latched by `profiles.comp_earned_at`,
  which the docstring correctly describes as never cleared so a claw-back cannot revoke a
  granted comp (BUG-103 lineage).
- `TOKEN_WEIGHTS = { founder: 2, member: 1, contribution: 1 }` and `weightedTokens()` reads
  `TokenCounts.contribution`, so anything typed `contribution` carries equity weight.
- `comp_earned_at` is **null on every profile**. No comp has ever been granted.
- Balance columns are `profiles.token_contribution` / `token_founder` / `token_member`.
  There is no `token_engagement` column yet; D1 needs one.
- PR #187 (merged `ef27230`, today) already reverses a contribution award when the tagged
  subject declines, via `reverseClaimAwardOnDecline()` in `src/lib/tag-events.ts`. D3.3
  builds on that rather than duplicating it.

---

## Scope

**In scope**
1. `token_engagement` column + `engagement` token type; `award_daily_visit` writes it.
2. Retroactive reclassification of the 118 historical `daily_visit` rows (D2).
3. A single `qualifyingContributionTokens()` helper (D3) that the comp check reads. One
   source of truth, mirroring how `isEquityEligible` was centralised.
4. Per-day counting cap and distinct-day requirement (D4).
5. Rolling qualifying window + re-earnable comp (D5).
6. Membership page: show qualifying progress honestly ("42 of 100 qualifying, 12 of 30 days"),
   and show attendance separately so the streak still feels rewarded. This also resolves
   **BUG-108** ("Earned Today reads 0/20 while the breakdown shows a Showing up +1"), which
   is the same confusion surfacing in the UI: fold that bug into this build and close it.

**Out of scope**
- The top-N ranking / leaderboard model (stays parked with BUG-057).
- Changing `TOKEN_WEIGHTS` values or the founder / member token types.
- Any change to Stripe, pricing, or the paid tiers.
- The `CONTRIBUTOR_COMP_THRESHOLD`-vs-farmed-tokens follow-up spawned as its own task in the
  BUG-151 session is SUPERSEDED by this brief; dismiss that chip when this is staged.

---

## Suggested implementation order

1. Re-run the D2 / D6 pre-flight queries. If a real paying member has accrued attendance
   tokens since August 3, stop and re-decide D2 with Jay before touching history.
2. Additive migration: `profiles.token_engagement` + allow `engagement` in the
   `token_events.token_type` domain. SAFE.
3. Point `award_daily_visit` at the new type and column. Verify a fresh visit lands as
   `engagement` and does NOT move `token_contribution`.
4. GATED migration: reclassify the 118 historical rows and rebalance the two columns. Print
   it, state the risk, wait for Jay.
5. `qualifyingContributionTokens()` + the comp check rewrite (D3, D4, D5).
6. Membership page progress UI + BUG-108 close-out.
7. `npx tsc --noEmit` clean.

---

## Acceptance criteria

- A member who only opens the app daily for 100 days earns **zero** qualifying tokens and is
  never granted a comp.
- A member who taps 100 connections onto other people's profiles earns **zero** qualifying
  tokens toward the comp (they may still earn equity weight per D3.2), and cannot reach the
  comp that way at all.
- The fastest possible honest path to the comp is at least 30 distinct contributing days.
- `weightedTokens()` no longer counts attendance, and the equity pool denominator changes by
  exactly the reclassified amount, verified before and after.
- The daily visit reward, its toast and its streak are visibly unchanged to a member.
- The membership page states qualifying progress and attendance separately, and no longer
  shows the BUG-108 "0/20 while +1 was earned" contradiction.
- Existing balances reconcile: for every profile, ledger sum per token type equals the stored
  column, checked the way the BUG-151 claw-back was checked.

---

## Pre-flight SQL (read-only; re-run at build time, do not trust the August 3 numbers)

```sql
-- D2 / D6 gate: does the retroactive reclassification touch anyone in the equity pool
-- other than the founder and the test accounts?
select p.display_name, p.membership_tier,
       sum(te.amount) filter (where te.source = 'daily_visit') as attendance_tokens,
       p.membership_tier in ('annual','lifetime','founding') as in_equity_pool
from profiles p
join token_events te on te.user_id = p.id and te.token_type = 'contribution'
group by p.display_name, p.membership_tier
having sum(te.amount) filter (where te.source = 'daily_visit') > 0
order by attendance_tokens desc;

-- Has any comp been granted yet? If this returns rows, D2 and D5 both need re-deciding.
select id::text, display_name, comp_earned_at, membership_source
from profiles where comp_earned_at is not null;

-- What would each member's QUALIFYING total be under D3, today?
select p.display_name, p.membership_tier,
       coalesce(sum(te.amount) filter (
         where te.source not in ('daily_visit','backfill')
           and not exists (
             select 1 from claims c
             where 'claim:' || c.id = te.source_ref and c.subject_id <> c.asserted_by
           )
       ), 0) as qualifying_today,
       count(distinct date_trunc('day', te.created_at)) filter (
         where te.source not in ('daily_visit','backfill') and te.amount > 0
       ) as contributing_days
from profiles p
join token_events te on te.user_id = p.id and te.token_type = 'contribution'
group by p.display_name, p.membership_tier
order by qualifying_today desc;
```

---

## Migration classification (per the CLAUDE.md risk gate)

- **SAFE:** `ADD COLUMN profiles.token_engagement`, extending the `token_events.token_type`
  domain, any new index. Apply in-session.
- **GATED:** the retroactive reclassification. It is an UPDATE of existing `token_events`
  rows plus a rebalance of two `profiles` columns, and it changes the equity pool
  denominator. Print it, state the risk, wait for Jay.
- **HARD PRE-MERGE GATE:** if `award_daily_visit` is repointed to write `token_engagement`,
  the column must exist before the PR merges or every daily visit errors in the window
  between. Same shape as the Group F lesson.

---

## Session close-out

- One PR. This is a feature session: `type: feature`, `ids: none`,
  `scope: contribution-economy-integrity` in `bugs/SHIP-LOG.md`. If BUG-108 is closed in the
  same PR, name it in the PR title so the daily reconcile picks it up.
- Record `migration:` with both halves (the SAFE additive one applied, and the GATED
  reclassification with its status).
