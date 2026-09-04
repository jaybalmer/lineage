# Podcast pass Session D: transcript-to-mentions skill + idempotent seed import

> **Build-ready Claude Code handoff. Drafted July 31, 2026 (Cowork).**
> Source chain: Jay's July 30 note drop -> `features/podcast-episode-pass-notes.md`
> (F5) -> this brief. Session B (mentions foundation) shipped as PR #168; the
> `mentions` table + `POST /api/admin/mentions` are live. This session builds the
> authoring workflow on top: drop a transcript, get a scrubbed mention list, push
> it to prod as DRAFT mentions, idempotently.
>
> **Size: ~4 to 6 hr. NO migration** (the `mentions` table already exists; ghost
> entities use existing tables). This is a `.claude/` skill + a seed-file format
> + an idempotent importer script, plus a small name-resolution helper. Mostly
> tooling, not app UI.
>
> Pre-flight playbook: the 24-check playbook was applied at drafting against the
> live repo (July 31) via a whole-file code survey. Verified facts in §3 carry
> file:line provenance. Anything not verified is tagged "verify at build time".

---

## 0. What this delivers

Jay's intended workflow, in Claude Code (NOT in-app AI): start a podcast session,
provide the episode transcript, and get a reviewable mention list that he scrubs
(names, timestamps, connections). The finished, approved list pushes into
production as DRAFT mentions against the episode, ready to be published from the
episode page (Session B) and surfaced on the public page (Session C).

Three build artifacts:

1. **An authoring skill** (`.claude/skills/podcast-mentions/SKILL.md`) that turns
   a pasted transcript + an episode identifier into a structured, reviewable
   **seed file** (candidate mentions with subject name, proposed subject type,
   timestamp, excerpt, and a resolution status: matched-existing vs new-ghost).
2. **A seed-file format** (JSON) that is human-scrubbable and is the capture
   artifact: an un-imported seed holds the mentions for the future with nothing
   live in the catalog.
3. **An idempotent importer** (`scripts/import-mentions.mjs`) that, on `--apply`,
   resolves each subject to an existing entity or creates an unclaimed ghost,
   then inserts DRAFT mentions, skipping any that already exist. Re-running is
   safe.

This directly answers the capture-vs-publish tension: the seed file is the hold
(nothing live until import), and even after import the mentions are drafts
(hidden until an editor publishes them per Session B). Two independent hold
points.

The ep-21 FNRad Jay Balmer transcript is the worked example / acceptance fixture;
the verified entity list is in Drive `FN-Rad-Podcast-Mentions-Linestry.xlsx`.

---

## 1. DECISIONS (review before building)

Defaults (shippable as-is; Jay can override in review):

- **D1. Unresolved-subject handling = propose-in-seed, create-on-import.** For a
  mentioned name with no catalog entry, the skill does NOT silently create
  anything at authoring time. It writes the candidate into the seed with
  `resolution: "new_ghost"` and a proposed `subject_type` (default `person`).
  Jay reviews/edits. On `--apply`, the importer creates the ghost (unclaimed) and
  then inserts the draft mention. This keeps Jay in control of what becomes a
  catalog entity, and keeps the un-imported seed as a zero-side-effect capture.
- **D2. Import lands DRAFT.** Every imported mention row carries
  `status: "draft"`. This is load-bearing: the API/insert default is
  `"published"`, so the importer MUST set `draft` explicitly on every row
  (fact 1). Publishing stays a manual editor action on the episode page.
- **D3. The importer is a service-role Node script, not the HTTP route.** It uses
  the service-role client directly (like `scripts/backfill-public-slug.mjs`),
  because it must create ghost entities AND insert mentions in one idempotent
  pass, and because the `POST /api/admin/mentions` bulk path fails the whole
  batch on a single 23505 and only reports the first dupe (fact 1). Direct DML
  lets the importer skip already-present rows cleanly. Dry-run by default,
  `--apply` to write. This follows the established one-off data-op precedent
  (`scripts/*.mjs`, `docs/*.sql`), which the repo treats as data tasks, not
  feature PRs, though the script + skill themselves ship in a PR.
