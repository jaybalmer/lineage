# Design pass: stop duplicate-person creation for existing members

**Drafted:** September 6, 2026 (Cowork). **Source:** `bugs/2026-09-06-duplicate-person-creation-followup.md`, Follow-up 1.
**Size:** medium. Three shippable phases plus one GATED data operation. No phase is pipeline-safe: every phase touches identity, and Phase 3 touches `profiles` and hard-deletes a row. **HUMAN-RUN / ATTENDED throughout.**
**Playbook:** trimmed subset of the 24-check playbook. Checks 1, 2, 6, 7, 9, 11, 12, 13, 14, 21, 22, 23 apply and are answered in §8.
**Read §0 first.** The premise the follow-up note hands over does not survive contact with prod, and the brief is shaped around what replaced it.

---

## 0. Read this first: the input note's stated root cause is not the operative one

The follow-up note states the root cause as: *"all 18 members have zero rows in `people`, so any person search backed by the `people` table cannot surface an existing member."* The first clause is true. The second does not follow, and **prod says it is not what happened.**

`loadCatalog()` already unions `profiles` into `catalog.people` client-side (`src/store/lineage-store.ts:318-345`), and every user-facing person search in the app reads `catalog.people`, not the `people` table (audit in §1). The open question was whether RLS on `profiles` silently blocks that browser read, which `src/components/catalog-loader.tsx:26-30` flags as a live hazard for `/api/me`.

**VERIFIED 2026-09-06, signed out, against `linestry.com/people?community=all`:**

- The page renders **116 rider cards**, including a `FOUNDING MEMBERS` band (2 riders) and a `MEMBERS` band (2 riders) carrying `membership_tier`, `bio`, `riding_since` and avatars. Those fields exist only on `profiles`. **The anon-key read of `profiles` works. Members are in `catalog.people`, anonymously, in production.**
- Only one `Jay Balmer` remains, confirming the Sept 6 ghost cleanup landed.
- **`Todd Bowman` renders TWICE**, side by side in the public directory: `/people/d644c90b-fe03-4148-b477-dc1a3aa3ad84` ("riding since 1986, 25 claims, 1 place") and `/people/b7bccfdc-3d78-4a86-8551-c7577d0d9f6a` ("2 claims"). Both are on screen at once to any visitor today.

So: **members are searchable everywhere a user can search.** The premise that sent this to a design pass is wrong, and the fix in §2 changes accordingly. The duplicates come from the two mechanisms in §1.3.

### 0.1 One fact the note did not connect

The note records the Jay ghost as created by member `d644c90b`. The directory above shows `d644c90b` **is Todd Bowman's account.** So the person who created the duplicate Jay node is the same member who already had a duplicate ghost of himself sitting in the catalog.

That is not a coincidence worth ignoring. A plausible reading, worth 10 minutes of replay `S-49` in Follow-up 2: Todd signed up, saw his own name already on the site as a node he did not control, and formed the (reasonable) impression that adding people by typing a name is how this app works. Under that model, creating a "Jay Balmer" node is not a mistake, it is the pattern the product taught him three minutes earlier. §3's warning copy is written to correct that impression at the moment it forms.

**This also answers §5 step 0: the canonical id for the Todd merge is `d644c90b-fe03-4148-b477-dc1a3aa3ad84`.**

---

## 1. Entry-point audit (§1 of the ask)

### 1.1 Every surface a user can search a person from

All read `catalog.people`, which is `people` rows plus non-archived `profiles` rows merged at load (`lineage-store.ts:318-345`). Members ARE in this list once the catalog resolves.

| # | Surface | File:line | Source | Create affordance |
|---|---|---|---|---|
| 1 | AddStoryModal, Links tab, "Tag riders" | `add-story-modal.tsx:115`, picker at `:573-583` | `catalog.people` | `+ Add a rider` -> AddEntityModal |
| 2 | Story card, Add Connections popover | `add-connections-popover.tsx:131,184-191` | `catalog.people` | `+ Add a rider` |
| 3 | Person page, Add Connections popover | `add-person-connections-popover.tsx:142` | `catalog.people` | rider section has no create; place/org do |
| 4 | AddClaimModal, person object | `add-claim-modal.tsx:448-450` | `catalog.people`, empty list for authed users when catalog is unloaded | InviteRiderModal at `:741` |
| 5 | Event page, inline "Add People" | `events/[id]/page.tsx:489-492` | `catalog.people` | `handleCreateRider` at `:513` -> `addUserPerson` |
| 6 | `/people` directory search | `people/page.tsx:221-255` | `catalog.people` + `userEntities.people` | InviteRiderModal at `:476` |
| 7 | Global nav search | `nav.tsx:123` | `catalog.people` + `userEntities.people` | none |
| 8 | Stack curate modal | `stack-curate-modal.tsx:136` | `catalog.people` | none |
| 9 | Mention editor modal | `mention-editor-modal.tsx:60` | `catalog.people` | none |

