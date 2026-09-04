# Bug-fix brief: onboarding state lost across the magic-link round trip

> Build-ready. Self-contained. One PR. HUMAN-RUN (auth-sensitive: touches the
> signup profile upsert + claim migration + magic-link flow). Do NOT let the
> autonomous pipeline auto-merge this. Read the DECISIONS block before building.

**Cluster:** BUG-115 + BUG-116 (both P1, both new June 26, same tester, same session, same root cause)
**Goal:** A new member who finishes signup via the email magic link keeps the name they typed and the home-mountain / board-brand picks they made during onboarding, instead of getting an email-derived name and an empty timeline.

---

## DECISIONS (review before building)

- **D1. Where to carry the onboarding payload across the magic-link round trip.**
  Recommended default: stash the onboarding payload (display_name, birth_year,
  start_year, first_place_id, first_board_id, and the pending session claims) into
  the Supabase auth user's `user_metadata` at magic-link generate time (the
  `/api/auth/magic-link` route already runs `admin.generateLink` with the service
  role, so it can also `admin.updateUserById` / pass `data` on create). Then
  `/auth/complete` reads `user.user_metadata` as the source when the client store
  is empty. No migration. Alternative: a `pending_onboarding` table keyed on the
  normalized email (needs a migration; more durable but heavier). Pick metadata
  unless you want the table.
- **D2. Scope: fix both symptoms, or name-first.**
  Recommended default: fix BOTH in one PR (name + claims) since they share the
  single root cause and the fix path is the same payload hand-off. The name
  (BUG-115) is the more visible, always-fires symptom; the claims (BUG-116) only
  bite users who picked a mountain/board. If the claim re-creation proves large or
  risky, ship the name fix and split the claim migration into a follow-up, but the
  default is one PR.
- **D3. Keep the existing same-browser path working.**
  Recommended default: treat `user_metadata` (or the table) as a FALLBACK that is
  only used when the client store is empty; when the same-browser store is present
  it still wins (it is the freshest). This keeps the happy path byte-for-byte and
  only repairs the cross-context case. Do not remove the existing
  `useLineageStore.getState()` read.

---

## Symptoms (verified from the reports + screenshots)

- **BUG-115:** Started a new account, entered a name in the first step, then chose
  "sign in with email" and used the link to complete. The profile name became the
  email local part (`raeght6ni`) instead of the typed name. Profile landed at
  `https://linestry.com/people/raeght6ni`.
- **BUG-116:** Same fresh account selected an existing home mountain and a board
  brand during onboarding, but neither showed on the timeline. The timeline reads
  "No claims yet. Start building your linestry." (confirmed in the screenshot).

Both reported June 26 2026 (00:37 and 00:41 UTC) by `R3` on an
iPad (iPadOS 18.7 Safari), one PostHog session
`S-23` (offsets 364s and 524s). Screenshots
`19f015bfb0607b50__0__bug-screenshot.jpg` and `19f01604f075af88__0__bug-screenshot.jpg`
in the "Linestry Bug Attachments" Drive folder.

---

## Root cause (verified against the live code)

The onboarding selections live only in the persisted Zustand store
(`lineage-store-v2` in client localStorage):

- `src/components/onboarding/onboarding-flow.tsx` writes onboarding fields
  (`setOnboardingField("first_place_id", ...)`, `("first_board_id", ...)`,
  `display_name`, `start_year`, ...) and adds the FTUE picks as `sessionClaims`
  via `replaceClaim()` / `addClaim()` (one claim per FTUE predicate).
- `src/components/onboarding/save-step.tsx` `sendMagicLink()` POSTs ONLY
  `{ email }` to `/api/auth/magic-link`. The onboarding payload is never sent to
  the server.
- `src/app/api/auth/magic-link/route.ts` generates the link from `{ email, intent,
  returnTo }` (line ~65) and does not capture any onboarding state.