- **D4. Transcript is provided input, not fetched.** The app has no transcript or
  captions utility (fact 7). The skill takes the transcript text (pasted or
  attached) plus the episode identity (show name + episode number, or the episode
  id) and the media URL. Fetching a YouTube transcript is out of scope; if Jay
  drops a link, he pastes the transcript alongside it.
- **D5. Ghost creation, per subject type.** `person` ghosts insert into `people`
  with a fresh `crypto.randomUUID()` id and `node_status: "unclaimed"` +
  `community_status: "unverified"` set EXPLICITLY (the DB default `catalog`
  misfiles them, fact 4). Non-person subjects (`place`/`org`/`board`/`event`)
  insert into their table with a text id in the existing
  `${prefix}_${Date.now()}_${rand}` convention. The importer stamps `added_by`
  with Jay's profile id (supplied via env or a flag). Verify the minimal required
  columns per table at build time against the existing insert routes.
- **D6. Name resolution = case-insensitive exact match, then ghost.** Resolve a
  subject by `nameToSlug`-normalizing and doing an `ilikeExact` match against the
  right table (the same dedup technique the create routes use, fact 5). Exactly
  one match resolves; zero matches becomes a `new_ghost`; multiple matches flags
  `ambiguous` in the seed for Jay to disambiguate (never auto-pick). There is no
  all-types search route, so the importer queries each subject table directly.
- **D7. Seed files live in `podcast-seeds/` (gitignored, like `bugs/` and
  `features/`).** One JSON file per episode, named
  `<show-slug>-ep<N>.json`. This keeps reviewer-edited seeds (which contain
  proposed catalog data) out of git while staying beside the workflow. Confirm
  the exact directory and gitignore entry at build time.
- **D8. Idempotency = skip-existing.** Before inserting, the importer reads the
  existing `mentions` dedupe key
  `(episode_event_id, subject_type, subject_id, coalesce(timestamp_seconds,-1))`
  and the existing ghost (by resolved id) and skips anything already present, so
  re-running an already-applied seed is a no-op. It reports created/skipped
  counts. Mirrors the `backfill-public-slug.mjs` "only touch absent rows" rule.

---

## 2. Why now
- Session B made the `mentions` schema real; the skill could not be designed
  until it was (fact 10). It is now live (PR #168).
- FNRad Season 12 is the last season; the archive goal is this season's episodes
  mapped well at release, then backfill the full archive. A repeatable
  transcript-to-mentions pass is what makes per-episode indexing minutes, not
  the hour the manual ep-21 pass took.
- The ep-21 delete-and-recreate end-to-end test (Session C note) needs this skill
  to be the mention-capture half of the integrated workflow.

---

## 3. Verified facts (July 31, live repo, file:line provenance)

1. `POST /api/admin/mentions` (`src/app/api/admin/mentions/route.ts`): accepts a
   single object or `{ mentions: [...] }` bulk, cap `MAX_BULK = 200` (L17,
   L80-87); `requireEditor` (L72). **`status` defaults to `"published"` unless
   the row literally sends `"draft"` (L58).** No subject-FK validation: only the
   episode existence is checked (L100-104); `subject_id` inserts blind (the
   migration has no FK on the subject side). On 23505 it re-queries the FIRST row
   and returns 409 with `existing_id` (L108-127), so a single dupe fails an
   entire bulk insert. This is why the importer uses direct DML with skip-existing
   (D3/D8), not this route.
2. `src/lib/mentions.ts` (client-safe): `MENTION_SUBJECT_TYPES` =
   `["person","place","org","board","event"]` (L10-12), `parseTimestampInput`
   (L19, accepts mm:ss / h:mm:ss / raw seconds), `formatTimestamp` (L33). The
   skill/importer should MIRROR `parseTimestampInput`'s rule (the importer is
   `.mjs`, cannot import the TS directly) and note "change both if the rule
   changes," exactly as `backfill-public-slug.mjs` does for the slug rule.