### 1.2 Every server path that reads `people` by name or mints a person row

| Path | File:line | Source | Sees members? | Verdict |
|---|---|---|---|---|
| `GET /api/admin/invite-node?q=` | `invite-node/route.ts:30-40` | `people` only, `node_status IN ('catalog','unclaimed')` | No | **Correct as-is.** This searches for *invitable nodes*. A member is by definition not invitable. Do not "fix" this one. |
| `POST /api/public/tag` ghost upsert | `public/tag/route.ts:208-232` | `people` by `invite_email` + `unclaimed` | No | **Already guarded.** `emailHasAccount()` at `:197` returns 409 before any insert, added precisely because Jay marking his own episode minted a second Jay. |
| `POST /api/claims` object guard | `claims/route.ts:27-32` | **unions `people` + `profiles`** | Yes | **This is the precedent for the fix in §2.** |
| `subjectTierFor()` | `tag-events.ts:40-74` | `profiles` first, then `people` | Yes | Correct. |
| `addUserPerson` | `lineage-store.ts:811-844` | writes only | n/a | **No dedupe check. See §3.** |
| `AddEntityModal` person branch | `add-entity-modal.tsx:228-236` | writes only | n/a | **No dedupe check. See §3.** |

### 1.3 The two mechanisms that actually produce a duplicate

**Mechanism 1: the picker does not wait for the catalog.** `SearchPicker` (`src/components/ui/search-picker.tsx`) renders `items` immediately with no `catalogLoaded` gate, and every call site above passes `catalog.people` raw. When `items` is empty it renders the literal string `None yet` and then styles `+ Add a rider` as the highlighted blue action (`search-picker.tsx:66-83`). AddStoryModal *refires* `loadCatalog()` on mount (`:53-55`) precisely because the catalog goes stale, but does not gate on the result, so between mount and resolution the rider list is empty or partial and creating is the only thing the UI offers.

This matches the incident exactly: the member who created the ghost signed up at 00:06:38 on 2026-08-31 and created it at 00:09 UTC. First session, cold `localStorage`, catalog explicitly not persisted (CLAUDE.md Gotcha 4).

**Mechanism 2: no dedupe check exists anywhere on the create path.** Neither `addUserPerson` nor `AddEntityModal` compares the typed name to anything before inserting. `SearchPicker` also truncates to `.slice(0, 8)` after a plain substring filter with no ranking, so on a common first name the right person can be off the bottom of an 8-row list while `+ Add a rider` sits below it.

---

## 2. Decision: member searchability (§2 of the ask)

The ask offers two options. **The recommendation is neither as stated.**

