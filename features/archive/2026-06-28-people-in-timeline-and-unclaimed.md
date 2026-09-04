# Claude Code Handoff Brief: People In Your Timeline + Unclaimed Rider Job (Batches C + B)

> Drafted June 15, 2026. Source: `Product/Page-Spec-and-Affordances.md`, punch-list batches C and B, built together because both touch the same two pages (My Timeline and `/people`). Batch A (equity surfacing) is shipped.
>
> **Goal:** make the people graph feel alive and make connecting unclaimed riders a visible job. The data already exists (rode_with claims, node_status). Nothing here needs new tables, routes, or migrations. This is one feature build: a new strip component on My Timeline, two enhancements to the rider list, a sparse-ghost empty state, and one small modal prop addition.

---

## 0. Size and shape

Medium session. Estimated 3 to 5 hr. No database changes, no new API routes, no migration. New client component plus edits to three existing client pages and one modal prop. Reads existing `claims_public` and catalog data already loaded on these pages.

Suggest one PR, but it splits cleanly into two if it runs long (see §8). `npx tsc --noEmit` clean before commit.

---

## 1. Prerequisites

- Pull `main` (equity-surfacing PR should be merged first; it touches the same profile page block, so rebase if needed).
- `npm run dev` runs from the repo root (`~/lineage`). Smoke at the dev URL it prints.
- Read these three files whole before editing: `src/app/(community)/[community]/profile/page.tsx`, `src/app/people/page.tsx`, `src/app/people/[id]/page.tsx`.

---

## 2. Verified facts (checked against current source)

1. **rode_with reads.** Claims are `subject_id -> predicate -> object_id`. The predicate is the literal string `"rode_with"`. The riders you have logged riding with are exactly:
   ```
   allClaims.filter(c => c.subject_id === activePersonId && c.predicate === "rode_with").map(c => c.object_id)
   ```
   This is already computed on `/people` as `myRiderIds` (a `Set<string>`, `src/app/people/page.tsx` ~line 201). Reuse this shape on both pages.
2. **Resolve a rider id to a person:** `catalog.people.find(p => p.id === object_id)`. For links use `personHref(person, people)` / `personHrefById(id, people)` from `src/lib/entity-links.ts`.
3. **node_status** on a Person is `"catalog" | "unclaimed" | "claimed" | "verified"` (`src/types/index.ts`). A rider is unclaimed / invitable when `isInvitableNodeStatus(node_status)` is true, which is `node_status === "catalog" || node_status === "unclaimed"` (`src/lib/invite-tracking.ts`). Tier mapping is `getRiderTier()` in `src/components/ui/rider-avatar.tsx`.
4. **My Timeline page** `src/app/(community)/[community]/profile/page.tsx` is a client component. It shows the authenticated viewer's own profile (no `[id]` segment; guarded by `isAuthUser(activePersonId)`). It has the viewer's claims in scope as `personClaims` / `allClaims`, and `catalog.people` for lookups. Layout order today: RiderCard, then an existing `BulkInvitePrompt`, then `FeedView`. The new strip slots between RiderCard and FeedView.
5. **BulkInvitePrompt already exists** on the profile page (it bulk-invites unclaimed riders on your timeline by email). Do NOT remove it in this build. The new strip is a different, always-on surface. See §4 for how they coexist, and the known firing bug in §5.
6. **Connection page** is community-scoped at `/[community]/connections/[id]`, where `[id]` is the OTHER person; the page derives the viewer automatically. Link to it with `<CommunityLink href={`/connections/${riderId}`}>`, exactly as `src/app/people/[id]/page.tsx` already does for "View connection". `CommunityLink` uses the active community slug from the store and works from `/people` too.
7. **`/people`** (`src/app/people/page.tsx`) is a top-level route, community-filtered via `activeCommunitySlug` (global with `?community=all`). It already holds `myRiderIds`, the `myOnly` filter (state `myOnly`), the `query` search, and the `sort` tab state (`all | entries | origin | riders | resort`). The per-row Invite button is already gated by `isInvitableNodeStatus`. A "Unclaimed Profiles" section label already exists in the grouped view, but there is no dedicated unclaimed filter.
8. **AddStoryModal** (`src/components/ui/add-story-modal.tsx`) `defaults` prop supports `linkedPlaceId | linkedEventId | linkedOrgId | boardId` only. It does NOT support pre-selecting a rider today. `selectedRiderIds` initialises from `editStory?.rider_ids ?? []`. You will add `riderIds?: string[]` to the defaults prop (see C-2).
9. **Compare** (`src/app/compare/page.tsx`) ALREADY seeds Person A to the logged-in viewer (`currentUser` from `activePersonId`) and supports `?b={id}` for Person B. So punch-list item C12 (pre-seed Compare) is already done. Do NOT build it. Left here so you do not re-do it.
10. No `_public` view rebuild is needed: this build only reads `claims_public` and catalog people, it writes nothing.