3. `.claude/skills/` does NOT exist. `.claude/` holds only `launch.json`,
   `settings.json`, `settings.local.json`, and `hooks/ship-log-append.sh`. No
   skill precedent in the repo, and `~/lineage/CLAUDE.md` has no skills section.
   The SKILL.md format is greenfield: define it from scratch (name + description
   frontmatter + instructions; if scripts are bundled, a `scripts/` subdir).
4. Ghost/person creation today: anonymous public tag path inserts `people` with
   `crypto.randomUUID()` + `node_status:"unclaimed"` + `community_status:
   "unverified"` + `invite_email` (`src/app/api/public/tag/route.ts:220-228`);
   member-created rider `addUserPerson` inserts `people` with
   `node_status:"unclaimed"` and warns the DB default `catalog` misfiles ghosts
   (`src/store/lineage-store.ts:731-752`). node_status enum:
   `catalog | unclaimed | claimed | verified`.
5. Non-person catalog creation uses text ids: shows/episodes via
   `genId(prefix)="${prefix}_${Date.now()}_${rand}"`
   (`src/app/api/admin/show-episode/route.ts:19-21`), member catalog entities via
   a client `generateId(prefix)` into `places`/`boards`/`events`/`orgs`
   (`src/app/api/catalog/entity/route.ts`, ids client-supplied). Name dedup is
   `ilikeExact` (escapes wildcards, `catalog/entity/route.ts:44-46,87-88`).
   Editor person search: `GET /api/admin/invite-node?q=<name>` returns up to 10
   catalog/unclaimed people by `ilike display_name`
   (`src/app/api/admin/invite-node/route.ts:21-41`); there is NO public people
   search and NO all-types search route.
6. Id-space per subject_type: `person -> people` (+ `profiles` for members),
   `place -> places`, `org -> orgs`, `board -> boards`, `event -> events`. Ids are
   mixed-type (text `evt_...`/`org_...` and uuids), which is why `mentions.subject_id`
   is text with no FK.
7. No transcript/captions/YouTube-fetch utility exists (grep clean). Only
   `parseYouTubeId` in `src/lib/utils.ts:151` (extracts the id from a URL). The
   transcript is external input.
8. `hydrateEpisodes` (`src/lib/mentions-server.ts:17-62`) selects
   `id, name, start_date, episode_number, media_url, show_org_id` from `events`
   by id; the importer resolves an episode by name-within-show
   (`events.ilike(name).eq(show_org_id, ...)`, mirroring
   `show-episode/route.ts:90-91`) or by id, and reads `media_url` for context.
9. Seed/data-op precedents: annotated one-off SQL in `docs/*.sql` (headers
   documenting "AS APPLIED to prod <date>", type notes), and idempotent Node
   scripts in `scripts/*.mjs` (`backfill-public-slug.mjs`: `--apply` vs dry-run,
   reads `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`, service-role client,
   only touches absent rows, mirrors a TS rule with a "change both files" note).
   The importer follows the `scripts/*.mjs` pattern.
