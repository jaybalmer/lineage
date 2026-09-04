# BUG-132 build brief: invited users skip the redundant "Save your linestry" step

Status: build-ready. Type: feature (FTUE). No migration. Estimated ~2 to 3 hr build + smoke.
Decision date: July 3, 2026 (Cowork sparring with Jay). Direction chosen: **Option A, invite email carries a magic link.** Security bar (magic-link-as-credential) accepted.

No em dashes anywhere in this brief or the code it asks for (standing rule).

---

## 0. Size and framing

Small, well-scoped. The redundancy is that an email-invited rider receives TWO emails and makes TWO clicks for one signup: the invite email, then a second "sign-in link" email they have to summon themselves at the end of onboarding (SaveStep).

The fix removes the second email for invited users by making the invite email's CTA a real magic link. The invitee clicks once, lands authenticated, and their profile folds in automatically. The entire authenticated tail that does the fold-in already exists and is reused unchanged. The build is essentially one route change plus a small welcome-moment capture.

---

## 1. What is true today (verified against the live repo)

1. `POST /api/invite` (`src/app/api/invite/route.ts`) is the per-profile invite. The inviter (authenticated) optionally supplies the invitee's `email`. The route:
   - mints a token, inserts an `invites` row (`id=token`, `person_id`, `invited_by`, `email=normalizedEmail`, `person_name`, `inviter_name`, `predicate`),
   - stamps `people.invite_email` and elevates the node to `node_status='unclaimed'`,
   - emails the invitee via Resend with a CTA linking to `${origin}/claim/${token}` (an UNauthenticated landing page),
   - returns `{ token, link }` to the inviter (the copyable share link).
2. `/claim/[token]` (`src/app/claim/[token]/page.tsx`) only loads the invite, and on "Claim my profile" stashes a sessionStorage prefill (`display_name`, `riding_since`, `invite_token`, `inviter_name`) then routes to `/onboarding`. It does NOT authenticate.
3. Invited users then run the full organic onboarding (`src/components/onboarding/onboarding-flow.tsx`, comment at line ~247: "Invited users fall through the organic flow") and reach `SaveStep` (`src/components/onboarding/save-step.tsx`), which requires Google OAuth or a magic-link email round-trip. This is the second email.
4. The authenticated tail already exists and already folds an email invite in by verified session email:
   - `/auth/complete` (`src/app/auth/complete/page.tsx`) establishes the session, upserts the profile, migrates session claims, then at **step 3** calls `POST /api/invite/claim` with any stored token, else email-keyed.
   - `POST /api/invite/claim` (`src/app/api/invite/claim/route.ts`) resolves the invite by token first, else by the **verified session email** (`invites.email = user.email`, lines 81 to 92), repoints the ghost's `claims` + `story_riders` onto the real account, restores the invited name over an email-placeholder name, marks the invite claimed, deletes the ghost, and returns `{ ok, claimed: true, display_name }`.
