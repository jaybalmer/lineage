# Bug-fix brief: make the Stack manage surface findable from the owner's own timeline

**Date drafted:** August 17, 2026 (daily triage)
**Scope:** BUG-160
**Shape:** client-only, no migration, no API change. PIPELINE-SAFE (auto-merge eligible on the defaults below).
**Estimated size:** 30 to 60 minutes.

---

## Goal

A member who has a public Stack has no way to reach the surface that edits it from anywhere they naturally are. Give the owner an "Edit my Stack" affordance on their own profile page, and give `/me/public-view` a tab in the `/me` sub-nav so it stops being an orphan route.

---

## DECISIONS (review before building)

**D1. Where the affordance sits on the owner's profile.**
- **Recommended default:** next to the existing Stack / Timeline toggle in the top row of `owner-timeline-panel.tsx`, as a small text link reading **Edit my Stack** that routes to `/me/public-view`. Owner-only by construction (that component only renders on the owner's own profile).
- Alternative: put it inside the RiderCard action row beside "Share". Rejected as the default because that row is about sharing the timeline, not curating the Stack.

**D2. Copy.**
- **Recommended default:** `Edit my Stack`. Jay's report suggested "Edit My Stack"; sentence case matches the rest of the app's link copy.
- Alternative: `Curate Stack`, `Manage Stack`.

**D3. What shows when the owner has no public Stack enabled yet.**
- **Recommended default:** still show the link, labelled **Set up my Stack**, routing to the same `/me/public-view`. The manage surface already handles the not-enabled case (it saves the stack and toasts "Turn on your public timeline to share it"), so this is a valid entry point either way, and it is the only discovery path a member would ever find.
- Alternative: hide it until `public_timeline_enabled` is true. Rejected: that is the current behaviour and is exactly what makes the surface undiscoverable.

**D4. Sub-nav tab.**
- **Recommended default:** add `{ href: "/me/public-view", label: "Public view" }` to `ITEMS` in `me-subnav.tsx`, positioned immediately before the existing `Public timeline` entry.
- Alternative: leave the sub-nav alone and rely on D1 only. Rejected: `/me/public-view` renders `MeSubNav` on every load but has no tab of its own, so the active-tab logic never matches and the page looks like it belongs to nothing.

**Out of scope (explicitly not this session):** turning the public Stack ON by default for every member. Jay's report also suggested that. It is a public-surface privacy call plus a backfill `UPDATE` across existing `profiles` rows (a GATED migration under the risk gate), so it is flagged in the triage queue as a Jay decision, not folded in here. Do not enable anything by default in this PR.

---

## Verified facts (grepped against the live repo, August 17)

1. `/me/public-view` is linked from **exactly one place in the entire app**: `src/app/me/settings/public-timeline/page.tsx:141`. Verified with `grep -rn "/me/public-view" src --include=*.tsx`. Nothing on the profile, nothing in the nav, nothing in the avatar dropdown.
2. `src/components/ui/me-subnav.tsx` `ITEMS` (lines 8 to 15) lists six routes: `/me/tags`, `/me/settings/notifications`, `/me/settings/tag-privacy`, `/me/settings/public-timeline`, `/me/settings/trust`, `/me/settings/blocks`. `/me/public-view` is **not** among them, yet `src/app/me/public-view/page.tsx` renders `<MeSubNav />` on every branch (loading, signed-out, and main).
3. The owner's profile top row is `src/components/profile/owner-timeline-panel.tsx` lines ~728 to 742: a `flex items-center justify-between gap-3 mb-6` wrapper holding the Riders breadcrumb on the left and, when `publicTimeline?.enabled && publicTimeline.slug`, a `<StackTimelineToggle active="timeline" stackHref={`/t/${publicTimeline.slug}`} variant="light" />` on the right. This is the insertion point for D1.
4. `publicTimeline` state on that component is set at `owner-timeline-panel.tsx:377-378` from a `profiles` read of `public_timeline_enabled` and `public_slug`, so both the enabled and not-enabled cases are already known client-side at render time. No new fetch is needed for D3.
5. The public (non-owner) profile has the mirrored block at `src/app/people/[id]/page.tsx:293-300`. **Do not add the owner link there.** That file renders for visitors; the owner path returns `<OwnerTimelinePanel/>` earlier (`people/[id]/page.tsx:209`).
6. `StackTimelineToggle` (`src/components/public-timeline/stack-timeline-toggle.tsx`) takes only `active`, `stackHref`, `timelineHref`, `variant`. It has no slot for an extra action, so the new link is a sibling in the wrapper, not a prop on the toggle.
7. `/me/public-view` already gates itself: it returns "Sign in to manage your public view." for a non-auth user (`page.tsx:344`). No new auth gate is needed on the link target.

---

## Acceptance criteria

**BUG-160**
- [ ] A signed-in member viewing their own profile sees an "Edit my Stack" link in the top row beside the Stack / Timeline toggle, and it navigates to `/me/public-view`.
- [ ] A member who has **not** enabled a public timeline sees the same link labelled "Set up my Stack" (per D3) and it navigates to the same route.
- [ ] Viewing **another** member's profile shows no such link (verify on `/people/cy_1` while signed in as someone else, and while signed out).
- [ ] `/me/public-view` shows an active tab in the `/me` sub-nav, and the sub-nav's centre-the-active-tab effect scrolls it into view at 414px width.
- [ ] The existing link at `/me/settings/public-timeline` still works.
- [ ] Nothing is enabled by default; `public_timeline_enabled` is not written anywhere in this PR.
- [ ] `npx tsc --noEmit` clean.
- [ ] No layout regression in the top row at 414px (the breadcrumb, the new link, and the toggle must not push the toggle off-screen; wrap or shrink the breadcrumb rather than the toggle).

---

## Suggested order

1. `me-subnav.tsx`: add the `/me/public-view` item (D4). Smallest change, independently verifiable.
2. `owner-timeline-panel.tsx`: add the owner link beside the toggle, with the enabled / not-enabled label split (D1, D2, D3). Note the toggle currently renders **only** when enabled, so the not-enabled branch needs the link rendered outside that condition.
3. Check the 414px top row. The breadcrumb is `text-xs text-muted`; if the row crowds, let the breadcrumb truncate rather than shrinking the toggle.
4. `npx tsc --noEmit`, then push, open the PR, and run the Ship sequence.

---

## Migration

**No migration this session.** Nothing in this change touches the database, a `_public` view, auth, payments, or memberships.

---

## Wrap-up

- Name **BUG-160** in the PR title or commit message. The next morning's triage reconcile reads that id to close the loop.
- Append one entry to `bugs/SHIP-LOG.md` using the schema at the top of that file: `type: bugfix`, `ids: BUG-160`, `migration: none`, `status: merged` once the PR is merged in-session.
- Do not edit the Shipped section of `bugs/bug-triage.md`; Cowork reconciles it.
- No em dashes anywhere you write, including any UI copy.