10. Current feature LEAD is Curated Member Profile Phase 3; Session B shipped
    (PR #168); Session C (episode destination) is drafted alongside this brief.
    Sequencing: build Session C first (Jay's call), then this.

---

## 4. Migration
None. The `mentions` table exists (`20260731000001_mentions.sql`). Ghost creation
reuses existing tables (`people`, `places`, `orgs`, `boards`, `events`). If a
build-time gap surfaces (e.g. a required NOT NULL column with no default on a
ghost insert), stop and flag rather than adding a migration silently.

---

## 5. Seed-file format (`podcast-seeds/<show>-ep<N>.json`)

The capture artifact and the review surface. Human-editable. Example:

```json
{
  "episode": {
    "show_name": "FNRad Podcast",
    "episode_number": 21,
    "episode_event_id": "evt_...optional_if_known...",
    "media_url": "https://www.youtube.com/watch?v=xpr2sqrPUHA",
    "public_slug": "FNRad_Jay_Balmer"
  },
  "mentions": [
    {
      "subject_name": "Ken Achenbach",
      "subject_type": "person",
      "resolution": "matched_existing",
      "subject_id": "…resolved id…",
      "timestamp_seconds": 498,
      "excerpt": "Ken Achenbach had a shop down on 10th Street.",
      "status": "draft"
    },
    {
      "subject_name": "Ross Rebagliati",
      "subject_type": "person",
      "resolution": "new_ghost",
      "subject_id": null,
      "timestamp_seconds": 1780,
      "excerpt": "Ross came out of the gate just wanting to be a racer.",
      "status": "draft"
    }
  ]
}
```

`resolution` values: `matched_existing` (subject_id filled),
`new_ghost` (subject_id null, importer creates it), `ambiguous` (multiple
matches; importer refuses until Jay picks a subject_id), `skip` (Jay excluded
it). The importer treats the seed as the source of truth and never re-resolves a
row Jay already set.

---

## 6. The skill (`.claude/skills/podcast-mentions/SKILL.md`)

Greenfield format (fact 3). Frontmatter: `name: podcast-mentions`, a `description`
that triggers on "podcast mentions", "index this episode", "transcript to
mentions", "drop the transcript". Instructions the skill body encodes:

1. Take the transcript text + episode identity (show + episode number or episode
   id) + media URL as inputs. If any are missing, ask for them.
2. Extract candidate mentions: for each person/place/org/board/event named,
   capture the surface name, a proposed `subject_type`, the nearest timestamp
   (from the transcript's time markers, converted to seconds via the
   `parseTimestampInput` rule), and a short verbatim excerpt.
3. Resolve each candidate against the catalog (call the importer in a
   `--resolve-only`/dry mode, or a small resolver the importer exposes) and write
   `matched_existing` / `new_ghost` / `ambiguous`.
4. Write the seed file to `podcast-seeds/<show>-ep<N>.json` and present the
   candidate list to Jay for scrub (fix names, drop noise, disambiguate, confirm
   types). The skill does NOT write to the database.
5. On Jay's go, run `node scripts/import-mentions.mjs podcast-seeds/<file> --apply`.

The skill is authoring guidance + orchestration; it must not fabricate
timestamps or excerpts (transcript-grounded only), and must respect the standing
no-em-dash rule in any copy it emits.

## 6b. The importer (`scripts/import-mentions.mjs`)
- Reads `SUPABASE_SERVICE_ROLE_KEY` + URL from `.env.local` (mirror
  `backfill-public-slug.mjs` bootstrap).
- Dry-run by default (prints planned creates/inserts/skips); `--apply` writes.
- Resolves the episode (by id, else name-within-show) and fails loudly if not
  found (episode must be authored first via the PR #144 flow).
- For each mention row, by `resolution`:
  - `matched_existing`: use `subject_id`.
  - `new_ghost`: `ilikeExact` re-check (in case it now exists), else create the
    ghost per D5 and use the new id.
  - `ambiguous` / missing subject_id: refuse the row, report it, continue.
- Inserts each mention with `status:"draft"` and `created_by` = Jay's profile id,
  SKIPPING any that already match the dedupe key (D8).
- Idempotent: re-running the same seed creates nothing new.
- Prints a summary: episode, N created ghosts, N mentions inserted, N skipped,
  N refused.

## 7. UI work
None. This session is tooling. Mentions authored as drafts surface in-app on the
episode page (Session B) once created; publishing them is the existing editor
action. (If a build-time need for a tiny admin "review drafts" affordance
surfaces, flag it; do not expand scope here.)

## 8. Out of scope (hard list)
- In-app AI or an in-app transcript upload UI (the workflow is Claude Code).
- Transcript/YouTube fetching (transcript is provided input, D4).
- Auto-publishing mentions (import lands draft; publishing is manual, D2).
- Editing the `mentions` schema or the `POST /api/admin/mentions` route.
- Bulk backfill of the full FNRad archive (that is the repeat-use GOAL of this
  tool, run per episode as data ops, not part of this build).
- Session C surfaces (public episode destination) and Session B surfaces
  (in-app mention rows).

## 9. Acceptance criteria
A1. Running the skill on the ep-21 transcript produces a seed file whose mentions
    match the verified list in `FN-Rad-Podcast-Mentions-Linestry.xlsx`
    (people/places/events/brands), each with a plausible timestamp + excerpt and
    a correct `resolution` (existing entities matched, new ones flagged
    `new_ghost`).
A2. Dry-run of the importer on that seed prints the planned ghosts + draft
    mentions and writes NOTHING.
A3. `--apply` creates the `new_ghost` people with `node_status='unclaimed'`
    (verify: they do NOT land `catalog`), and inserts the mentions with
    `status='draft'`.
A4. The imported drafts appear on the episode page for an editor (Session B
    surface) and are invisible to a signed-out visitor; none are published.
A5. Re-running `--apply` on the same seed creates zero new ghosts and zero new
    mentions (idempotent skip-existing), and reports them as skipped.
A6. An `ambiguous` row (a name matching two catalog people) is refused with a
    clear message and does not insert a dangling mention.
A7. A `new_ghost` whose name already exists in the catalog (added between
    authoring and import) resolves to the existing entity instead of creating a
    duplicate.
A8. The skill and importer emit no em dashes; `parseTimestampInput` rule mirrored
    with a "change both files" note.

## 10. Suggested order
1. Pre-flight reads (§11) + confirm the minimal ghost-insert columns per table
   against the create routes.
2. `scripts/import-mentions.mjs`: env bootstrap, episode resolve, name resolver
   (the `ilikeExact`-per-table logic), dry-run planning output. Test the resolver
   against real catalog data read-only first.
3. Ghost creation (D5) + draft mention insert with skip-existing (D8), behind
   `--apply`.
4. The seed-file format + `podcast-seeds/` dir + gitignore entry (D7).
5. `.claude/skills/podcast-mentions/SKILL.md` orchestrating transcript ->
   seed -> review -> import.
6. Acceptance A1 to A8 against the ep-21 transcript and a throwaway test episode;
   PR; Ship sequence (no migration; SHIP-LOG `type: feature`,
   `scope: podcast-transcript-mentions-skill`).

## 11. Builder pre-flight (before writing code)
- Read `scripts/backfill-public-slug.mjs` end-to-end as the script template
  (env, service-role client, dry-run/`--apply`, idempotency, mirrored-rule note).
- Read `src/app/api/admin/mentions/route.ts`, `src/lib/mentions.ts`,
  `src/lib/mentions-server.ts`, `src/app/api/public/tag/route.ts:200-240`
  (ghost-person insert shape), `src/store/lineage-store.ts:731-752`
  (`addUserPerson` shape + the node_status warning), `src/app/api/catalog/entity/route.ts`
  (non-person insert shapes + `ilikeExact`), and
  `src/app/api/admin/invite-node/route.ts` (person search technique).
- Confirm the minimal required (NOT NULL, no default) columns for a ghost insert
  in each of `people/places/orgs/boards/events`; if any needs data the seed does
  not carry, flag it (do not invent values).
- Confirm Jay's profile id / how the script gets `created_by` + `added_by` (env
  var recommended; verify at build time).
- Dev/testing runs from the worktree; the importer needs `.env.local` with the
  service-role key present in the worktree.
- Use a throwaway test episode (Brands -> + New show -> + Add episode) plus the
  ep-21 transcript as the two fixtures; clean up test ghosts + mentions after.

## 12. Post-run assertions (per import, not a migration)
```sql
-- imported drafts exist and are draft, for the target episode
select status, count(*) from public.mentions
where episode_event_id = '<episode id>' group by status;  -- expect draft rows, 0 published

-- ghosts created unclaimed, not misfiled as catalog
select node_status, count(*) from public.people
where id in (<new ghost ids>) group by node_status;  -- expect all 'unclaimed'
```
