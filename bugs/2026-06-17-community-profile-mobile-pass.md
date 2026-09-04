# Bug-fix brief: community + profile mobile pass (BUG-070, BUG-072, BUG-069)

> Auto-drafted by the June 17 PM daily triage from three June 17 reports (Cory, R1, iPhone Safari). Two screenshots reviewed.
> One PR. Name BUG-070, BUG-072, BUG-069 in the PR title. HUMAN-RUN recommended: BUG-070 + BUG-072 are clean and auto-merge-safe, but BUG-069 is diagnosis-first on shared nav state, so run the cluster as a human session.

## Goal
Fix three community/profile-surface defects on mobile: an auth-unaware player CTA, a dead "Add photo" placeholder on claim cards, and the community nav header disappearing after a visit to the membership page.

## DECISIONS (review before building; defaults are build-ready)
- **D1 (BUG-070): final-slide CTA label.** Default: make the community timeline player's final-slide CTA auth-aware: "My Timeline" (or "Go to your timeline") when signed in, "Start Your Timeline" when anonymous. The destination is already auth-aware; only the label changes. Alternative: keep one label but reword it neutrally ("Open your timeline").
- **D2 (BUG-072): the dead "Add photo" placeholder.** Default: REMOVE the non-functional "Add photo" placeholder on timeline claim cards (claims have no per-claim photo-upload flow; photos attach to stories/boards/places). Alternative: wire it to a real upload flow (larger, a feature, out of scope for this pass).

## Scope + verified suspected files (grepped against the live repo June 17)

### BUG-070 (P2): player final-slide CTA not auth-aware  [screenshot reviewed]
- Symptom: after playing the community timeline, the last slide (9/9) shows "Start Your Timeline" even though the viewer is signed in and already has a timeline. Screenshot `19ed4286f663f8ab__0__bug-screenshot.jpg`.
- Files: the CTA label is hardcoded at `src/components/ui/timeline-player.tsx` line ~166 (`cta: onStart ? { label: "Start Your Timeline", onClick: onStart } : undefined`). The community wrapper `src/components/ui/community-timeline-player.tsx` already routes auth-aware (line ~20 `isAuth = isAuthUser(activePersonId)`, line ~26 `router.push(isAuth ? \`/${activeCommunitySlug}/profile\` : "/onboarding")`). So only the label misleads.
- Fix: thread an auth-aware label (or the `isAuth` flag) from the community player into `timeline-player.tsx` so the final-slide CTA text reflects the viewer's state. Confirm the personal `timeline-player` usage (`profile/page.tsx`) is unaffected.
- Acceptance: signed-in member sees a "My Timeline"-style CTA; anonymous sees "Start Your Timeline"; destination unchanged.

### BUG-072 (P2): dead "Add photo" placeholder on claim cards  [screenshot reviewed]
- Symptom: a location/claim card in the timeline shows an "Add photo" area that does nothing when tapped. Screenshots `19ed43021b6b727f__0__bug-screenshot.jpg` (a RODE AT resort card) and `19ed3dee0561e883__0__bug-screenshot.jpg` (rider cards).
- Files: `src/components/feed/post-card.tsx` line ~507: when `isOwn` and there is no image it renders `<div className="...border-dashed..."><span className="text-[10px] text-muted ...">Add<br/>photo</span></div>` with NO `onClick` and NO file input. Purely decorative, but looks tappable.
- Fix (default = remove): drop the dead "Add photo" placeholder branch (the `isOwn` no-image case) so it renders nothing (or a non-interactive state) rather than a fake button. Leave no layout gap. Confirm this is the only place the placeholder appears (the events page line ~410 `+ Add photo` is the real event-image upload and is out of scope).
- Acceptance: timeline claim cards no longer show a non-functional "Add photo" affordance; no layout gap.

### BUG-069 (P2): community nav header disappears on the membership page  [diagnosis-first]
- Symptom: entering `/account/membership` makes the community header rows (lens row "Community / Feed / My Timeline" + category row) go away; tapping "My Timeline" does not bring them back; tapping another header button like "Community" and navigating back restores them.
- Diagnosis-first: `/account/membership` lives OUTSIDE the `(community)/[community]` route group, so the community nav chrome is not rendered there. Trace `src/components/ui/nav.tsx`: how it decides to show the community rows (route-derived active community slug vs store `activeCommunitySlug`), and why returning toward My Timeline does not restore them without a separate Community tap. Lead hypothesis: the active-community context is cleared (or not re-derived) when on `/account/membership`, and the "My Timeline" link path does not re-trigger the community-route render that repopulates it.
- Fix direction (after diagnosis): ensure the community nav rows render whenever the destination is a community route (derive from the target route, not stale store state), so returning via "My Timeline" restores the header in one tap. Touches shared nav state, so review carefully.
- Acceptance: returning from the membership page to a community surface (including via "My Timeline") restores the community header rows without a separate Community tap; desktop unaffected.

## Suggested order
1. BUG-072 (delete the dead placeholder branch; smallest, self-contained).
2. BUG-070 (thread the auth-aware CTA label; verify personal player unchanged).
3. BUG-069 (diagnose nav state, then the minimal fix; re-test the membership -> My Timeline round trip on mobile).

## Notes
No migration, no write path. BUG-070 + BUG-072 are auto-merge-safe; BUG-069 touches shared nav state so run the cluster human-reviewed. `npx tsc --noEmit` clean before commit. One PR, BUG-070 + BUG-072 + BUG-069 in the title. Append a `status: pending` SHIP-LOG entry naming all three. No em dashes anywhere (including any new UI copy).
