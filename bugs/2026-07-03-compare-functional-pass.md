# Bug-fix session brief: compare functional pass (BUG-120 + BUG-123)

> **SCOPE CHANGED September 2, 2026. BUG-120 IS NO LONGER IN THIS BRIEF.**
> BUG-120 was split out into `bugs/2026-09-02-compare-deep-link-prepopulate.md`, freshly
> re-verified against the current tree, so the unattended pipeline has something it is allowed to
> build. Do not build BUG-120 from this file and do not run both briefs. **Only BUG-123 remains
> here**, and it is still diagnosis-first.
>
> Two facts below are also now stale and are corrected in the new brief: the HARD PREREQUISITE is
> resolved (BUG-014, BUG-024 and BUG-067 all shipped via PRs #54 and #185), and verified fact 2
> blames `catalog.people` / `catalogLoaded` for the failed `?b=` resolution, which is the wrong
> data source. The real cause is the async `realProfiles` fetch that feeds `allPeople`.
>
> Drafted by the July 3, 2026 daily triage. Self-contained.
> **P2, client-only, HUMAN-RUN candidate** (BUG-123 is diagnosis-first on the scoring
> math, so this is not an unattended auto-merge batch).
> Name the BUG ids (BUG-120, BUG-123) in the PR title or commit message. Append a
> `status: pending` SHIP-LOG entry before wrapping.

## HARD PREREQUISITE (read first)

The July 2 human session already built the compare RENDERING fix (BUG-024 avatars + BUG-067 "Unknown" names) as local commit `f47184b` on branch `fix/compare-avatars-black-BUG-024-067`, but that branch was NEVER PUSHED and no PR exists. It edits the same file this brief targets (`src/app/compare/page.tsx`).

**Before starting this brief: push that branch, open/merge its PR (naming BUG-024/067), then branch from the updated main.** Do not rebuild its scope, and do not start this brief from a main that does not contain it (you would collide on merge).

## Scope

- **BUG-120: Compare button on a rider page does not prepopulate that rider.** [P2] [reproducible]
- **BUG-123: Compare score changes when riders A and B are swapped (50 pts vs 42 pts).** [P2] [reproducible] [diagnosis-first]

One-line goal: make `/compare` honor its `?b=` deep link and make the overlap score symmetric regardless of which slot each rider is in.

## DECISIONS (review before building)

No open product decisions. One implementation default flagged:
- BUG-123 fix direction: recommended = feed the scorer the SAME shape of claim set for both riders (symmetric subject-or-object, public-only) so score(A,B) == score(B,A). Alternative: document the asymmetry as intended (not recommended; testers read it as broken).

## Reports

- BUG-120: July 3, 02:49 UTC (report started 01:47), Cory (R1), iPhone Safari 414x554, from `https://linestry.com/compare?b=0394914d-6ffd-4a18-aa1f-1aafee7ce53a`. "I view another rider and on their page, there is this compare button. When I press on it, it takes me to the compare screen but the rider I was just viewing is not prepopulated in one of the slots A or B." No screenshot. Replay session `S-25`, offset 515s.
- BUG-123: July 3, 03:19 UTC, Cory, iPhone Safari 414x525, `https://linestry.com/compare`. "If you put Sean A and Jay in B. You have 50 compare points. If you flip the Positions there is only 42 compare points. I expected the compare points would be the same." No screenshot. Same replay session, offset 5924s.

## Verified facts (checked against the live repo July 3)

1. The person page DOES pass the param: `src/app/people/[id]/page.tsx` line ~330 links `/compare?b=${resolvedId}`.
2. The compare page DOES read it, but only once, at first render: `src/app/compare/page.tsx` lines ~486-488:

```tsx
const bParam = searchParams.get("b")
const initialB = bParam ? (allPeople.find((p) => p.id === bParam) ?? null) : null
const [personB, setPersonB] = useState<Person | null>(initialB)
```

`useState` initializers run exactly once. `allPeople` derives from `catalog.people`, and the catalog loads async after mount (`catalogLoaded`, see the codebase CLAUDE.md gotcha #4: catalog is NOT persisted). On a cold navigation the catalog is empty at first render, `initialB` is null, and `personB` never updates when the catalog arrives. That is BUG-120's likely root cause; verify by logging `catalogLoaded` at mount, then fix with an effect: when `bParam` is set, `personB` is null, the user has not manually picked B, and the catalog has loaded, resolve and set person B.
3. BUG-123, the asymmetry: the two sides get DIFFERENT claim sets. Person B's claims are fetched from `claims_public` symmetric (subject OR object, public only; lines ~495-505, a deliberate BUG-014 fix so a `rode_with` where B is the object still feeds the scorer). Person A (usually the signed-in user) gets claims via the local store (`getAllClaims()` slice), which differs in shape (subject-only vs symmetric, and may include session/private claims). Swapping who sits in A vs B therefore changes the scorer input and the total. Diagnose with Jay vs Sean: dump both claim arrays in each orientation, diff, and confirm which categories account for the 8-point gap before changing the scorer input. The scorer itself is `src/lib/connection-summary.ts`; prefer fixing the INPUTS (same fetch/filter shape for both riders) over touching the scoring weights.

## Suggested order

1. Ship-finish the prerequisite branch (push `f47184b`, PR, merge).
2. BUG-120 (small, verifiable, isolated effect).
3. BUG-123 diagnosis, then the input-symmetry fix.

## Acceptance

- BUG-120: from any rider page, tapping Compare lands on `/compare` with that rider prepopulated in slot B, on a cold load (fresh tab, catalog not yet cached). Works for profile-backed, catalog, and ghost people; if the id cannot be resolved once the catalog is loaded, the slot stays empty without erroring.
- BUG-123: comparing Jay and Sean gives the same total pts in both orientations. Spot-check one more pair (e.g. Cory vs Erik). The BUG-014 behavior (object-side rode_with feeding the scorer) still holds.
- No regression on the BUG-024/067 rendering fix (avatars and names still resolve).
- `npx tsc --noEmit` clean. Client-only, no migration.

## Standing rules

One PR, BUG ids in the title. No em dashes anywhere. Run the full Ship sequence before wrapping. Append the SHIP-LOG entry. The `bugs/` folder is gitignored; do not commit it.