- `src/app/auth/complete/page.tsx` reads `useLineageStore.getState()` for both the
  profile upsert and the claim migration:
  - Profile upsert (new users only), lines ~53-63:
    `display_name: onboarding.display_name?.trim() || user.email?.split("@")[0] || "Rider"`,
    `home_resort_id: onboarding.first_place_id ?? null`.
  - Claim migration, lines ~70+: `if (sessionClaims.length > 0) { ... insert }`.

When the magic link opens in a DIFFERENT browser context than where onboarding ran
(the default on iOS: the Mail app opens the link in its own webview / a fresh
Safari tab that does not share the originating localStorage), `getState()` returns
an empty `onboarding` and empty `sessionClaims`. Result: `display_name` falls back
to `email.split("@")[0]` (= `raeght6ni`, BUG-115) and zero claims are migrated
(empty timeline, BUG-116). This is the same failure mode noted earlier as the FTUE
"magic-link only works in the same browser window" friction signal; it is now
confirmed to corrupt the saved name and drop the picks, not just add friction.

OAuth signup is unaffected (the redirect stays in-context), which is why this only
bites the email path.

---

## Suspected files / surfaces (grep-verified)

- `src/components/onboarding/save-step.tsx`: `sendMagicLink()` (also the OTP
  fallback `signInWithOtp`); send the onboarding payload to the server here.
- `src/app/api/auth/magic-link/route.ts`: `admin.generateLink` path (line ~65,
  ~84-109); accept the onboarding payload and stash it (D1).
- `src/app/auth/complete/page.tsx`: profile upsert (lines ~53-63) and claim
  migration (lines ~70+); read the server-side fallback when the client store is
  empty.
- `src/store/lineage-store.ts`: `onboarding` slice, `sessionClaims`,
  `setOnboardingField`, `addClaim` (for shape reference; no change expected).

---

## Suggested implementation order

1. Decide D1 (default: `user_metadata`, no migration).
2. In `save-step.tsx`, include the onboarding payload in the magic-link POST body
   (display_name, birth_year, start_year, first_place_id, first_board_id, and the
   `sessionClaims` array). Do the same for the OTP fallback path (stash via the
   `data` option, which lands in `user_metadata`).
3. In `/api/auth/magic-link/route.ts`, accept the payload and stash it on the auth
   user (`admin.generateLink` create `data`, or `admin.updateUserById` for an
   existing-but-unconfirmed user). Keep `intent` signin/signup behaviour intact.
4. In `/auth/complete`, when the client `onboarding`/`sessionClaims` are empty,
   read the stashed payload from `user.user_metadata` and use it for the profile
   upsert (name + home_resort_id + birth_year + riding_since) and the claim
   migration. Keep the client-store path as the primary (D3).
5. Clear the stashed metadata after a successful complete so it cannot replay.

---

## Acceptance criteria

- **BUG-115:** A new user who types a name in onboarding, chooses email sign-in,
  and opens the magic link in a SEPARATE browser/window (simulating iOS Mail) ends
  up with the typed `display_name` on their profile, not the email local part. The
  same-browser path still preserves the typed name.
- **BUG-116:** The same flow re-creates the home-mountain and board-brand picks as
  durable claims so they appear on the new user's timeline (no "No claims yet" when
  picks were made). Picks made and completed in the same browser still work.
- No private data leak: the stashed payload is scoped to that auth user and cleared
  after complete.
- OAuth signup behaviour is unchanged.
- `npx tsc --noEmit` clean.
- Migration: none if D1 = `user_metadata`. If a `pending_onboarding` table is
  chosen instead, surface the SQL as a pre-merge gate.

---

## Pre-flight / notes

- Verify the iOS repro path: open the magic link in a different browser than the
  one onboarding ran in (or in a private window) to reproduce the empty-store case;
  the same-browser path will look fine and mask the bug.
- This is HUMAN-RUN. It edits the auth/profile upsert and the claim write path.
  Run it as a real session, not the autonomous auto-merge pipeline.
- Name BUG-115 and BUG-116 in the PR title or commit message so the daily triage
  reconcile can close them. Append a `status: pending` SHIP-LOG entry per the
  ship-sequence rule.
- No em dashes in anything written.
