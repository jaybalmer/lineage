# FTUE Conversion Pass: Claude Code Handoff (first-wave activation support)

**Date drafted:** 2026-07-02 (Cowork session with Jay)
**Model:** Opus 4.8 (standing default; nothing here is Fable-class)
**Estimated session size:** ~4 to 6 hr build + ~30 min pre-flight reads + ~30 min deploy. One PR preferred; split into PR 1 (Tasks 1 + 2) and PR 2 (Tasks 3 + 4) only if the session runs long. **Expected migration-free** (see §2).
**Why now:** the snowboard first-wave push goes out the week of July 6 (`Community Outreach/First-Wave-Push-Plan.md`). Most of those ~12 contacts already exist as unclaimed nodes. This session makes (a) inviting them by email a one-click editor action, (b) their arrival feel like "your history is already here," and (c) their first 3 stories a guided loop. June funnel context (PostHog, June 1 to 30): 165 unique visitors, 34 unique onboarding landings, 17 completed the land step, 13/13/12/11 through the middle steps, 9 reached timeline_aha, ~9 signup_starts, 2 signups succeeded. Two cliffs: the land step (34 to 17) and the auth gate (9 to 2).

Drafted with the 24-check pre-flight playbook applied (`feedback_brief_drafting_schema_check.md`). Verified facts in §3. Facts sourced from an automated repo audit rather than a direct read are marked AUDIT; confirm them during the §7 pre-read pass before relying on them.

---

## 0. DECISIONS (review before building; defaults ship if unreviewed)

| # | Decision | Recommended default |
|---|---|---|
| D1 | Where does the proactive invite affordance live? | Editor-only "Invite to claim" button on `/people/[id]` for `catalog`/`unclaimed` nodes, plus the same action on `/admin/claims`. The person page is Jay's actual workflow: he is in a Messenger thread, looks the rider up, clicks Invite, pastes the email. |
| D2 | Does the proactive invite create a `claim_requests` row? | Yes, reuse the PR #138 substrate wholesale: insert `claim_kind='public_invite'`, `status='approved'`, `claimant_email`, then run the same post-approval steps (stamp `invite_email`, flip catalog to unclaimed, send the invite magic-link email). One code path for both entry points; `admin-invite-complete` then works unchanged at signup. |
| D3 | Welcome-moment surface | One-time overlay/card on the profile/timeline the claimant lands on, driven by a flag set in `/auth/complete` when `admin-invite-complete` returns `claimed: true`. Copy: "Welcome, [name]. Your history is already here." + moment count + primary CTA "Add your first story". Dismissable, never shows twice. |
| D4 | First-3-stories loop shape | Small progress chip on the owner's My Timeline near the Add Story affordance: "First stories: n/3" with a celebration at 3/3 reusing the existing milestone-celebration pattern. Counts authored stories (any, not just FTUE-era). Hide once 3+ stories exist. No schema; derive from the already-fetched authored-stories data. |
| D5 | Land-step cliff fix scope | Copy + weight only, no structural change: tighten the land step to lead with the promise ("Two minutes. Your history starts saving.") and make the Start CTA dominant. ALSO re-run the June funnel excluding bot traffic (`$virt_is_bot`) before concluding the cliff is real; some of the 34 may be crawlers. |
| D6 | Auth-gate cliff fix scope | Telemetry first, fixes gated on findings: add a `signup_failed` capture (method + error class) on the OAuth dispatch and magic-link submit error paths, and review the June session replays of the 9 signup_starts. Fix in-session ONLY what is obvious and small (e.g. an error swallowed silently); anything structural becomes a follow-up brief. Hard cap: 1 hr on this task. |

## 1. Prerequisites

1. Pull `main` at `/Users/jaybalmer/lineage/`. `npm run dev` runs from that root; smoke from it.
2. `.env.local` symlink into any worktree (known `@supabase/ssr` prerender friction).
3. Plus-aliased gmail test accounts per the standing pattern (`jaybalmer+ftue*@gmail.com`).
4. PostHog access for the D5/D6 diagnosis steps (June replays + bot-filtered funnel re-run).
5. No other feature branch in flight touching `/auth/complete` or `/people/[id]`.

## 2. Scope summary

**Task 1 (headline): proactive admin invite-to-claim.** New editor action to invite a person node to claim their account given an email, reusing the PR #138 email-first path end to end. Today that path only starts when an anonymous VISITOR submits their own email on the person page; there is no editor-initiated send (verified: no `invite_email` handling anywhere under `src/app/admin/`, and `/api/claim-requests` only consumes visitor-submitted `public_invite` rows).

**Task 2: invited-arrival welcome moment.** After an admin-invite claimant signs up, `admin-invite-complete` folds their node in and they land on their profile with no acknowledgment. Add the one-time "your history is already here" moment (D3) with the moment count and the first-story CTA.

