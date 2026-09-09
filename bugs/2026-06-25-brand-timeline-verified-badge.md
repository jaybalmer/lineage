# Bug-fix brief: curated brand shows "unverified" on its own timeline entries

Date: 2026-06-25
BUG ids in scope: BUG-109
Run type: diagnosis-first (carries a product decision); HUMAN-RUN recommended
Estimated: ~30-45 min (mostly a decision + small copy/label change)

## Goal
On `/snowboarding/brands/Westbeach` the brand header reads "verified / curated by the brand", but the entries on the brand's own timeline still show "unverified". Cory flagged the inconsistency. Decide what (if anything) to change and apply it.

## DECISIONS (review before building; recommended default shown)
These are two different axes that currently read as one to the viewer:
- The brand header "verified / curated" reflects the ORG's `curation_tier` (`curated` / `founding`) (verified: `src/app/(community)/[community]/brands/[slug]/page.tsx` lines ~544-546).
- The "unverified" pill on each timeline row reflects that CLAIM's `confidence` (`item.claim.confidence === "self-reported" ? "unverified" : item.claim.confidence`, lines ~997 / 1041 / 1080). A self-reported claim is unverified regardless of which brand it points at.
- D1 (recommended default): keep claim-level "unverified" accurate (a self-reported claim IS unverified), but reduce the header-vs-row confusion. Recommended: soften / relabel the row pill or add a short tooltip clarifying that "unverified" is about the individual claim, not the brand (e.g. tooltip "This claim is self-reported and not yet corroborated"; the page already carries that sentence at lines ~122 / 146 / 337). Do NOT auto-mark a curated brand's claims as verified just because the org is curated (that would misrepresent uncorroborated claims).
- Alternative A: hide the "unverified" pill on a curated brand's own timeline rows (cleaner visually, but loses the corroboration signal).
- Alternative B: leave as-is and treat this as working-as-intended (claim confidence and brand curation are different things), closing BUG-109 as wont-fix with a one-line note.
Build on D1 unless Jay picks A or B.

## Verified facts
- Brand curation gate: `curation_tier === "curated" || "founding"` (lines ~544-546).
- Row pill source: claim `confidence`, mapped self-reported -> "unverified" at three render sites (lines ~997 / 1041 / 1080).
- Existing explanatory copy already lives on the page (lines ~122 / 146 / 337: "Unverified claims are visible to the community", "Claims are unverified until corroborated").

## Suspected files
- `src/app/(community)/[community]/brands/[slug]/page.tsx` (the three row-pill render sites + the curation gate).

## Acceptance criteria (BUG-109)
- On D1: a curated brand's timeline no longer reads as a flat contradiction with its header; the row pill is clarified (tooltip or softened label) while still signalling that an individual claim is uncorroborated. Standard (non-curated) brands unaffected.
- No claim is silently relabelled "verified" without corroboration.
- Client-only; `npx tsc --noEmit` clean; no migration.

## Ship
- One PR, branch `bugfix/bug-109-brand-timeline-verified-badge`. Name BUG-109 in the title/commit.
- Append a `status: pending` SHIP-LOG entry (`type: bug`, `ids: BUG-109`, `migration: none`). If Jay picks Alternative B (wont-fix), record the close in the triage instead of a PR.