---

## 3. Out of scope (do NOT build here)

- C12 Compare pre-seeding: already done (fact 9).
- Removing or rewriting `BulkInvitePrompt` (fact 5). Leave it. If §6 Q3 says the strip should supersede it, that is a follow-up, not this PR.
- Broadening the "connected to you" signal beyond `rode_with` (shared places/events scoring lives in `ConnectionSummary` and stays on the connection page itself).
- Any new claim/tag write path, any change to how `rode_with` claims are created, any moderation-pipeline change.
- Equity surfacing (batch A, shipped), connection-routing batch D, feed empty states batch E.

---

## 4. Scope: Batch C (people in your timeline)

### C-1. "People in your timeline" strip on My Timeline
New client component, for example `src/components/timeline/people-in-timeline.tsx`, rendered on the profile page only when viewing your own profile (always true on this route, but guard defensively). Place it between RiderCard and FeedView.

Behaviour:
- Compute the viewer's rode_with partners using the fact-2 shape against the claims already in scope on the page. Resolve each `object_id` to a `catalog.people` person; skip ids that do not resolve.
- Render each partner as a compact avatar + name row or chip. Each links to "See our connection" at `<CommunityLink href={`/connections/${riderId}`}>`.
- **Cap the strip at 6 partners** (most-recent first, ordered by the rode_with claim date when present). When the viewer has more than 6, show a "See all (N)" link to the rider list filtered to your riders (`/people` with the My Riders filter on). Decision locked, §6 Q1.
- Each partner also gets a single "Add a story" action that opens AddStoryModal pre-tagged with that rider (via the new `defaults.riderIds`, C-2). Story only: do NOT add a per-rider "log a ride" / AddClaimModal action. Logging new rode_with rides is handled by the Browse riders prompt, not per row. Decision locked, §6 Q4.
- **Unclaimed partners** (where `isInvitableNodeStatus(person.node_status)`) get a visible "Not on Linestry yet" marker and a "Help connect" link to their `/people/[id]` profile (where the existing Help Connect card lives). This is how batch B item 7 is delivered: the unclaimed riders on your timeline are surfaced inline rather than as a separate prompt.
- **Header prompt** above the partners: a one-line nudge plus a "Browse riders" button to `/people`. This is the action Jay called out: browse the People list to add the people you rode with, or add a story about them.
- **Empty state** (no rode_with partners yet): show the prompt only, pointing at `/people` and Add Story.

Proposed copy (edit freely, no em dashes):
- Header (with partners): "People in your timeline" + sub "The riders you have logged riding with. Browse the People list to add more, or write a story about a day you shared."
- Browse button: "Browse riders".
- See-all link (when more than 6 partners): "See all {N}".
- Per-partner links: "See our connection", "Add a story".
- Unclaimed marker: "Not on Linestry yet" + "Help connect".
- Empty state: "You have not linked anyone to your timeline yet. Browse the People list to add the riders you rode with, or write a story and tag who was there."

### C-2. AddStoryModal: support pre-tagging a rider
In `src/components/ui/add-story-modal.tsx`, add `riderIds?: string[]` to the `defaults` prop type, and initialise `selectedRiderIds` as `editStory?.rider_ids ?? defaults?.riderIds ?? []`. No other modal change. This lets the strip's "Add a story" open with the partner already tagged.

### C-3. `/people`: "connected to you" indicator
On `src/app/people/page.tsx`, for each rider row where `myRiderIds.has(person.id)`, show a small "You rode together" pill and a "See connection" link (`<CommunityLink href={`/connections/${person.id}`}>`). Reuse the existing `myRiderIds` set; no new computation. Do not show this on your own row.

---

## 5. Scope: Batch B (unclaimed rider job)

### B-1. `/people`: "Unclaimed" sort tab
Add "Unclaimed" as a sixth sort tab alongside All / Entries / Origin / Riders / Resort (extend the `SORT_TABS` array and the `SortTab` type at `src/app/people/page.tsx` ~line 20). When active, the list shows only riders where `isInvitableNodeStatus(person.node_status)` (catalog or unclaimed), grouped under the existing "Unclaimed Profiles" section label. It still composes with the `query` search and the separate `myOnly` "My Riders" filter, so "Unclaimed" + "My Riders" together yields "unclaimed riders I rode with", the exact connect-job slice. Keep the existing per-row Invite button as-is. Decision locked, §6 Q2 (chose a sort tab over a filter chip).