**Task 3: first-3-stories loop.** The concrete push ask is "create an account and post 3 stories." Give it product support per D4.

**Task 4: funnel-cliff diagnosis + minimal fixes.** Land-step copy/weight pass (D5) and auth-gate failure telemetry (D6).

**Expected migration-free.** `claim_requests.claim_kind`/`claimant_email` and `people.invite_email` already exist (PR #138, migration `20260629000001`); Tasks 2 to 4 are UI + telemetry. If the build finds it needs a column, stop and re-check, and remember the merge-before-migration gate (Group F) if a write path would send it unconditionally.

**Out of scope, do not expand:** the full invited-wizard aha-card arc from the May 18 FTUE rethink (the admin-invite direct path supersedes it for this wave); Apple OAuth; FTUE suggestion surfaces ("you might know these people"); media/chronicler account type; any moderation-pipeline change; the deferred FTUE Tasks 6 to 11 not named here; structural auth changes beyond D6 telemetry.

## 3. Verified facts (2026-07-02, direct reads unless marked AUDIT)

1. **FTUE events:** `ftue_landed` / `ftue_aha_shown` fire from `src/components/onboarding/onboarding-flow.tsx:288-290`; dev-bypass `ftue_completed` at `:378`; `signup_started` (method payload) from `src/components/onboarding/save-step.tsx:51,67`; `signup_succeeded` at `src/app/auth/complete/page.tsx:86` and `ftue_completed` at `:197`, both gated to brand-new accounts (comments at `:35,193-194`). `ftue_step_completed` carries a `step_id` property (PostHog-verified values: land, name, start_year, last_place, first_board_brand, timeline_aha).
2. **Wizard shape:** organic steps as instrumented above; the invited variant today is only a `claimContext` banner ("[inviter] added you to their snowboard linestry", `onboarding-flow.tsx:241-267,437-440`), not a separate arc.
3. **Admin-invite path (PR #138):** `POST /api/public/claim-node` (visitor submits email) -> `/admin/claims` approval (`claim_kind='public_invite'`) -> approval branch of `PATCH /api/claim-requests/[id]` stamps `people.invite_email`, flips catalog to unclaimed, sends the invite magic link -> at signup `/auth/complete` calls `POST /api/public/admin-invite-complete` (whole file read; header comment confirms the call site), which matches the verified session email against `claim_requests.claimant_email` AND `people.invite_email`, repoints `tag_events.subject_id`, and folds the node in via `promoteGhostToAccount` (`src/lib/promote-ghost.ts`). Idempotent; returns `{ claimed: boolean }`.
4. **No proactive send exists:** grep for `invite_email|sendInvite|Send invite` under `src/app/admin/` returns nothing; `/api/claim-requests/route.ts:45-48` explicitly excludes `public_invite` rows from the vouch flow.
5. **`{ claimed }` is already surfaced to the client** as the return value of `admin-invite-complete`; `/auth/complete` is the natural place to read it for the D3 flag. AUDIT: invited claimants currently land on their profile with no onboarding and no celebration.
6. **Fresh-account home-mountain/board bug is FIXED** (PR #135, June 29): onboarding payload now rides in `user_metadata` as a fallback for the magic-link fresh-browser case. Do NOT re-fix; regression-test it in §5. AUDIT-sourced; confirm the commit in the log during pre-reads.
7. **Milestone celebrations exist** for 1st/5th/10th entries, and story entry points include the timeline empty-state CTA and the daily-token chip. AUDIT; locate the exact component during pre-reads before wiring D4's 3/3 celebration to it.
8. **June funnel numbers** are in §0/§2 above (PostHog project 451141, unfiltered for bots; hence D5's re-run instruction).

## 4. Task specs

### T1: proactive invite-to-claim (editor)

- New `POST /api/admin/invite-node` (gate: `requireEditor`). Body: `{ node_id, email }`. Behavior: validate the node is `catalog` or `unclaimed` and not already invite-pending to a different email; insert the `claim_requests` row per D2; then execute the SAME post-approval steps the PATCH approval branch runs today. **Strongly prefer extracting that branch into a shared helper over duplicating it** so invite semantics stay single-sourced. (Pseudocode honesty: the exact extraction seam is a build-time read of `PATCH /api/claim-requests/[id]`.)
- `/people/[id]`: editor-only "Invite to claim" button on eligible nodes -> small sheet (email input + a preview line of what the invitee gets) -> POST -> confirmation state showing the invited email. Show "Invite sent to [email]" state on revisit (derive from `people.invite_email` + an approved `public_invite` row).
- `/admin/claims`: same action available from the list for eligible nodes (a row-level "Invite" affordance is enough).
- Re-send: allowed, same endpoint, same email only. Changing the email on an already-invited node is out of scope (decline in UI copy).
- Email: reuse the existing PR #138 invite email template/helper unchanged.

### T2: invited-arrival welcome

- In `/auth/complete`, when `admin-invite-complete` returns `claimed: true`, set a one-time client flag (follow the existing post-auth flag pattern found in pre-reads, e.g. the `welcome_pending` convention; do not invent a new storage pattern without flagging).
- On the landing surface (owner profile/timeline), render the D3 overlay once: name, moment count (their claims + tagged moments now visible), "Add your first story" primary CTA (opens AddStoryModal), quiet dismiss. Capture a `claim_welcome_shown` event.
- Degrade gracefully: if the folded node had zero moments, swap the count line for "Your timeline starts now."

### T3: first-3-stories loop

- Per D4. Progress chip visible only to the owner while authored-story count < 3; increments live on story create; 3/3 fires the celebration (reuse the milestone pattern per fact 7). Capture `first_three_stories_completed`.
- Copy suggestion (editable at build): "First stories: n/3. Don't overthink them. First board, best trip, a day that mattered."

### T4: funnel-cliff work

- Land step: D5 copy/weight pass in `onboarding-flow.tsx`'s land block. Before coding, re-run the June step funnel excluding `$virt_is_bot = true`; record the corrected numbers in the PR description.
- Auth gate: add `signup_failed` captures (method + error class, no PII beyond what existing events carry) to the OAuth dispatch catch and magic-link submit error paths in `save-step.tsx` and the magic-link route's client caller. Review the June replays of signup_starts; list findings in the PR. Fix only obvious small breaks (D6 cap: 1 hr).

## 5. Acceptance criteria

Verify on a Vercel preview with plus-aliased accounts.

A1. Editor on `/people/[id]` (catalog or unclaimed node) can send an invite to a pasted email; the node shows the invited state; the email arrives (branded, magic link).
A2. Non-editors see no invite affordance; the endpoint 401/403s for them.
A3. Clicking the magic link as a brand-new user creates the account, folds the node in (claims/tags now attributed), and lands on the owner profile. `signup_succeeded` fires; the PR #135 regression check passes (home mountain/board style data present when set on the node).
A4. The welcome overlay renders exactly once with the correct moment count; "Add your first story" opens AddStoryModal; dismiss persists across refresh.
A5. Zero-moment node degrades per T2.
A6. Re-clicking a used invite link does not error (existing idempotency) and does not re-show the welcome overlay.
A7. First-3-stories chip: shows 0/3 for a fresh member, increments on each story, celebrates at 3, then disappears permanently; never shows for members with 3+ stories or on others' profiles.
A8. `signup_failed` events appear in PostHog when OAuth is cancelled/errored and when magic-link send fails (force one of each).
A9. Land-step copy change live; bot-filtered June funnel numbers recorded in the PR description.
A10. `npx tsc --noEmit` clean; no `_public` view or moderation surface touched.

## 6. Data-quality questions for Jay (defaults ship)

Q1. Should the proactive invite also work on `claimed` nodes' unclaimed duplicates? Default: no, eligible = `catalog`/`unclaimed` only.
Q2. Welcome overlay CTA: "Add your first story" (default) or route into the 3-stories chip flow first? Default: CTA opens AddStoryModal directly; the chip is already visible behind the overlay.
Q3. Invite email copy: reuse PR #138 template verbatim (default) or add a Jay-personal line? Default: verbatim; personalization stays in the Messenger thread per the push plan.

## 7. Suggested order

1. Pre-reads: `PATCH /api/claim-requests/[id]` (whole file), `/auth/complete/page.tsx`, `onboarding-flow.tsx`, `save-step.tsx`, `promote-ghost.ts`, the milestone-celebration component (locate per fact 7), `/people/[id]/page.tsx`, `/admin/claims/claims-client.tsx`. Confirm the AUDIT-marked facts.
2. T1 endpoint + shared-helper extraction; then the two surfaces.
3. T2 flag + overlay.
4. T3 chip + celebration.
5. T4 telemetry + copy pass + diagnosis notes.
6. tsc, preview deploy, acceptance pass A1 to A10.
7. Ship sequence per repo `CLAUDE.md`: expect "No migration this session" stated explicitly; PR, wait for Jay's merge, SHIP-LOG entry (`type: feature`, `scope: ftue-conversion-pass`).

## 8. Standing rules

No em dashes anywhere (code, comments, UI copy, PR text). Postcard card conventions unchanged. Auth helpers (`requireAuth`/`requireEditor`/`getServiceClient`) only; no new auth patterns. Read `story_riders`/`claims` through `_public` views on any public read this touches.
