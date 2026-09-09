# Session plan: quality-of-life cluster (BUG-046, BUG-038, BUG-055, BUG-054, BUG-061)

> On-demand, HUMAN-RUN session. Prepped from Jay's June 16 working session. This is a SESSION PLAN: each bug already has a self-contained per-id brief (linked below); this file groups them into two PRs, pins the confirmed decisions, and sets the order. Where this plan and a per-id brief differ, THIS plan wins for this session (only BUG-055 differs, noted below).
>
> Do NOT let the autonomous 5 AM pipeline build this: PR 2 touches the auth redirect (BUG-054) and a member-facing equity number (BUG-061), both human-review-only. Run it yourself in Claude Code.
>
> Two PRs in one sitting:
> - PR 1 (lighter QoL, auto-merge-eligible by category but run here as part of the manual session): BUG-046, BUG-038, BUG-055.
> - PR 2 (sensitive, eyeball the auth flow and the equity numbers before merge): BUG-054, BUG-061.
> Run PR 1 first, get tsc green and merge, then PR 2. Append a `status: pending` SHIP-LOG entry per PR naming its ids. No em dashes anywhere (code, comments, UI copy).

---

## PR 1 — lighter QoL fixes

### BUG-046 — profile shows real public data to a logged-out viewer
- Brief: `bugs/2026-06-16-profile-real-data-loggedout.md` (implement from it).
- Decision (Jay, confirmed): a logged-out visitor at the profile route sees the real public profile (the same data as `/people/jay_balmer`), not the seeded mock/demo set. Repoint the logged-out path off `mock-data.ts` onto the real public read that `/people/[id]` already uses; cross-check the Boards / Places / Events stat tiles so logged-out and public views agree.
- Nuance to watch (so the result is not a surprise): `/people/[id]` reads `claims_public` filtered to `visibility='public'`, so a logged-out viewer sees only PUBLIC claims. If Jay expects all 10 boards visible publicly and only 3 are public-visibility, the remaining 7 are private-by-design (the BUG-035 owner-vs-public rule) and will still be hidden. This PR achieves logged-out == public-view parity (no mock numbers); it does NOT publish private claims. If after the fix the public count is still lower than Jay wants, that is a separate visibility decision (default claim visibility, or a one-time visibility update for Jay's claims), not part of this PR. Run the SQL below to see which case you are in.
```
select c.visibility, count(*) from claims c
join people p on p.id = c.subject_id
where p.display_name ilike 'jay balmer%' and c.predicate = 'owned_board'
group by c.visibility;
```

### BUG-038 — removed riders drop off Connections
- Brief: `bugs/2026-06-14-connections-stale-riders.md` (implement from it).
- Decision: read-time filter the connection sources to live (non-removed) people, so `/me/connections` never plots a rider absent from the directory. First grep the People-list removal path (hard delete vs `node_status` flip vs soft-hide) to pick the filter key; read through the `_public` views. Likely no migration.

### BUG-055 — "Recently added" (posted-date) sort; feed defaults to it
- Brief: `bugs/2026-06-16-feed-recently-added-sort.md` (implement from it) PLUS the scope extension below.
- Decision (Jay, confirmed June 16): make `/snowboarding/feed` DEFAULT to a "Recently added" sort keyed on `created_at` (posted time), keeping an event-date sort available as a secondary option. **Scope extension over the per-id brief:** also expose the same "Recently added" option on the `/snowboarding` community timeline (as an additional sort tab), but leave the community timeline's DEFAULT unchanged (still event-date Newest). So: feed default = Recently added; community timeline = adds the option, keeps its event-date default. Confirm `created_at` is present on every feed row type before relying on it; define an explicit fallback for any row type that lacks it. No migration.

PR 1: name BUG-046, BUG-038, BUG-055 in the title. One PR.

---

## PR 2 — sensitive, review before merge

### BUG-054 — returnTo redirect after sign-in
- Brief: `bugs/2026-06-16-post-login-returnto.md` (implement from it).
- Decision: capture the originating path as a `returnTo` (forwarded from the nav Sign in entry and stamped on the comment-email deep link), honor it at `/auth/complete` after login, default to My Timeline when absent, and validate the target is an internal path (no open-redirect). Must survive the `/auth/callback` hop for both Google OAuth and magic-link. AUTH-SENSITIVE, human-reviewed.

### BUG-061 — equity estimate uses a projected pool (~20,000)
- Brief: `bugs/2026-06-16-equity-estimate-projection.md` (implement from it).
- Decision (Jay, confirmed): projected pool floor of ~20,000 weighted tokens (PROJECTED_MEMBERS 1,000 x PROJECTED_AVG_WEIGHTED 20), encoded as tunable named constants in `src/lib/equity-offer.ts`; denominator becomes `Math.max(totalWeighted, myWeighted, PROJECTED_TOTAL_WEIGHTED)`; add a short "estimated at a projected end-of-offer pool" qualifier. Sanity check: a 20-weighted-token member estimates about 100 shares. HUMAN-REVIEWED: eyeball the resulting numbers before merge.

PR 2: name BUG-054, BUG-061 in the title. One PR.

---

## Order
1. PR 1: BUG-046 (run the SQL first), BUG-038, BUG-055. tsc green, merge.
2. PR 2: BUG-054, BUG-061. Review the auth flow and the equity numbers, merge.
3. One `status: pending` SHIP-LOG entry per PR, naming its ids. Do not edit the Shipped section of bug-triage.md; the next morning reconcile moves them.
