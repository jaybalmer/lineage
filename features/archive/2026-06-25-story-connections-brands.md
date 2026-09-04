# Story Connections: add brands to the +Connect flow

**Claude Code handoff brief. Drafted June 19, 2026 (Cowork session).**

---

## 0. Scope and size honesty

Small session, estimated **2 to 3 hours** of build plus ~20 min of pre-flight reads and ~20 min of deploy and smoke. Brands map to the `orgs` entity, and a brand connection is **not person-implicating**, so this is a near-exact clone of the place/event path that shipped in Story Connections (`Operations/story-connections-brief.md`, June 9, PR for that feature is live on `main`). One junction table (`story_orgs`), no tag_events, no moderation pipeline, no rider/PB-009 complexity. The author's own primary `linked_org_id` stays where it is; community brand connections live in the new junction and the chip row renders the union.

This brief was drafted against the **live shipped code** (read in full: the connections route, the popover, the stories GET payload, StoryCard chips, AddEntityModal). Every file path and line reference below is from that read. The relevant pre-flight checks are applied; the one prod SQL check is in §10.

## 1. What we're building

Members can already add riders, places, and events to any public story from the card's +Connect popover. This adds **Brands** as a fourth connection type, sitting beside the other three in the same popover, rendering as a cyan chip in the story card's chip row, removable by the adder, the story author, or an editor.

The author's own modal already calls the org picker "Brand" and pulls all of `catalog.orgs` (single-select), so the community version mirrors that exactly: label "Brands", pull `catalog.orgs`, no filtering by `org_type`. (Orgs span brand, shop, team, magazine, event-series; the author surface does not split them and neither should this.)

Decision locked with Jay: **brands only this session.** Boards remain the last parked connection type (note `board_ids[]` already exists on stories); add them in a later session if wanted.

## 2. Prerequisites

- P1: Pull latest `main` (must include the shipped Story Connections feature: the `story_places` / `story_events` junctions, `/api/stories/[id]/connections/route.ts`, and `add-connections-popover.tsx`).
- P2: If working in a worktree, symlink `.env.local` from the parent repo.
- P3: Smoke testing runs against the dev server started **from the worktree path, not `~/lineage`**. Stop any pre-existing dev server first so port 3000 binds to the worktree instance.
- P4: Run the §10 prod query before writing the migration.

## 3. Verified facts (checked against the shipped code, June 19, 2026)

| # | Fact | Provenance |
|---|------|-----------|
| 1 | `stories.linked_org_id` is `text`, the author's single primary brand link. It is filterable on GET via the `org_id` query param as a plain `.eq` today. | `route.ts:27, 87`; `types/index.ts:549` |
| 2 | `orgs.id` is **text** (not uuid), same as `places.id` / `events.id`. The new junction column must be text. | catalog DDL; matches `story_places.place_id text` |
| 3 | The connections route handles `place`/`event` identically through a `table`/`idColumn`/`authorLink` switch (POST `route.ts:87-109`, DELETE `route.ts:248-275`). Adding `org` is extending those three maps, nothing structural. | whole-file read of `connections/route.ts` |
| 4 | `ConnectionType` is `"rider" \| "place" \| "event"` and the allowed-type guard arrays are duplicated in POST (`route.ts:66`) and DELETE (`route.ts:235`). Both need `"org"`. | `connections/route.ts:21, 66, 235` |
| 5 | `loadStory` selects `linked_place_id, linked_event_id` but **not** `linked_org_id` today; the `StoryRow` interface lists the same two. Both need `linked_org_id` added for the author-link idempotency check. | `connections/route.ts:29-37` |
| 6 | GET maps `community_places` / `community_events` onto each story from parallel base-table fetches (`route.ts:165-218, 226-227`). Brands clone this: add a `story_orgs` fetch to the `Promise.all` and a `community_orgs` map. | whole-file read of `stories/route.ts` GET |
| 7 | The place/event GET filters are already **unions** (author link OR junction) so a community-connected story surfaces on the entity page (`route.ts:94-113`). The `org_id` filter at `route.ts:87` is still a plain `.eq` and must be upgraded to the same union so brand connections surface on `/brands/[id]`. | `stories/route.ts:87, 94-113` |
| 8 | `StoryConnectionType` is exported from `add-connections-popover.tsx:17` and reused in StoryCard. Adding `"org"` cascades through both. | `add-connections-popover.tsx:17`; `story-card.tsx:12` |
| 9 | The popover already supports inline entity creation via `AddEntityModal`, whose `entityType` union **already includes `"org"`** (`add-entity-modal.tsx:11`). The popover's local `addingEntity` state is typed `"person" \| "place" \| "event"` and must add `"org"`; `handleEntityCreated` maps the created kind to a connection type. | `add-connections-popover.tsx:32, 113-116`; `add-entity-modal.tsx:11` |
| 10 | StoryCard builds `communityPlaceChips` / `communityEventChips` by deduping the community list against the author link and resolving through the catalog (`story-card.tsx:119-130`). Brands clone this against `linked_org_id` and `catalog.orgs`. | `story-card.tsx:105-130` |
| 11 | The author's `linked_org_id` already renders as a cyan chip at `story-card.tsx:453-459` using `orgSlug()` and `/brands/[slug]`. Community brand chips reuse that styling plus the `×` removal appendage that place/event community chips carry (`story-card.tsx:391-445`). | `story-card.tsx:453-459, 391-445` |
| 12 | Removal rights and optimistic state already generalize over `StoryConnectionType` in StoryCard: `handleConnectionAdded` (`story-card.tsx:148-169`), `removeConnection` (`171-`), `canRemoveCommunityLink` (`140-141`). Each needs an `org` branch mirroring `place`. | `story-card.tsx:140-180` |
| 13 | Brand connections are not person-implicating: no `tag_events`, no `pairXTagEvents`, no `fireTagEvents`, no global-block precheck. They follow the place/event branch end to end, never the rider branch. | feature design parity |
| 14 | A community connection awards +1 contribution token (`awardContributionTokens(db, user.id, 1, "contribution_connection")`, `connections/route.ts:202`); this fires for any new connection and needs no change (brands inherit it). | `connections/route.ts:199-202` |

