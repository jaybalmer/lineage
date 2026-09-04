# BUG-179: your own timeline flips into the anonymous public view and asks you to claim your own profile

**Drafted:** September 1, 2026 (daily triage, auto-drafted)
**Scope:** BUG-179 (P1)
**Verified against:** `f6ec7f8` (tip of `main`, PR #211)
**Session type:** HUMAN-RUN / ATTENDED. Auth-adjacent, excluded from auto-merge.
**Estimate:** 30 to 45 min diagnosis, then 1 to 2 hr build. One PR.
**Migration:** none expected. This is client-side render gating.

---

## 0. Goal

A signed-in member on their own timeline must never be shown the read-only stranger view of themselves, and must never be offered a CTA to claim their own profile. Today they can be, and at least one member hit it in a live session.

---

## 1. DECISIONS (review before building)

**D1. How to close the hydration window.**
- **Recommended default:** hold the existing loading state until BOTH `catalogLoaded` and `authReady` are true, rather than gating the owner branch on `catalogLoaded` alone. One line moves, and it matches the rule the repo `CLAUDE.md` already states ("wait for this before auth-gating UI") and the pattern `OwnerTimelinePanel` itself already follows at line 289.
- Alternative: leave the page rendering during the window but suppress only the claim CTAs until `authReady`. Cheaper visually, but it leaves the owner looking at the stranger view of their own timeline for the same window, which is most of the complaint.

**D2. What to do when `getUser()` comes back empty mid-session.**
- **Recommended default:** stop treating an empty `getUser()` read as a sign-out. In `catalog-loader.tsx` the `if (!uid)` branch should only blank `activePersonId` when it can distinguish "no session" from "could not read the session right now". Keep the existing clear for the genuine case; for a thrown or network-failed read, leave `activePersonId` alone and still set `authReady` so the app is not stuck. The `SIGNED_OUT` event path (line 163) already exists and is the correct authority for an actual sign-out.
- Alternative: leave the loader alone and defend only at the render site (D3). Smaller blast radius, but the same blanked `activePersonId` will keep surfacing as other identity oddities elsewhere, and BUG-168 is recent evidence that this store value is load-bearing well beyond this page.

**D3. Belt-and-braces on the claim CTAs.**
- **Recommended default:** yes, add it. Neither `showThisIsMe` (line 268) nor `showThatsMeAnon` (line 281) should be able to render on a node whose id equals the viewer's, or on a node that has a bound account, independent of whatever `activePersonId` currently says. `isInvitablePerson(person)` already encodes the bound-account idea for invites; the claim CTAs deliberately do not use it (see the comment at line 277), and that decision is worth keeping for genuine ghosts but not for a node that is already a member.
- Alternative: rely on D1 plus D2 only. Fewer moving parts, but nothing then prevents the next identity regression from re-rendering this exact CTA.

**D4. Copy.** No copy change proposed. If the session finds itself rewording "Is this you?", that is a sign the scope drifted.

---

## 2. Report

- Reported August 31, 2026 at 20:38 UTC by `OWNER` via the in-app widget. Flagged "Urgent".
- Verbatim: "Urgent - not sure how I got into this sate of being asked to claim my profile. I think I was on my timeline, and then pressed the button to Create A Story."
- URL: `https://linestry.com/people/315a92ff-acef-404d-ae20-b6b3eb01f8ea`
- Desktop, 1851x936, macOS Chrome 150.
- Session replay: PostHog `S-49`
- No screenshot. A Drive search of "Linestry Bug Attachments" for message id `1a0598bb3e48245d` returned nothing.

---

## 3. Verified facts

Every line below was read out of the tree at `f6ec7f8`. Line numbers are from that tip; re-grep rather than trusting them if the file has moved.

1. `/people/<uuid>` is the owner's own timeline URL, not just a public profile. `src/app/people/[id]/page.tsx:217` returns `<OwnerTimelinePanel />` when `isAuthUser(activePersonId) && resolvedId === activePersonId`. The comment above it names this URL as the redirect target from `/me/timeline` and `/{community}/profile`.
2. That branch has no auth-readiness gate. `authReady` does not appear anywhere in `src/app/people/[id]/page.tsx`. The only hold on the page is `if (!catalogLoaded)` at line ~203, which returns the BrandMark spinner.
3. `authReady` exists for exactly this purpose and is used in 17 other files, including `OwnerTimelinePanel` itself (`src/components/profile/owner-timeline-panel.tsx:289`, `if (!authReady) return` before it decides whether to bounce a non-member to `/people`).
4. When the owner branch is not taken, the page computes `const isCurrentUser = resolvedId === activePersonId` (line ~226) and renders the public read-only view.
5. `showThisIsMe` (line 268) requires `isAuth && !isCurrentUser && nodeIsClaimable && !userHasOpenClaim(...)`. It renders the blue "Is this you? Claim this profile to add your timeline..." panel at line 486, and a "This is me →" button at line 456.
6. `showThatsMeAnon` (line 281) requires `!isAuth && !isCurrentUser && nodeIsClaimable`. It renders the "Is this you? Claim this profile with your email..." panel at line 509. Note the polarity: when `activePersonId` is empty, `isAuth` is false, so this branch turns ON rather than off.
7. `nodeIsClaimable` is `person.node_status === "catalog" || person.node_status === "unclaimed"` (line 267). It is a property of the viewed record only; it does not consult the viewer at all.
8. `src/components/catalog-loader.tsx:118-135`: when `supabase.auth.getUser()` yields no uid, the loader calls `setActivePersonId("")`, `setProfileOverride({})` and `setAuthReady(true)`. The surrounding comment treats this as "genuinely no valid session (refresh token also gone or invalid)", which is the intent, but the code path is reached for any empty read.
9. `catalog-loader.tsx:154-163` documents that `SIGNED_OUT` is deliberately the only event that clears auth state in the listener, and that `INITIAL_SESSION` with null is deliberately ignored because it fires before the refresh token is used. The `if (!uid)` branch at 121 is a separate path and does not share that caution.
10. `activePersonId` IS persisted to localStorage (`lineage-store-v2`); the store's `partialize` at `src/store/lineage-store.ts:1129-1130` strips `authReady`, `catalog`, `catalogLoaded` and `dbClaims` but keeps `activePersonId`. So it survives a reload, and any first-render window is short. That is why mechanism 2 below is the better fit for a mid-session flip.
11. `setActivePersonId` also stamps `storeOwnerId` (BUG-168, `lineage-store.ts:998-1001`), and `loadProfileAndMembership` calls `resetPerUserState()` on a stamp mismatch (`catalog-loader.tsx:16-17`).

---

## 4. The two mechanisms

Both are real. The session's first job is to find out which one fired.

**Mechanism 1, cold-load race.** On a fresh load of `/people/<own-uuid>`, `catalogLoaded` can flip true before auth resolves. The page then takes the public branch with `activePersonId` still empty, `isAuth` false, `isCurrentUser` false, and renders the anonymous claim panel (fact 6). Closed by D1.

**Mechanism 2, mid-session demotion.** At any point in the session, a `getUser()` read that comes back empty causes the loader to blank `activePersonId` and mark auth ready (fact 8). On this URL that instantly swaps the owner's timeline for the stranger view plus the anonymous claim CTA, and it persists until a reload. This matches the reporter's account ("I was on my timeline, and then pressed the button") better than a cold load does. Closed by D2.

**The third possibility, which the diagnosis must rule out.** If the replay shows the SIGNED-IN CTA ("This is me →", the filled blue button at line 456) rather than the anonymous email one, then `activePersonId` was a valid auth id that simply was not `315a92ff-acef-404d-ae20-b6b3eb01f8ea`. That is a different bug: an identity mismatch, most likely a second account or a duplicate person node, and it should be re-triaged rather than fixed with D1 and D2. Say so in the PR if that is what the replay shows.

---

## 5. Suggested order

1. **Diagnose first (do not skip).** Open PostHog replay `S-49`. Establish: (a) which claim panel rendered, the anonymous one or the signed-in one; (b) whether the page had just loaded or had been open; (c) whether a network request failed around the moment of the flip. If it was the signed-in panel, stop and re-triage per section 4.
2. Confirm in the database whether `315a92ff-acef-404d-ae20-b6b3eb01f8ea` is a `profiles` row with a bound account, and what its `node_status` is in `people`. A member's own node should not satisfy `nodeIsClaimable` at all. If it does, that is a data-side finding worth recording in the PR even though the render fix stands on its own.
3. Apply D1 in `src/app/people/[id]/page.tsx`: hold the loading state until `authReady` as well as `catalogLoaded`, above the owner-branch return at line 217.
4. Apply D2 in `src/components/catalog-loader.tsx`: narrow the `if (!uid)` clear so a failed read does not blank a live identity. Leave the `SIGNED_OUT` path alone.
5. Apply D3: guard both `showThisIsMe` and `showThatsMeAnon` so neither can render for a node that is the viewer or that has a bound account.
6. `npx tsc --noEmit` clean.
7. Manual check, all four: signed-in owner cold-loads `/people/<own-uuid>` and sees only their own timeline, with no claim CTA at any point during load; signed-in owner presses Add story from that page and stays in owner mode; signed-out visitor on a genuine unclaimed ghost still gets the "That's me" email path; signed-in member on a genuine unclaimed ghost still gets "This is me →". Items 3 and 4 of that list are the regression risk, do not skip them.

---

## 6. Acceptance criteria

- A signed-in member on `/people/<their own uuid>` sees `OwnerTimelinePanel` and nothing else, from first paint, with no flash of the public view.
- No claim CTA of either kind can render on a node that is the viewer, or on a node with a bound account, regardless of the current value of `activePersonId`.
- A transient failed `getUser()` read does not sign the user out of the UI. An actual `SIGNED_OUT` event still does.
- The genuine ghost-claim paths both still work: anonymous "That's me" email claim, and signed-in "This is me →" into `ClaimRequestModal`.
- `npx tsc --noEmit` clean.
- No migration. If step 2 turns up a data anomaly on that person row, report it in the PR rather than fixing it inline; a `people.node_status` correction on a live member is GATED.

---

## 7. Housekeeping

- Name **BUG-179** in the PR title or commit message. The daily reconcile keys on it.
- Append a `bugs/SHIP-LOG.md` entry per the schema at the top of that file: `type: bugfix`, `ids: BUG-179`, `migration: none`, `status:` per the Ship sequence.
- Do not edit the Shipped section of `bugs/bug-triage.md`. The reconcile handles it.
- No em dashes anywhere.
- **Before you start:** the working tree may still hold the uncommitted BUG-177 / BUG-178 badge diff across nine files. None of them is `people/[id]/page.tsx` or `catalog-loader.tsx`, so the work does not collide, but do not sweep those files into this PR. Commit and ship that cluster first if it is still sitting there.