5. The PR #138 admin path already mints an account-creating magic link exactly the way we need: `applyNodeInvite` (`src/lib/node-invite.ts`) calls `db.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: `${origin}/auth/complete` } })` and emails the resulting `action_link`. This is the pattern to mirror.
6. `/auth/complete` already differentiates the arrival celebration: an admin-invite claim (step 4) sets `claim_welcome_pending` (the PR #153 T2 "your history is already here" `ClaimWelcomeOverlay`), everyone else gets the generic `welcome_pending`. The per-profile invite fold-in at step 3 currently does NOT feed that decision, so a per-profile invitee would get the generic welcome.

Net: because `/auth/complete` binds by verified email, an invite delivered as a magic link needs no token in storage, no onboarding wizard, and no SaveStep. Clicking the link is the claim.

---

## 2. DECISIONS (review before building, recommended defaults in place)

- **D1. Email invitees skip the onboarding wizard entirely and land on their populated profile.** Recommended: YES. The ghost already carries the invited `display_name`, and the inviter's `rode_with` claim now points at the new account, so the timeline is non-empty on arrival. This is the intended "invited arc" (aha = "your history is already here"), and PR #153 already built the `ClaimWelcomeOverlay` for exactly this landing. Members enrich name/board/place later from their profile. (If Jay wants a trimmed capture step instead, that is a larger change and a separate slice.)
- **D2. Keep the `/claim/[token]` page and the plain-link path as the fallback for link-only invites (no email captured).** Recommended: YES. When the inviter does not enter an email and just copies the link to text someone, there is no address to send a magic link to, so that path keeps today's behavior (land on `/claim/[token]`, run onboarding, hit SaveStep). SaveStep stays for organic signups and link-only invites.
- **D3. Handle the short magic-link lifetime with a fallback link in the same email.** Recommended: YES. Supabase magic links are short-lived (see Q1). Keep the existing `/claim/${token}` link in the email as a secondary "or claim your profile here" fallback for late clicks, with the magic link as the primary CTA. Even without this, an expired magic link degrades gracefully (see §4), so D3 is polish, not a blocker.
- **D4. Give per-profile magic-link invitees the same "your history is already here" welcome moment** as admin invitees, by capturing the `{ claimed }` result of step 3 and setting `claim_welcome_pending`. Recommended: YES. Small and additive.
- **D5. No "use a different account" escape hatch in v1.** Recommended: OMIT. The magic link authenticates as the invited email, which always matches the fold-in. A member who prefers Google can still use `/auth/signin` directly, and the email-keyed fold-in at `/auth/complete` still claims their ghost on that sign-in. Revisit only if it comes up.

---

## 3. Scope (what to build)

### 3a. `POST /api/invite` mints and sends a magic link when an email is present
`src/app/api/invite/route.ts`:
- Keep all current behavior: insert the `invites` row, stamp `people.invite_email`, elevate to `unclaimed`, return `{ token, link }` to the inviter (the copy-link fallback stays).
- When `normalizedEmail` is present, generate a magic link the same way `applyNodeInvite` does:
  ```
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
    options: { redirectTo: `${origin}/auth/complete` },
  })
  const magicLink = linkData?.properties?.action_link
  ```
  (`supabase` here is the existing `getServiceClient()` in this route.)
- Send the invite email with `magicLink` as the primary "Claim my profile" CTA. Keep the existing `inviteEmailHtml` copy and structure; per D3 add a secondary fallback line linking to the plain `${origin}/claim/${token}`. Fix the fine-print so it is accurate (see Q1): the primary button is a quick one-click sign-in, the fallback link lasts the invite window.
- If `generateLink` fails or returns no `action_link`, fall back to the current behavior (send the plain `/claim/${token}` link) so the invite always works. Log the failure.
- No-email invites (copy-link) are unchanged: no email is sent, the inviter shares the returned `link`.

### 3b. `/auth/complete` gives the per-profile invitee the invited welcome moment
`src/app/auth/complete/page.tsx`, step 3:
- Capture the response of the `POST /api/invite/claim` call (currently fire-and-forget). If it returns `{ claimed: true }`, treat it like `adminInviteClaimed` for the celebration decision at lines ~208 to 212, so the invitee gets `claim_welcome_pending` (the `ClaimWelcomeOverlay`) rather than the generic `welcome_pending`.
- Keep ordering unchanged (invite/claim before admin-invite-complete before public claim-complete). Only add the captured boolean into the existing `claim_welcome_pending` decision.

### 3c. No SaveStep change
`SaveStep` is untouched. Email invitees never reach it now (they land authenticated). Organic and link-only invitees still use it.

---

## 4. Graceful degradation (must hold)

- An expired or already-used magic link routes through `/auth/complete`'s existing expiry bounce to `/auth/signin?error=link_expired`. If the invitee then signs in normally with the same email, `/auth/complete` step 3 still folds their ghost in by verified email. So a late click is never a dead end: worst case they do one normal sign-in and still get claimed. This is still strictly better than today (no wizard, no manual token handling).
- Preview/dev without `RESEND_API_KEY` or the service role: `generateLink` needs the service role (present via `getServiceClient()`); if email send is unavailable the route already swallows send errors and still returns a usable `link`. Keep that resilience.

---

## 5. Acceptance criteria

1. Inviting a rider WITH an email sends one email whose primary CTA is a magic link. Clicking it lands the invitee authenticated on their own profile timeline (no onboarding wizard, no SaveStep, no second email).
2. On that arrival the inviter's `rode_with` claim points at the new account, and the profile shows the invited display name (not an email-derived placeholder).
3. The invitee sees the "your history is already here" `ClaimWelcomeOverlay` once (not the generic welcome, and not both).
4. Inviting a rider WITHOUT an email is unchanged: the inviter gets a copyable `/claim/[token]` link, and that path still runs onboarding and SaveStep.
5. An expired invite magic link bounces to `/auth/signin?error=link_expired`; a subsequent normal sign-in with the invited email still folds the ghost in.
6. `generateLink` failure falls back to sending the plain `/claim/[token]` link; the invite still works.
7. `npx tsc --noEmit` clean.

---

## 6. Out of scope

- The `/claim/[token]` page UI, the onboarding wizard, and `SaveStep` internals (all unchanged).
- The PR #138 admin email-first path, public tag-to-claim, and OAuth sign-in (untouched).
- Any migration or schema change (none: uses existing `invites.email`, `people.invite_email`, and the auth API).
- A trimmed invited-capture step (D1 alternative) and a "use a different account" hatch (D5): future, if wanted.

---

## 7. Pre-flight SQL

None. No migration this session.

---

## 8. Data-quality questions for Jay (answer before or at build start)

- **Q1 (magic-link expiry).** Supabase magic links expire per the project's Auth OTP setting (commonly ~1 hour by default), NOT the "7 days" the current invite email copy states. Confirm the configured OTP expiry in the Supabase dashboard so the email copy is honest. Recommendation stands regardless (D3 fallback link + §4 degradation cover late clicks); this only affects the wording.
- **Q2 (welcome moment).** Confirm `claim_welcome_pending` + `ClaimWelcomeOverlay` is the right arrival for a per-profile invitee (it is the PR #153 T2 invited-arrival moment). Default yes.
- **Q3 (skip wizard).** Confirm D1: email invitees skip the onboarding wizard and land on their profile. Default yes.

---

## 9. Suggested order

1. 3a route change (magic link + fallback + copy) behind the existing email-present branch.
2. 3b welcome-moment capture in `/auth/complete`.
3. Smoke: invite a plus-aliased Gmail with an email set, open the magic link in a fresh browser context (new profile/incognito to mimic the email round-trip), confirm authenticated landing + folded claim + single `ClaimWelcomeOverlay`. Then invite with NO email and confirm the copy-link path still runs onboarding + SaveStep. (Plus-aliased Gmails work for distinct test accounts; magic-link verification opens in the same context you launch it from.)
4. `npx tsc --noEmit`, then the standard Ship sequence.

---

## 10. Notes / provenance

- Verified files: `src/app/api/invite/route.ts`, `src/app/claim/[token]/page.tsx`, `src/components/onboarding/onboarding-flow.tsx`, `src/components/onboarding/save-step.tsx`, `src/app/auth/complete/page.tsx`, `src/app/api/invite/claim/route.ts`, `src/lib/node-invite.ts`, `src/app/api/admin/invite-node/route.ts`.
- Reuses the PR #138 magic-link pattern (`applyNodeInvite`) and the PR #153 T2 `ClaimWelcomeOverlay`.
- Cross-listed: BUG-132 in `bugs/bug-triage.md`.
