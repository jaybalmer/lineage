# Bug-fix session brief: Compare deep link does not prepopulate rider B (BUG-120)

> Drafted by the September 2, 2026 daily triage. Self-contained.
> **P2, client-only, single file, no migration. PIPELINE-SAFE: suitable for the unattended 05:00 run.**
> Name the BUG id (BUG-120) in the PR title or commit message. Append a `status: pending`
> SHIP-LOG entry before wrapping, then flip it to `merged` per the Ship sequence.

## Why this brief exists

BUG-120 was previously bundled with BUG-123 (compare score asymmetry) in
`bugs/2026-07-03-compare-functional-pass.md`. BUG-123 is diagnosis-first on the scoring math,
which makes that whole brief ineligible for the unattended slot. This brief **splits BUG-120 out**
so the pipeline has something it is allowed to build. BUG-123 stays in the old brief and is not in
scope here.

**This brief supersedes the BUG-120 half of `2026-07-03-compare-functional-pass.md`.** Two things
in that file are now wrong and are corrected below: its hard prerequisite is resolved, and its
root-cause diagnosis names the wrong data source.

- Its "HARD PREREQUISITE" (push the unmerged `fix/compare-avatars-black-BUG-024-067` branch) is
  **no longer applicable**. BUG-014, BUG-024 and BUG-067 all shipped via PRs #54 and #185. Ignore it.
- Its verified fact 2 blamed `catalog.people` and `catalogLoaded` for the failed resolution. That is
  not the mechanism. See "Verified facts" below.

## Scope

- **BUG-120: the Compare button on a rider page does not prepopulate that rider.** [P2] [reproducible]

One-line goal: make `/compare?b=<id>` resolve rider B once the data it needs has actually arrived,
instead of only at first render when that data is still empty.

**Explicitly out of scope:** BUG-123 (score symmetry), any change to `src/lib/connection-summary.ts`,
and any change to slot A.

## DECISIONS (review before building)

All four carry a recommended default. The brief is fully build-ready on these defaults.

**D1. Where to resolve the `?b=` id.** Recommended: resolve against `allPeople` first, then fall back
to `catalog.people`. That covers members, mock people, and catalog or ghost person nodes in one pass.
Alternative: `allPeople` only, which leaves the Compare button on a ghost rider page silently doing
nothing (it is rendered for ghosts, see fact 4).

**D2. What happens when the id never resolves.** Recommended: leave slot B empty and render the
existing empty state, no error, no toast. The page already handles `personB === null`. Alternative:
show a "we could not find that rider" message, which adds a new copy string for a rare case.

**D3. Whether a resolved deep link can overwrite a manual pick.** Recommended: no. Only auto-fill
while `personB` is still null, so a user who picks someone from the dropdown before the fetch lands
does not get overwritten a beat later. Alternative: always sync to the param, which is simpler but
can yank a selection out from under the user.

**D4. Whether to strip `?b=` from the URL after resolving.** Recommended: no, leave the URL alone.
Keeping the param means a refresh or a shared link still works. Alternative: `history.replaceState`
it away for tidiness, which breaks refresh.

## Report

- **BUG-120:** July 3, 2026, 02:49 UTC (report started 01:47). Cory, `R1`,
  iPhone Safari 414x554, reported from `https://linestry.com/compare?b=0394914d-6ffd-4a18-aa1f-1aafee7ce53a`.
  "I view another rider and on their page, there is this compare button. When I press on it, it takes
  me to the compare screen but the rider I was just viewing is not prepopulated in one of the slots A
  or B." No screenshot. PostHog replay session `S-25`, offset 515s.

## Verified facts (re-checked against the working tree on September 2, 2026)

1. **Two surfaces emit the deep link, not one.** `src/app/people/[id]/page.tsx:369` renders
   `<Link href={\`/compare?b=${resolvedId}\`}>`, and
   `src/app/(community)/[community]/connections/page.tsx:99` renders the same shape with `personId`.
   The July 3 brief only knew about the first. Both must work after the fix.

2. **The compare page reads the param exactly once, in a `useState` initializer.**
   `src/app/compare/page.tsx:475-478`:

```tsx
  // Pre-select Person B from ?b= query param
  const bParam = searchParams.get("b")
  const initialB = bParam ? (allPeople.find((p) => p.id === bParam) ?? null) : null
  const [personB, setPersonB] = useState<Person | null>(initialB)
```

   `useState` initializers run on the first render only. If the lookup misses at that instant,
   `personB` is null forever, because nothing re-runs the lookup when the data arrives.

