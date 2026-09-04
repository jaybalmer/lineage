# Bug-fix brief: "Invite a rider" button on connections cannot be pressed (BUG-096)

> Self-contained, diagnosis-first. Drafted June 22, 2026 by the daily triage; the live repo was grepped. HUMAN-RUN recommended: confirm whether the button is intentionally disabled (gated state) or an enabled control whose tap is being intercepted, then fix or surface the criteria.

## Goal

On `/me/connections` the "invite a rider" button does not respond to a tap, and the criteria for it to activate are not communicated. Either make it respond (open the invite flow) or clearly show what enables it; no silent dead control.

## Scope

- **BUG-096** (P2): the "invite a rider" button on the connections screen cannot be pressed; no visible criteria for it to become active.

## DECISIONS (review before building)

1. **Gated vs intercepted.** Recommended default: DIAGNOSE first. (a) If the button is intentionally `disabled` until some state is met (a selected rider, a non-empty search, an entitlement), surface the criteria with helper text and/or a clearly-disabled style, and make the enabled state reachable. (b) If the button is enabled but its tap is intercepted (an overlay layer or `pointer-events` issue, like the BUG-071 report-bug widget on mobile), fix the overlay / hit target so the tap registers. Default = diagnose which case, then apply the matching fix.
2. **Where invite leads.** Recommended default: tapping an enabled "invite a rider" opens the existing invite-rider modal/flow (the same one used elsewhere for ghost/rider invites). Do not build a new invite flow. Default = wire to the existing invite-rider modal.

## Verified suspected files / symbols (grepped on live main)

- `src/app/(community)/[community]/connections/page.tsx` (the community connections page). NOTE: the report URL was `/me/connections`; confirm whether `/me/connections` is its own route or proxy-aliases to this page. Grep `src/app` for a `me/connections` route (`me/connections/page.tsx`) and the `/me/connections` candidate-filter work from BUG-038 (PR #88) to find the exact file that renders the invite affordance the reporter saw.
- The invite-rider modal: it is in the shared scroll-lock set as `invite-rider` (see the `useBodyScrollLock` applied-modals list in PR #80). Grep for `invite-rider` / `InviteRider` to find the component and how it is opened from the connections screen.
- Lead hypotheses to check:
  - The button has a `disabled={...}` condition (e.g. requires a selected/searched rider) with no helper text, so it reads as a dead control.
  - The button is enabled but sits under an overlay or has `pointer-events:none` / a too-small touch target on mobile (the BUG-071 family is adjacent: report-bug widget taps unreliable on mobile).
  - A handler that is wired but throws / no-ops silently.

## Diagnosis steps (do these first)

1. Open `/me/connections` signed in on a 414px viewport and locate the "invite a rider" button; check the replay `S-18` (offset 98 seconds) for what the user tapped.
2. Inspect the button: is it `disabled`? What condition gates it? Is anything overlaying it?
3. Apply the matching fix per DECISION 1.

## Acceptance criteria

- BUG-096: the "invite a rider" button on `/me/connections` either responds to a tap (opening the existing invite flow) or clearly communicates the criteria that enable it; no silent dead control; works on mobile Safari.
- `npx tsc --noEmit` clean.

## Notes / guardrails

- HUMAN-RUN / diagnosis-first: confirm gated-vs-intercepted before editing.
- Likely client-only; no migration, no `_public` view. If the invite path touches an authed invite API, keep within the existing invite flow (no new endpoints) unless the diagnosis shows otherwise.
- Name **BUG-096** in the PR title or commit message (the daily reconcile greps for the id).
- Append a `status: pending` entry to `bugs/SHIP-LOG.md` at session end. Do not edit earlier entries.
- No em dashes anywhere (code, comments, copy). Use periods, commas, parentheses, colons, or semicolons.