Suggested tab copy/title: `{ id: "unclaimed", label: "Unclaimed", title: "Riders not yet on Linestry" }`.

### B-2. `/people/[id]`: sparse-ghost empty state
On `src/app/people/[id]/page.tsx`, when the profile person is unclaimed (`isInvitableNodeStatus`) AND has no public claims/stories in the feed, render a "help fill this in" empty state inside the feed section (the unclaimed banner and Help Connect card above it already exist; this is the empty feed body, which today shows nothing). Reframe the blank as an invitation.

Proposed copy: "No entries yet. {name} is in the graph because another member mentioned them. If you rode with {name}, add a story or claim to help fill in their history." with a "Browse riders" or Add Story action as available to an authed viewer.

### B-3. (delivered in C-1) unclaimed riders on your timeline
The My Timeline unclaimed prompt (punch-list item 7) is delivered by the strip's inline "Not on Linestry yet" + "Help connect" treatment (C-1), not as a separate component. `BulkInvitePrompt` stays. See Q3.

**Known firing bug to respect:** `BulkInvitePrompt` / the invite prompt currently fires for rider tags even when the rider already has an account (pre-existing PB-008 ambient-growth bug, tracked separately in the spawn queue). Do not amplify it: the strip's "Help connect" must only show for riders where `isInvitableNodeStatus` is true, so claimed members never get a connect prompt.

---

## 6. Decisions (locked with Jay, June 15)

1. **Strip size: cap at 6**, most-recent first, with a "See all {N}" link to the rider list filtered to your riders. (C-1.)
2. **Unclaimed filter shape: a sixth sort tab** ("Unclaimed"), not a filter chip. It still composes with search and the My Riders filter. (B-1.)
3. **BulkInvitePrompt: keep both.** The strip ships alongside `BulkInvitePrompt`; no removal in this PR. Revisit with usage data later. (B-3.)
4. **Per-rider action: Story only.** "Add a story" opens AddStoryModal pre-tagged with that rider. No per-rider AddClaimModal / log-a-ride action; logging new rides is handled by the Browse riders prompt. (C-1.)

No open questions remain. The brief is ready for Jay's final review before handing to Code.

---

## 7. Acceptance criteria

1. `npx tsc --noEmit` clean.
2. On your own My Timeline, a "People in your timeline" strip lists up to 6 of your rode_with partners (most-recent first, "See all {N}" link when more than 6); each links to "See our connection" and offers a single "Add a story" that opens AddStoryModal with that rider already tagged. No per-rider log-a-ride action.
3. Unclaimed partners in the strip show "Not on Linestry yet" + "Help connect" to their profile; claimed members show no connect prompt.
4. With no rode_with partners, the strip shows the empty-state prompt pointing at `/people` and Add Story.
5. AddStoryModal accepts `defaults.riderIds` and pre-selects those riders; existing place/event/org/board defaults and edit mode are unchanged.
6. `/people` has a working "Unclaimed" sort tab (sixth tab) that shows only invitable nodes and still composes with search and the My Riders filter (so "Unclaimed" + "My Riders" yields unclaimed riders you rode with).
7. `/people` rows you have ridden with show a "You rode together" pill and a working "See connection" link; your own row does not.
8. A sparse unclaimed `/people/[id]` shows the "help fill this in" empty state in the feed body; a claimed or populated profile does not.
9. `BulkInvitePrompt` still renders and behaves as before (not removed).
10. No em dashes in any added string. 0px horizontal overflow at 375px on every touched page. No regression on `/compare`, `/people`, `/people/[id]`, or the profile feed.

---

## 8. Suggested order

1. C-2 AddStoryModal `riderIds` default (small, unblocks the strip's Add Story).
2. C-1 the strip on My Timeline (the headline; includes the unclaimed inline treatment, B-3).
3. C-3 the `/people` connected indicator and B-1 the `/people` unclaimed filter (same file, do together).
4. B-2 the `/people/[id]` ghost empty state.
5. tsc, smoke at 375px and desktop, screenshot My Timeline (with and without partners), `/people` (both new affordances), and a sparse ghost profile. One PR.

If it runs long, split: **PR 1** = C-2 + C-1 (profile strip). **PR 2** = C-3 + B-1 + B-2 (rider list + ghost empty state).

---

## 9. Ship log

Before ending, append one entry to `bugs/SHIP-LOG.md` per the schema at the top of that file (type: feature, PR number, branch, `status: pending`, tsc clean). Feature work, no BUG-IDs. If you split into two PRs, log both.