## 4. Migration

One file: `supabase/migrations/20260619000001_story_orgs.sql`. Direct clone of `story_places`, FK target `orgs(id)`, column type text (fact 2). No backfill.

```sql
-- Story Connections: community-added brand/org links on stories.
-- Not person-implicating: plain junction, no tag_events. The author's own
-- primary link stays on stories.linked_org_id. added_by is the community
-- member who made the connection; NULL means their profile was deleted and
-- removal rights fall to the story author and editors.

create table if not exists story_orgs (
  story_id    uuid not null references stories(id) on delete cascade,
  org_id      text not null references orgs(id) on delete cascade,
  added_by    uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (story_id, org_id)
);

create index if not exists story_orgs_org on story_orgs (org_id);

alter table story_orgs enable row level security;

create policy "story_orgs_select" on story_orgs
  for select using (
    exists (select 1 from stories s where s.id = story_id
            and (s.visibility = 'public' or s.author_id = auth.uid()))
  );

comment on table story_orgs is
  'Community-added brand/org connections on stories. Author''s own primary link stays on stories.linked_org_id. Not person-implicating: no tag_events row.';
```

## 5. Type change (`src/types/index.ts`)

Extend `Story`, beside `community_places` / `community_events`:

```typescript
community_orgs?: { org_id: string; added_by: string | null }[]
```

## 6. Code changes

### 6.1 Connections route (`src/app/api/stories/[id]/connections/route.ts`)

- `ConnectionType`: add `"org"` (fact 4).
- `StoryRow` + `loadStory` select: add `linked_org_id` (fact 5).
- POST guard array (`route.ts:66`) and DELETE guard array (`route.ts:235`) and their error strings: add `"org"`.
- POST place/event branch (`route.ts:87`): change the condition to `type === "place" || type === "event" || type === "org"`, and extend the three maps:
  - `table`: `org` to `story_orgs`
  - `idColumn`: `org` to `org_id`
  - `authorLink`: `org` to `story.linked_org_id`
  The existing 23505 (already connected) and 23503 (unknown entity) handling covers brands unchanged.
- DELETE place/event branch (`route.ts:248`): same condition extension and same three-map extension. Rights logic (adder / author / editor) is unchanged.
- The rider branch (`else`) is untouched; brands never reach it.

### 6.2 GET payload (`src/app/api/stories/route.ts`)

- Add a `communityOrgsByStory` map beside the place/event maps (`route.ts:165-166`).
- Add a fourth fetch to the `Promise.all` (`route.ts:168-185`): `supabase.from("story_orgs").select("story_id, org_id, added_by").in("story_id", storyIds)`, with the same error-degrades-to-empty handling.
- Populate `communityOrgsByStory` (clone the `cEventRes` loop, `route.ts:214-218`).
- Map `community_orgs: communityOrgsByStory.get(...) ?? []` onto each story (`route.ts:226-227`).
- **Filter union** (`route.ts:87`): replace the plain `.eq` with the place/event union pattern so a brand-connected story appears on `/brands/[id]`:

```typescript
if (orgId) {
  const { data: coRows, error: coErr } = await supabase
    .from("story_orgs")
    .select("story_id")
    .eq("org_id", orgId)
  const coIds = coErr ? [] : ((coRows ?? []) as { story_id: string }[]).map((r) => r.story_id)
  query = coIds.length > 0 && !/[,()'"]/.test(orgId)
    ? query.or(`linked_org_id.eq.${orgId},id.in.(${coIds.join(",")})`)
    : query.eq("linked_org_id", orgId)
}
```

(Pseudocode-honesty note: this `.or(...id.in.(...))` composition is the exact pattern already running for places/events in this same file, so it is proven against this schema, not believed-correct.)

### 6.3 Popover (`src/components/feed/add-connections-popover.tsx`)