3. **The lookup misses because `allPeople` is empty of real riders at first render, and the reason is
   NOT the catalog.** This is the correction to the July 3 brief. `allPeople` is built at
   `src/app/compare/page.tsx:433-448` from three sources: the static `PEOPLE` mock array, `realProfiles`,
   and the active user. `realProfiles` is populated by a Supabase fetch in a `useEffect` at lines
   409-427, so it is `[]` on the first render by definition. A real rider's UUID therefore cannot
   resolve at the moment `initialB` is computed. `catalogLoaded` is irrelevant here and does not
   appear in this file.

4. **`realProfiles` only queries `profiles` where `privacy_level = 'public'`** (line 413). It never
   reads the `people` catalog table. So catalog and ghost person nodes are not in `allPeople` at all,
   and their ids will not resolve even after the fetch settles. Meanwhile the Compare button at
   `people/[id]/page.tsx:369` renders for every person including ghosts (the "Invite to Linestry"
   button is its sibling conditional). This is why D1 recommends the `catalog.people` fallback.

5. **`catalog` is already destructured in this component and `catalog.people` is already used here.**
   Line 359 destructures `catalog` from `useLineageStore()`, and lines 387 and 392 already do
   `catalog.people.find((x) => x.id === id)` for the BUG-067 name resolver. So the D1 fallback needs
   no new import, no new store subscription, and no new fetch.

6. **Everything downstream of `personB` is already effect-driven and will pick up a late set.**
   The DB-claims fetch keys on `[personB?.id]` (line 497), the scoring slices key on `[personB, ...]`
   (lines 509 and 524), and the story-facts effect keys on `[personA.id, personB?.id]` (line 538).
   Calling `setPersonB` later behaves the same as picking from the dropdown. No downstream changes needed.

7. **`personA` is unaffected.** It initializes from `currentUser` at line 473 and is out of scope.

## Suggested implementation order

1. Add a resolution effect next to the existing `personB` state (around lines 475-479) that reruns
   when the inputs change, rather than resolving once. Sketch, not literal code, adapt to the file:

   - inputs: `bParam`, `personB`, `allPeople`, `catalog.people`
   - guard: do nothing if there is no `bParam`, or if `personB` is already set (D3)
   - resolve: `allPeople.find(...)` first, then `catalog.people.find(...)` (D1)
   - on a hit, `setPersonB(found)`; on a miss, do nothing (D2)

2. Keep the existing `initialB` line or drop it. If you keep it, the effect is a no-op on the warm
   path where the mock or already-loaded data resolves immediately. Either is acceptable; keeping it
   is the smaller diff.

3. Watch the effect dependency list against the file's existing eslint pattern. Several effects here
   carry `// eslint-disable-line react-hooks/exhaustive-deps` (lines 497 and 538). Match whatever
   keeps `npx tsc --noEmit` and `eslint` clean rather than fighting it.

## Acceptance criteria

- **Cold load, member rider.** In a fresh tab with no warm cache, open a member rider's page, tap
  Compare, and land on `/compare?b=<uuid>` with that rider filled into slot B and the comparison
  rendering. This is the reported failure and is the primary criterion.
- **Second surface.** The same holds from the connections page link
  (`(community)/[community]/connections/page.tsx:99`).
- **Ghost or catalog rider.** Tapping Compare on a ghost or catalog-only person page fills slot B
  with that person (via the D1 fallback). If it cannot resolve, slot B stays empty and the page
  renders its normal empty state with no console error and no crash.
- **No overwrite.** Navigate to `/compare?b=<uuid>` and pick a different rider from the B dropdown
  immediately, before the page settles. Your pick stands (D3).
- **No param, no change.** Plain `/compare` with no query string behaves exactly as it does today.
- **No regression** in slot A, in the score, in the avatars or names (BUG-024 / BUG-067), or in the
  invite prompt shown for riders with no claims.
- `npx tsc --noEmit` clean. Client-only. **No migration, no `_public` view, no write path, no auth,
  no payments.**

## Pre and post deploy SQL

**None.** This change touches one client component and reads data that is already fetched. There is
no schema change, no view rebuild, and no backfill.

## Standing rules

One PR, BUG-120 in the title. No em dashes anywhere, including in any comment you add. Run the full
Ship sequence before wrapping: classify the migration (there is none, say so explicitly), merge the
PR yourself with `gh pr merge` since none of the exception conditions apply, then append the
SHIP-LOG entry with `migration: none` and `status: merged`. The `bugs/` folder is gitignored, do not
commit it.
