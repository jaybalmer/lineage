# BUG-179 resolution + follow-ups: duplicate-person creation

**Session:** September 6, 2026. HUMAN-RUN / ATTENDED (auth-adjacent).
**Outcome:** BUG-179 diagnosed and the specific incident resolved by data cleanup. No code change. Two follow-ups spun out below.

---

## What BUG-179 actually was

Not the render race the brief hypothesised (mechanisms 1 and 2). It was section 4's **third possibility: an identity mismatch.**

- Reporter URL `/people/315a92ff-acef-404d-ae20-b6b3eb01f8ea` pointed at a **duplicate, empty, unclaimed "Jay Balmer" ghost** node, not the owner's own timeline.
- Owner's real account is `0394914d-6ffd-4a18-aa1f-1aafee7ce53a` (profiles row, 55 claims, 35 stories), intact throughout. `activePersonId` was never blanked.
- Because the ghost was a genuine unclaimed node that was not the viewer's own id, the page correctly (by current rules) offered the signed-in "This is me -> Claim this profile" CTA. D1/D2/D3 would not have prevented this, and the ghost being neither the viewer nor a bound account means D3 as written would not have suppressed the CTA either.
- The ghost was created **2026-08-31 00:09 UTC** by member `R5` (`d644c90b`), who had signed up 2.5 minutes earlier at 00:06:38. A brand-new member created a "Jay Balmer" node instead of matching the existing member.

**Cleanup applied this session (GATED, approved by Jay):** hard-deleted people row `315a92ff...`. Verified contentless first: 0 claims, 0 story tags, and 0 references across all 25 person-linking columns. Post-delete there are no remaining duplicate display_names inside `people`.

---

## FOLLOW-UP 1 (systemic, design pass): the app lets users create a duplicate node for an existing member

**Root cause, from prod:** **all 18 members (profiles rows) have zero rows in `people`.** Members exist only as profiles and are folded into the catalog client-side. Any person search that is backed by the `people` table (onboarding, and any server-side rider lookup before the client catalog is merged) therefore cannot surface an existing member, so the user adds a new ghost with the member's name.

This is the thing the design pass must fix. Open questions for the pass:
- Where do the person-add / rider-tag / onboarding "who do you ride with" flows get their search results, the `people` table (server) or the merged client catalog? The bug implies at least one high-traffic path queries a source that excludes members. Confirm each entry point.
- Should members get a real `people` row on signup (so they are searchable and taggable everywhere by one id), or should every person search union `profiles` into its results? The first is a bigger data change but removes the whole class of "member is invisible to search"; the second is lighter but must be applied at every call site.
- Dedupe on create: when a user tries to add a person whose name matches an existing member or an existing node, warn and offer the existing one instead of silently creating a duplicate.

**Second live instance already in the data (do NOT auto-clean, this one is a MERGE):** member **"Todd Bowman"** has a duplicate unclaimed people node `b7bccfdc-3d78-4a86-8551-c7577d0d9f6a`, created by Jay on 2026-06-18, carrying **2 claims and 2 story tags**. Unlike the Jay ghost this one has content, so it must be merged into Todd's real account, not deleted. That merge is GATED (identity + content repoint across a live member). Hold for the design pass so the merge is done with the same tool/flow the pass produces.

## FOLLOW-UP 2 (routing, needs replay): how "Create A Story" landed the owner on the ghost page

The reporter pressed "Create A Story" from what he believed was his own timeline and ended up on `/people/315a92ff` (the ghost). The click path is only visible in PostHog replay `S-49`. Establish whether an add-story / rider-search affordance linked to the ghost, or whether he had navigated there earlier. This is separate from Follow-up 1 and smaller.

---

## Ship record

- BUG-179: resolved via data cleanup (ghost deleted). No PR, no code change, no migration file.
- Follow-ups 1 and 2 above are re-triaged, not fixed here.
- SHIP-LOG entry appended for the cleanup.

---

## Design pass drafted (September 6, 2026, Cowork)

Follow-up 1 is now covered by **`features/duplicate-person-prevention-brief.md`**. Two things in that brief change the picture above and should be read before building:

1. **The stated root cause is only half verified.** `loadCatalog()` already unions `profiles` into `catalog.people`, and all nine user-facing person searches read that merged array, not the `people` table. Whether members are actually invisible depends on one unrun query: whether the anon key can SELECT `profiles` under RLS. The brief opens with that fork.
2. **A merge tool already exists.** `public.merge_person()` does the whole job but is claim-request-driven and assumes a `people` canonical row, so it cannot fold the Todd node into a `profiles` account. It was written 2026-05-11 and never updated, so it is about four months behind the schema (six text person-id columns added since May 2026 are un-repointed), and `promoteGhostToAccount()` repoints only 4 of its 18 targets. The Todd merge is held until that is fixed, per the brief's §5.

---

## IMPLEMENTED + CLOSED (September 6, 2026)

Follow-up 1 is fully built and BUG-179 is closed. All phases of `features/duplicate-person-prevention-brief.md` shipped this session, plus both §9.2 decisions:

- **Phase 1** (PR #227): `SearchPicker` gains a `loading` prop; the rider pickers (add-story, add-connections, add-person-connections, mention-editor) and the event-page inline rider search gate on `catalogLoaded`, so an unresolved catalog can no longer funnel a user into creating a duplicate out of an empty list.
- **Phase 2** (PR #228): near-match warning in `AddEntityModal` (person branch) matching `catalog.people` in `nameToSlug` space, members ranked first, "Use this one" vs "Add anyway"; event-page create routed through `AddEntityModal`; `person_search` view (profiles + people) applied to prod.
- **Phase 3** (PR #229 migration, #230 refold, #231 admin panel): `merge_person_into` RPC (folds a ghost into a people OR profiles canonical, full 20-column repoint list, dry-run mode); `merge_person` delegates to it; `promoteGhostToAccount` + `/api/invite/claim` refolded onto it (closes Defect 2, the 4-of-20 data loss); `/admin/claims` self-serve merge panel + `POST /api/admin/merge-person` + `GET /api/admin/person-search`.
- **Phase 4** (data op): the **Todd Bowman** duplicate (`b7bccfdc`) merged into his member profile (`d644c90b`) via `merge_person_into` (dry-run reviewed, then committed); verified ghost gone, references moved, one Todd Bowman in `person_search`.
- **§9.2** (RUN-LOG): swept previously-promoted ghosts, found 16 orphaned references the old path had dropped (Jay Balmer's absorbed ghost ×14, John Stewart's ×2), and repaired them (GATED, approved) onto the canonicals; re-swept to 0. No residual repair brief needed.

**Follow-up 2** (how "Create A Story" routed the reporter onto the ghost page, PostHog replay `S-49`) is unaffected by this work and remains open and separate.