- `addingEntity` state type (`:32`): add `"org"`.
- `handleEntityCreated` kind param: add `"org"`, mapping `org` to the `"org"` connection type (`:113-116`).
- `connect()` connected-set switch (`:68`): add an org set built from `linked_org_id` + `community_orgs` (clone `placeSet`/`eventSet` at `:56-63`).
- Add a fourth `SearchPicker` section "Brands" over `catalog.orgs`, `getLabel={(o) => o.name}`, `onToggle={(id) => connect("org", id)}`, `onAddNew={() => setAddingEntity("org")}`, `addNewLabel="Add a new brand"` (clone the Places block at `:183-194`).

### 6.4 StoryCard (`src/components/feed/story-card.tsx`)

- `communityOrgChips`: clone `communityPlaceChips` (`:119-124`), deduping `community_orgs` against `linked_org_id`, resolving through `catalog.orgs`.
- `handleConnectionAdded` (`:148`): add an `org` branch mirroring `place` (`:154-160`), pushing to `community_orgs`.
- `removeConnection` optimistic update (`:175-180`): add the `org` case filtering `community_orgs`.
- Chip render: render `communityOrgChips` as cyan chips beside the author's `linkedOrg` chip (`:453-459`), each with the `×` removal appendage gated by `canRemoveCommunityLink(conn.added_by)` and the "Connected by {name}" tooltip, matching the place/event community chips at `:391-445`.

## 7. Suggested order

1. Migration (apply via dashboard, run §9 post-check).
2. Type.
3. Connections route (POST then DELETE; brands ride the existing place/event branch).
4. GET payload: the four-map fetch, then the `org_id` filter union. Verify the union returns rows on localhost before trusting acceptance test 2.
5. Popover Brands section + inline-create wiring.
6. StoryCard chips + optimistic state.
7. Acceptance tests (§8), then deploy.

The user-visible flip (the Brands section rendering in the popover) lands last.

## 8. Acceptance criteria

Against the Vercel preview with two plus-aliased accounts (A = author, B = community member) plus one editor account.

1. B opens A's public story, taps +Connect, adds a brand from the Brands picker. A cyan chip appears immediately; on reload it is visible signed-out; tooltip reads "Connected by B".
2. The `/brands/[id]` page Stories tab now lists A's story (proves the §6.2 filter union).
3. Idempotency: B re-adds the same brand, gets no duplicate chip and no error toast; adding a brand that equals A's own `linked_org_id` is a no-op (no duplicate of the author chip).
4. B can self-remove their own brand chip (`×`). A (author) can remove B's brand chip. An editor can remove it. A third non-editor, non-adder member sees no `×` on B's brand chip.
5. Inline create: B searches a brand that does not exist, taps "Add a new brand", creates it via the modal, and it connects to the story on creation.
6. Deleting the story cascades `story_orgs` rows (verify no orphan rows, no regression).
7. `npx tsc --noEmit` clean. The author Add Story modal and the existing rider/place/event connection flows behave identically (no regression from the shared-type and shared-route edits).

## 9. Pre/post-deploy SQL assertions

Pre-deploy (before migration, should error "relation does not exist"):

```sql
select count(*) from story_orgs;
```

Post-deploy, before code merge (expected 0, trivially true for a brand-new table so it cannot false-alarm):

```sql
select count(*) from story_orgs;
```

Post-smoke (after acceptance test 1):

```sql
select story_id, org_id, added_by from story_orgs order by created_at desc limit 5;
```

## 10. Data-quality question (run before writing the migration)

Orphan-link check, mirroring the June 9 brief's verified-clean result. Expect 0; if non-zero, the FK in §4 will reject those rows but nothing in scope writes them, so it is informational:

```sql
select count(*) from stories s
where s.linked_org_id is not null
  and not exists (select 1 from orgs o where o.id = s.linked_org_id);
```

## 11. Gotchas

1. **`orgs.id` is text** (fact 2). Do not type the junction column uuid.
2. **Brands never touch the rider branch** (fact 13): no tag_events, no global-block precheck, no `fireTagEvents`. If you find yourself importing a tag helper for this, stop.
3. **`linked_org_id` was missing from `loadStory`** (fact 5): without adding it, the author-link idempotency check (§6.1) silently fails and a member can duplicate the author's own brand as a community chip.
4. **The `org_id` GET filter is the one behavior change to existing code** (§6.2): it is strictly additive (union, not replacement) and degrades to the original `.eq`, so it is safe under rollback.
5. **No em dashes in any UI copy, comments, or strings** (standing rule, `feedback_no_em_dashes.md`). The copy in this brief is em-dash-free; keep it so.

## 12. Hard out-of-scope

- Board community connections (the last parked type; `board_ids[]` exists).
- Any moderation pipeline, tag_events, or reporting for brand connections (removal rights are the control, exactly as for places/events).
- Filtering the Brands picker by `org_type` (match the author modal: all orgs).
- Notifications or emails for brand connections.
- Connections on claims or riding days.

## 13. Rollback recipe

UI: remove the Brands `SearchPicker` section (one block) and the brand chips fall back to author-link-only. Data: revert the PR; `story_orgs` is additive and can sit empty or be dropped with `drop table story_orgs;`. The only edit to existing code paths is the `org_id` filter union (§6.2), which is protective and safe to leave under any rollback.