**Rejected: give every member a real `people` row on signup.**
It reads as the clean fix and it is not. `loadCatalog()` dedups by id with **`people` winning over `profiles`** (`lineage-store.ts:320,327-328`: `profilePeople` filters out any row whose id is already in `catalogIds`). Backfill 18 `people` rows keyed on `profiles.id` and every member in the catalog silently loses `membership_tier`, `avatar_url`, `card_bg_url`, `profile_statement`, `profile_milestones` and `privacy_level`, because the thin `people` row now supplies them. That is a launch-visible regression across the directory, compare, connections, entity chips and the feed. It also collides with `node_status` semantics (`GET /api/admin/invite-node` filters `catalog|unclaimed`, and `merge_person`'s canonical lookup keys on `people.claimed_by`, which would start finding member rows and flip pending claim_requests from Path A to Path B mid-flight). It is a dual-write on every signup forever, for a problem the client already solves.

**Rejected: union `profiles` into every person search.**
It buys almost nothing. Nine of nine user-facing searches already union (§1.1). The only server-side name search is one that *should* exclude members. This option is a repo-wide edit that fixes zero live call sites and adds a rule every future call site has to remember.

**Recommended: one canonical search object, and leave the two tables as they are.**

This is **preventative, not a fix**: §0 established that no live surface is missing members. Create a read-only view that is the single answer to "search a person", so a future server-side call site cannot reintroduce the class by omission:

```sql
-- PSEUDOCODE, VERIFY AGAINST PROD SCHEMA BEFORE RUNNING.
-- people.id is text; profiles.id is uuid. Cast to text so the view is one type.
CREATE OR REPLACE VIEW public.person_search AS
  SELECT p.id::text            AS id,
         p.display_name,
         p.node_status,
         'profile'::text       AS source,
         p.membership_tier,
         p.avatar_url
    FROM public.profiles p
   WHERE p.display_name IS NOT NULL
     AND p.is_archived IS NOT TRUE
  UNION ALL
  SELECT pe.id                 AS id,
         pe.display_name,
         pe.node_status,
         'people'::text        AS source,
         NULL::text            AS membership_tier,
         pe.avatar_url
    FROM public.people pe;
```

Then: any NEW server-side person search reads `person_search`. Existing client searches are untouched. `GET /api/admin/invite-node` stays on `people` deliberately, and gets a one-line comment saying why so nobody "fixes" it later.

**Why this is the right shape.** The real problem was never that members are unfindable. It is that (a) the catalog can be empty at the moment of the search and (b) nothing checks before creating. Those are Phases 1 and 2. The view exists so the dedupe check in Phase 2 has one source to ask, and so the class of bug the note describes cannot appear the first time someone writes a server-side rider lookup.

**DECISION (shippable default, does not block on Jay):** build the view, do not backfill member `people` rows, do not touch `invite-node`. If the view feels like scope, cut it and keep §3: the view prevents a future bug, §3 fixes the present one. If Jay prefers the backfill anyway, the loadCatalog dedup direction at `lineage-store.ts:320,327-328` must be flipped to profiles-wins **in the same PR, before** the backfill runs, or 18 members lose their profile fields on the next page load.

---

## 3. Dedupe-on-create (§3 of the ask)

Two changes, both small, both client-side.

### 3.1 Gate the picker on the catalog

`SearchPicker` gains an optional `loading?: boolean`. When true it renders a "Loading riders…" row and **suppresses the `+ Add new` button entirely**. Every call site in §1.1 passes `loading={!catalogLoaded}`. This is the mechanism-1 fix and it is the highest-value line in the brief: a user cannot create a duplicate out of an empty list if the empty list does not offer creation.

Per playbook check 16, the suppressed state must say why. Muted row text: `Loading riders…` and nothing else clickable.

### 3.2 Near-match warning before the insert

In `AddEntityModal`, `entityType === "person"` only. On `displayName` blur or debounced change, match against `catalog.people` using the same normalisation `merge_person` uses for slugs, so the check and the URL space agree:

```ts
// mirrors public.name_to_slug() and src/lib/utils.ts nameToSlug()
const norm = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
```

Match on exact normalised equality first, then on normalised `includes` in either direction. Show at most 3 hits. Copy:

> **Someone with this name is already here.**
> **Todd Bowman** · member · riding since 1986 · 25 claims   `[ Use this one ]`
> Adding a second one splits their history in two.
> `[ Add anyway ]` (secondary, muted)

`Use this one` calls `onAdded(existingId)` and closes, so the caller wires up the existing person exactly as if it had been picked. `Add anyway` proceeds to the current `addUserPerson` path. **Never block the create.** Legitimate namesakes exist and the collision rule at CLAUDE.md Gotcha 11 already handles two people with the same slug.

Rank member hits (`source = 'profile'`, or in client terms `membership_tier` present) above ghosts, and label them `member` versus `unclaimed`, so the user can see that picking the member is the better answer.

Also apply to the event page's inline `handleCreateRider` (`events/[id]/page.tsx:513`), which bypasses `AddEntityModal` entirely. Simplest path: route it through `AddEntityModal` rather than duplicating the check.

---

## 4. The GATED merge tool (§4 of the ask)

### 4.1 Do not build a new one. There is already `public.merge_person()`

`supabase/migrations/20260511000001_merge_person_rpc.sql` (649 lines) is a `SECURITY DEFINER` plpgsql RPC that already does the whole job: `FOR UPDATE` locks, an idempotency check, a UUID-format guard, per-table FK repointing with dedup, `person_slug_aliases` rewrites, a full pre-delete `merge_log` snapshot, and the ghost delete, all in one transaction. It is called from `POST /api/claim-requests/[id]` on approve (`route.ts:220`).

**It cannot run the Todd case as written, for two reasons.**

1. **It is claim-request-driven.** Its only entry parameter is `p_claim_request_id`. There is no admin-initiated "fold this ghost into that person" entry point.
2. **Its canonical must be a `people` row.** Path selection at `:264-289` counts `people WHERE claimed_by = v_claimant_id`. Members have zero `people` rows, so that count is 0, so it takes **Path A (claim in place)**, which leaves the ghost standing as the person and does not fold anything into the account. Step 11 (`:595-599`) then writes `merged_from_id` with `UPDATE people ... WHERE id = v_canonical_id`, which would no-op against a `profiles` id.

### 4.2 Two verified defects to fix while in here

**Defect 1: `merge_person` was written on 2026-05-11 and has not been updated since, so it is roughly four months behind the schema.** Its repoint list (`:377-576`) covers 18 targets: `claims.subject_id/object_id/asserted_by`, `people.added_by/invited_by`, `places/orgs/boards/events.added_by`, `invites.person_id/invited_by`, `community_people.person_id`, `story_riders.rider_id`, `stories.author_id`, `riding_days.created_by`, `riding_days.rider_ids`, `claim_requests.node_id`, `person_slug_aliases.person_id`. Tables added since 2026-05-11 that hold a **text** person id and are therefore un-repointed:

| Table.column | Type | Added | Migration |
|---|---|---|---|
| `tag_events.subject_id` | `text NOT NULL`, no FK | May 2026 | PB-009 P1 |
| `event_people.person_id` | `text NOT NULL` | Jun 30 | `20260630000001` |
| `event_guests.person_id` | `text NOT NULL` | Jun 29 | `20260629000002` |
| `mentions.subject_id` | `text NOT NULL` | Jul 31 | `20260731000001` |
| `public_stack_entries.entry_ref_id` | `text` | Jun 15 | `20260615000003` |
| `person_invite_notifications.person_id` | `text REFERENCES people(id) ON DELETE CASCADE` | PB-008 | **cascade-deletes silently on ghost delete** |

Columns FK'd to `auth.users` or `profiles` (`story_reactions.reactor_id`, `story_comments.author_id`, `bug_reports.reporter_id`, `analytics_events.actor_id`, `tag_action_log.*`, `tag_blocklist.*`, `tag_trust.*`, `*_image_votes.user_id`) can never hold a ghost id and are correctly out of scope.

**Defect 2: `promoteGhostToAccount()` repoints 4 of 18.** `src/lib/promote-ghost.ts:42-54` (delete at `:88`) and its byte-identical twin in `src/app/api/invite/claim/route.ts:118-130` repoint only `claims.subject_id`, `claims.object_id`, `claims.asserted_by` and `story_riders.rider_id`, then `DELETE FROM people`. Every ghost promoted through the invite-claim or public-claim-complete path has been dropping references in the other 14+ columns. This is the same class of bug as the merge gap and should be fixed by making both paths call one function.

Run playbook check 1's enumeration query before writing the new list. It is already in the migration header at `:32-38`:

```sql
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND ( (data_type IN ('text','uuid') AND (column_name LIKE '%\_id' OR column_name LIKE '%\_by'))
      OR column_name IN ('rider_ids','entry_ref_id') )
 ORDER BY table_name, column_name;
```

### 4.3 What to build

**Migration `merge_person_v2`.** One file, forward-only, `CREATE OR REPLACE`:

1. Extract Path B's body into `public.merge_person_into(p_ghost_id text, p_canonical_id text, p_canonical_kind text, p_admin_id uuid, p_dry_run boolean DEFAULT true, p_note text DEFAULT NULL) RETURNS jsonb`.
2. `p_canonical_kind IN ('people','profiles')`. Step 11 branches: `UPDATE people SET merged_from_id ...` or `UPDATE profiles SET merged_from_id ...`. Both columns already exist (`migration-008-person-nodes.sql:23` on `people`, `:12` on `profiles`), and `person-redirects.ts:26-53` already reads **both** for the alias map, so profile-target merges get old-URL redirects for free.
3. `p_dry_run = true` runs every `SELECT count(*)` and returns the same `references_repointed` shape **without writing anything**, then `RAISE EXCEPTION 'dry_run_rollback'` inside a savepoint so the transaction cannot commit. Dry run is the default; the caller must ask for the write.
4. Add the six drifted tables from §4.2. `person_invite_notifications` must be repointed **before** the ghost delete or the cascade eats it.
5. `merge_person()` keeps its signature and delegates to the new function with `p_canonical_kind := 'people'`, `p_dry_run := false`. Existing approve behaviour is unchanged.
6. Per playbook check 19, assert post-deploy: `SELECT pg_get_functiondef('public.merge_person_into'::regproc);`

**Route `POST /api/admin/merge-person`.** `requireEditor()`. Body `{ ghost_id, canonical_id, canonical_kind, confirm_name, dry_run }`. Refuses unless `confirm_name` string-equals the ghost's current `display_name`. Refuses when `ghost_id === canonical_id`. Refuses when the ghost row has `claimed_by` set (that is a claimed account, not a ghost). Returns the RPC's jsonb verbatim.

**Then fold `promoteGhostToAccount` and `/api/invite/claim` onto `merge_person_into(..., 'profiles', ..., p_dry_run := false)`**, keeping their existing identity-restore block (name-over-placeholder, fill-only-when-empty) which the RPC does not do. This closes Defect 2 and means one repoint list serves every fold-in path in the app.

**UI:** `/admin/claims` gains a "Merge duplicate" panel next to the existing invite panel (`admin-invite-panel.tsx` is the pattern to copy). Search ghost via `GET /api/admin/invite-node?q=`, search canonical via the new `person_search` view, dry-run first and render the counts, then a typed-name confirm to commit. Per playbook check 12: endpoint -> UI trigger -> affordance is `POST /api/admin/merge-person` -> `/admin/claims` Merge panel -> dry-run table then typed confirm.

---

## 5. Running it on Todd Bowman (GATED, attended, Jay approves each step)

Ghost `b7bccfdc-3d78-4a86-8551-c7577d0d9f6a`, created by Jay 2026-06-18, carries 2 claims and 2 story tags. Canonical is Todd's `profiles` row.

**Step 0: canonical id.** Resolved in §0: `d644c90b-fe03-4148-b477-dc1a3aa3ad84`. Confirm it is the `profiles` row and not a `people` row before passing it:

```sql
SELECT id, display_name, node_status, membership_tier, created_at
  FROM profiles WHERE id = 'd644c90b-fe03-4148-b477-dc1a3aa3ad84';
SELECT count(*) FROM people WHERE id = 'd644c90b-fe03-4148-b477-dc1a3aa3ad84';  -- expect 0
```

**Step 1: full reference sweep.** Run the §4.2 enumeration query, then probe every returned column for the ghost id. Do not trust the "2 claims + 2 story tags" figure as the whole picture; it predates the drift audit and the six drifted tables were never checked.

**Step 2: dry run.**
```sql
SELECT public.merge_person_into(
  'b7bccfdc-3d78-4a86-8551-c7577d0d9f6a',
  'd644c90b-fe03-4148-b477-dc1a3aa3ad84', 'profiles', '<jay_admin_uuid>', true, 'BUG-179 follow-up 1');
```
Expect `references_repointed` to account for every row step 1 found. **A mismatch stops the merge.**

**Step 3: commit.** Same call with `p_dry_run := false`. GATED: Jay reads the dry-run output and says go.

**Step 4: verify.**
```sql
SELECT count(*) FROM people WHERE id = 'b7bccfdc-...';                       -- expect 0
SELECT merged_from_id FROM profiles WHERE id = 'd644c90b-fe03-4148-b477-dc1a3aa3ad84';         -- expect b7bccfdc-...
SELECT path, references_repointed FROM merge_log WHERE ghost_id = 'b7bccfdc-...';
```
Then hit `/people/b7bccfdc-...` in a browser and confirm the proxy redirects to Todd's canonical URL via `person-redirects.ts`.

**Step 5: SHIP-LOG entry**, matching the BUG-179 cleanup entry's format.

**Ordering note:** if `merge_person_into` slips, Todd can be merged by hand as a one-off transaction, but do not. Doing it by hand is how the drifted column list gets missed a second time, and there is no `merge_log` row at the end of it. Hold the merge until the tool exists. The ghost has sat since June 18 and is not getting worse.

---

## 6. Suggested build order

The activating flip is LAST, per house convention.

| Phase | Contents | Risk | Migration |
|---|---|---|---|
| **1** | `SearchPicker` `loading` prop + `catalogLoaded` at all 9 call sites | client-only, no migration | no |
| **2** | `person_search` view; dedupe warning in `AddEntityModal`; route `handleCreateRider` through it | SAFE (`CREATE VIEW`) | yes, additive |
| **3** | `merge_person_into` + `/api/admin/merge-person` + `/admin/claims` panel; refold `promote-ghost` and `/api/invite/claim` | GATED | yes, `CREATE OR REPLACE` |
| **4** | Run the Todd merge (§5) | GATED, data operation | no |

There is no Phase 0. The RLS branch this brief was drafted to allow for was closed by the §0 verification.

Phase 1 alone probably stops the bleeding, and it is the phase with the least that can go wrong. Ship it on its own if the session runs short.

Per playbook check 23: Phase 2's view and Phase 3's function must both be applied to prod **before** their PRs merge, because the dedupe check and the merge route call them unconditionally.

---

## 7. Out of scope (hard list)

- Follow-up 2, how "Create A Story" routed the reporter onto the ghost page. Needs PostHog replay `S-49`. Separate and smaller, though §0.1 hands it a hypothesis to test.
- Retiring the dual `people` + `profiles` model. Not this pass.
- Any change to `GET /api/admin/invite-node`'s member exclusion. It is correct.
- Backfilling `people` rows for members. Explicitly rejected in §2.
- Retro-repairing references already lost by Defect 2 on previously promoted ghosts. Log what the audit finds; repair is its own pass.
- BUG-179 itself. Closed by data cleanup on Sept 6.

---

## 8. Playbook status, honestly

| Check | Status |
|---|---|
| 1 schema introspection | **Partial.** Read from `supabase/migrations/` and `migration-*.sql`. Tables predating the migrations folder (`claims`, `people` base, `story_boards`, `riding_days`) are not covered by file. The `information_schema` query in §4.2 is the completion step and must run before the repoint list is written. |
| 2 code-path existence grep | Done. Every route and file:line in this brief was read in the working tree at today's tip. |
| 6 forward-warning grep | Done. `merge_person`'s own header carries the pre-deploy checks reused in §4.2. |
| 7 surface-existence audit | Done. All 9 search surfaces in §1.1 were opened and their source confirmed. |
| **9 assertion precheck** | **Partial, and this is the gap.** The §0 premise was verified live against prod (signed-out browser, `linestry.com/people?community=all`), which is the assertion that mattered most. No SQL in this brief has been run: the drafting shell has no network to Supabase. Every "expect" in §4.2 and §5 must be run before Phase 3 starts. |
| 11 whole-file preflight | Done for `search-picker.tsx`, `promote-ghost.ts`, `catalog-loader.tsx`, `invite-node/route.ts`; targeted for the 649-line RPC and the 1200+ line store. |
| 12 endpoint-to-surface pairing | Done, §4.3. |
| 13 orphan-auth audit | **Not run** (same network reason). `20260515000001_orphan_auth_users_backfill.sql` exists, so this has bitten before. Run `SELECT count(*) FROM auth.users u LEFT JOIN profiles p ON p.id = u.id WHERE p.id IS NULL;` before Phase 2. |
| 14 catalog-quality audit | **Not run.** The RPC header records 29 non-UUID `people` ids as of 2026-05-11. Re-run `SELECT count(*) FROM people WHERE id !~ '^[0-9a-f]{8}-...'` before Phase 3; those rows cannot be Path-B merged. Todd's ghost is UUID-format so it is unaffected. |
| 21 copy prefs | Applied. No em dashes anywhere in this brief or in the §3.2 UI copy. |
| 22 premise verification | Done, and it changed the brief. See §0. |
| 23 migrate-before-merge | Stated in §6. |

---

## 9. Decisions (settled 2026-09-06, do not re-open)

1. **Dedupe warning strength: warn and offer, never block.** An exact normalised match to a member ranks first and is labelled `member`, but `Add anyway` always remains available. Namesakes are real and CLAUDE.md Gotcha 11's slug-collision rule already handles two people with the same name.
2. **Defect 2 blast radius: log, do not repair in this pass.** When `merge_person_into` lands, run the reference sweep once across all previously promoted ghosts and record the counts in `bugs/RUN-LOG.md`. Retro-repair is its own brief if the numbers justify one.
3. **`person_search` view: build it**, as prevention (§2). If Phase 2 is running long, cutting the view is the correct trim. Cutting the §3 warning is not.
