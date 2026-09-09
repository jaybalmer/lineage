# Bug-fix brief: founding-badge popup copy fix (BUG-052)

> Drafted from the June 16 Cowork decision session. Build-ready on the decision below.
> One PR. Name BUG-052 in the PR title. Copy-only, auto-merge eligible.

## Goal
The FTUE popup must not promise a "founding rider badge" at 5 timeline entries, because founding is a deliberate / paid tier that 5 entries does not grant.

## Scope
- **BUG-052**: a popup told an early user they would get founding rider badge status after 5 entries; they added 5 and nothing changed. The promise and the actual reward disagree.

## DECISION (made by Jay, June 16)
Fix the copy, do NOT wire a founding reward at 5 entries. Founding membership stays a deliberate/manual/paid tier (see BUG-037 founding-number work). Reword or remove the popup so it no longer promises founding status (or any badge) at the 5-entry threshold. If the popup is otherwise useful as an encouragement nudge, keep the encouragement but drop the founding-badge claim; do not invent a new reward.

## Verified suspected files (from CLAUDE.md + session log)
- The FTUE / onboarding popup copy that promises founding status at 5 entries (FTUE surfaces in `src/components/onboarding/`; the celebration/guide copy shipped in the FTUE launch-must slice, PR #35). Grep for the founding-badge / "5 entries" promise string.
- Do NOT touch `memberships` / `founding_member_number` logic; this is a copy change only.

## Acceptance
- The popup no longer promises a founding rider badge (or founding status) at 5 timeline entries.
- No founding-tier grant logic is added or changed.
- Any retained encouragement copy is truthful about what the member receives.

## Suggested order
1. Grep for the promise string and locate the popup.
2. Reword (or remove) so the founding promise is gone.
3. Confirm no membership/founding code path is touched.

## Notes
No migration, no write path, copy-only. `npx tsc --noEmit` clean. One PR, BUG-052 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
