# Podcast Mentions Foundation (Session B of the podcast pass)

> **Build-ready Claude Code handoff. Drafted July 31, 2026 (Cowork, Jay live).**
> Source chain: Jay's July 30 note drop -> `features/podcast-episode-pass-notes.md`
> (the synthesis) -> this brief. Session A (the quick-fix cluster + equity
> extension) already SHIPPED as PR #167, merged July 30. This is the second wave:
> the mentions data model, the editor entry surface, and the MentionRow renderer
> on episode and person timelines.
>
> **Size: ~4 to 6 hr. One migration (new additive table, `20260731000001_mentions.sql`).**
> No existing write path touches the new table, so this is NOT a hard pre-merge
> gate; default ordering still applies (migrate first, then merge). No `_public`
> view involvement (new table, reads go through its own API with an explicit
> status filter).
>
> Pre-flight playbook: the 24-check schema/code-path playbook was applied at
> drafting time against the live repo (July 31). Verified facts in §3 carry
> file:line provenance. Anything not verified is tagged "verify at build time".

---

## 0. What this delivers

Every podcast mention of a person (or place, brand, board, event) becomes an
"audio memory": a small, expandable row that says who was mentioned, on which
episode, at what timestamp, with the transcript excerpt and a YouTube link that
opens at that moment. Rows appear in two places this session:

1. **The episode page** (`/events/[id]` for `event_type='episode'`): a Mentions
   section listing everything mentioned in that episode, timestamp order.
2. **The mentioned person's timeline** (`/people/[id]`): a compact MentionRow in
   the decade bucket of the episode date ("Mentioned on FNRad #142").

Editors curate mentions from the episode page. This is the foundation the
Session D transcript skill will write into (drafts via a seed import), and the
activation substrate for the FNRad Season 12 sponsorship (browsable mentions
with listener contribution is a committed activation item in the proposal).

---

## 1. DECISIONS (review before building)

Locked by Jay (July 31, Cowork session):

- **D1. Dedicated `mentions` table** (Option B from the notes), NOT a story
  kind column. Curation workflow and many-subjects-per-episode fan-out fit a
  table; the "story post per episode" remains a normal story linked to the
  episode.

Defaults (shippable as-is; Jay can override in review):

- **D2. Status model: `draft | published`.** Editor-only writes. Manual adds
  from the modal default to `published`; `draft` is the landing state for the
  future transcript-skill seed import (Session D). Drafts are invisible to
  non-editors everywhere; editors see them with a muted "Draft" badge on the
  episode page (never on person timelines, to keep the public surface honest).
- **D3. No PB-009 tag_events involvement.** Mentions are editor-curated
  third-party artifacts, mirroring the `event_guests` and `story_places`
  control model (editor removal rights, no moderation pipeline). Person
  subjects do NOT create tag_events or inbox items. If a member ever objects to
  a mention, an editor deletes it. An owner-facing "hide this mention" toggle is
  deliberately deferred; flag to Jay if this feels wrong before building.
- **D4. Timeline placement: the episode's `start_date`** positions the row
  (padded through `dateToSortNum`, so year-only episode dates bucket correctly).
  Node color on the timeline spine: `bg-fuchsia-500`, matching the episode
  accent already used on the episode page header label.
- **D5. FeedView gets a "Mentions" filter chip**, added to `FILTER_LABELS`
  after Stories. Mentions also render under All. If the chip turns out to fight
  the chip-row width at 375px, drop the chip and keep All-only rendering (note
  the drop in the ship log).
- **D6. Dedupe key: `(episode_event_id, subject_type, subject_id, coalesce(timestamp_seconds, -1))`**
  unique index. The same subject CAN be mentioned at two different timestamps;
  an exact duplicate POST returns 409 with the existing id (map Postgres 23505).
- **D7. Surfaces this session: episode page + `/people/[id]`.** The own-profile
  timeline (`/profile`) is a should-have: add the same fetch there IF it drops
  in cleanly after the pre-flight read; otherwise defer and note it. Other
  entity pages (places, brands, boards, events) and the public `/t/` surfaces
  are Session C scope and out of scope here (see §7).
- **D8. All five subject types accepted at schema and API level**
  (`person | place | org | board | event`), but only person subjects get a
  timeline surface this session. Non-person mentions still render in the
  episode page list (as entity chips), so nothing entered is invisible.

---

## 2. Why now

- FNRad Season 12 starts ~August 2026; Linestry is presenting sponsor and the
  proposal commits "browsable mentions (riders/boards/places/events/brands)"
  plus the weekly per-episode entity spotlight. This table is that feature's
  substrate.
- The Session D transcript skill (drop a YouTube link, get a scrubbed mention
  list) cannot be designed until this schema is real.
- Session A (PR #167) fixed the sharp edges on the shipped episode surfaces;
  the episode pages are now safe to build on.

---

## 3. Verified facts (July 31, live repo, file:line provenance)

1. An episode IS an Event: `event_type: "episode"`, fields `show_org_id`,
   `media_url`, `episode_number`, `public_slug`, `public_enabled` at
   `src/types/index.ts:424-435`. A show IS an Org (`org_type: "media"`).
2. `events.id` is text (mixed-type catalog ids); catalog person ids are ALSO
   mixed-type (~29 non-uuid people remain). The `event_guests` precedent
   (`supabase/migrations/20260629000002_fnrad_featured_timelines_phase1.sql:97-107`)
   uses `event_id text` with FK to events, and `person_id text` with NO FK
   (people live across people + profiles). `mentions` follows exactly this
   pattern: FK on the episode side, no FK on the subject side.
3. Episode page: `src/components/events/episode-page.tsx` (238 lines),
   rendered from `src/app/(community)/[community]/events/[id]/page.tsx:712`
   when `event_type === "episode"`. Editor controls row at L162-183 (curate,
   publish toggle, preview, copy link). Section order: header, media embed
   (L187-205), Featured set (L207-225), `EpisodeConnections` (L228). The
   Mentions section slots between Featured set and EpisodeConnections.
4. FeedView: `src/components/feed/feed-view.tsx` (404 lines). `FeedItem` is a
   discriminated union (`claim | day | story | riding_start`) each carrying
   `sortDate`; `nodeColor()` keys the spine dot; `FILTER_LABELS` drives the
   chip row; grouping via `dateToSortNum` / `groupByDecade` from
   `src/lib/timeline-grouping.ts` (pure helpers, BUG-010 partial-date padding).
5. Person page: `src/app/people/[id]/page.tsx` (759 lines) already runs
   parallel story fetches at L156-168 (`author_id` + `rider_id` unioned by id)
   and passes FeedView at L665. The mentions fetch joins this pattern, keyed on
   the same `resolvedId`.
6. `parseYouTubeId` at `src/lib/utils.ts:151` handles watch / youtu.be / embed /
   shorts URLs. Timestamped link: `https://www.youtube.com/watch?v={id}&t={seconds}s`.
7. `SearchPicker` exists at `src/components/ui/search-picker.tsx` (extracted in
   the Story Connections build) for the subject picker.
8. Auth helpers: `requireEditor` at `src/lib/auth.ts:56`; the guests route
   (`src/app/api/events/[id]/guests/route.ts`) is the API pattern to mirror
   (public GET via service client, editor-gated writes).
9. Latest migration is `20260730000001_story_date_precision.sql`; this session
   creates `20260731000001_mentions.sql`.
10. No "mentions" concept exists anywhere in the codebase (grep verified; the
    only hits are incidental words in copy and a digest pref name).
11. Forward-warning grep over the touched surfaces returned only the Phase 2
    header comment in `episode-page.tsx:3`. No TODO/FIXME landmines.
12. Prod data note: the real FNRad show + episodes are NOT yet seeded (the seed
    working session is still pending on the sponsorship side). Build-time
    testing creates its own test show + episode via the in-app authoring
    (Brands -> + New show -> + Add episode) and deletes them after.

---

## 4. Migration: `supabase/migrations/20260731000001_mentions.sql`

Verified against the `event_guests` conventions. One open item for the builder:
check what RLS treatment `20260629000002` gave `event_guests` (and whether the
`20260623000001_rls_enable_flagged_tables.sql` pattern applies) and mirror it;
all reads and writes go through the service client, so RLS is defense in depth
here, not the access path.

```sql
-- Podcast pass Session B: mentions foundation.
-- A mention is an editor-curated pointer from an episode (an Event with
-- event_type='episode') to a subject entity, with an optional timestamp and
-- transcript excerpt. Draft rows are the landing state for the future
-- transcript-skill seed import.

create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  -- text to match events.id (mixed-type catalog ids), FK like event_guests.
  episode_event_id text not null references public.events(id) on delete cascade,
  subject_type text not null
    check (subject_type in ('person','place','org','board','event')),
  -- no FK: person ids are mixed-type and live across people + profiles,
  -- matching event_guests.person_id and public_stack_entries.entry_ref_id.
  subject_id text not null,
  timestamp_seconds integer check (timestamp_seconds is null or timestamp_seconds >= 0),
  excerpt text,
  status text not null default 'published'
    check (status in ('draft','published')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- D6 dedupe: same subject at the same timestamp in the same episode is one row.
-- coalesce lets the "no timestamp" case dedupe too.
create unique index if not exists mentions_dedupe
  on public.mentions (episode_event_id, subject_type, subject_id,
                      coalesce(timestamp_seconds, -1));

-- Subject-side timeline reads (published only).
create index if not exists mentions_subject
  on public.mentions (subject_type, subject_id)
  where status = 'published';

-- Episode-page reads, timestamp order.
create index if not exists mentions_episode
  on public.mentions (episode_event_id, timestamp_seconds);
```

Rollback recipe: `drop table if exists public.mentions;` (nothing else
references it).

---

## 5. Types (`src/types/index.ts`)

```typescript
export type MentionSubjectType = "person" | "place" | "org" | "board" | "event"

export interface Mention {
  id: string
  episode_event_id: string
  subject_type: MentionSubjectType
  subject_id: string
  timestamp_seconds?: number | null
  excerpt?: string | null
  status: "draft" | "published"
  created_by?: string | null
  created_at: string
  updated_at: string
  // Joined episode context (populated by GET /api/mentions)
  episode?: {
    id: string
    name: string
    start_date?: string
    episode_number?: number | null
    media_url?: string | null
    show_org_id?: string | null
    show_name?: string | null
  }
}
```

---

## 6. API routes + endpoint-to-surface pairing

| Endpoint | Auth | UI trigger location | Affordance |
|---|---|---|---|
| `GET /api/mentions?episode_id=X` | public read, published only; `?include_drafts=1` honored ONLY for editor sessions | episode page Mentions section | auto-fetch on mount |
| `GET /api/mentions?subject_type=person&subject_id=Y` | public read, published only | `/people/[id]` timeline fetch block (L156 area) | auto-fetch with the story fetches |
| `POST /api/admin/mentions` | `requireEditor` | MentionEditorModal on the episode page | "Add mentions" button in the editor controls row (L162-183) |
| `PATCH /api/admin/mentions/[id]` | `requireEditor` | MentionEditorModal in edit mode | pencil affordance on each row, editors only |
| `DELETE /api/admin/mentions/[id]` | `requireEditor` | episode page mention row | "Remove" (editor moderation verb, playbook check 15) |

Route notes:

- GET joins episode context server-side: fetch the mention rows, then one
  `events` query for the distinct `episode_event_id`s (name, start_date,
  episode_number, media_url, show_org_id), then one `orgs` query for show
  names. Three flat queries; do NOT rely on PostgREST embedded selects across
  the text FK (playbook check 5).
- POST accepts a single object or `{ mentions: [...] }` (bulk, for
  save-and-add-another and the future seed import). On unique violation
  (23505) return 409 with the existing row's id.
- PATCH allows `timestamp_seconds`, `excerpt`, `status`, `subject_type`,
  `subject_id`. DELETE hard-deletes (curation artifact, no tombstone).
- The word "mention" needs no per-community noun mapping this session.

---

## 7. UI work

### 7a. `MentionRow` (new, `src/components/feed/mention-row.tsx`)

One component, two voices via a `context` prop (playbook check 18: voice
verified per surface, no "you" leakage):

- `context="timeline"` (person page): collapsed row reads
  `Mentioned on {show_name} #{episode_number}` with the episode name and date
  line; expanding reveals the excerpt as a quote block plus
  `Watch at {mm:ss}` (opens the timestamped YouTube link in a new tab) or
  `Open episode` when there is no timestamp or no parseable media_url. The
  row links to the episode page.
- `context="episode"` (episode page): the subject leads: entity chip (person
  chip via the existing avatar/chip patterns, other types via `entity-chip`),
  `{mm:ss}` pill, excerpt below when expanded. Editors additionally see the
  Draft badge (muted, with a title tooltip "Only editors can see this"), the
  edit pencil, and Remove.

Compact row styling, NOT a `.postcard`. Timestamp format helper `mm:ss` (or
`h:mm:ss` above one hour) lives beside the component or in utils.

### 7b. Episode page section (`src/components/events/episode-page.tsx`)

New "Mentions" section between Featured set (L207-225) and EpisodeConnections
(L228). Published rows in `timestamp_seconds` ascending order (nulls last,
then `created_at`). Editors: "Add mentions" button in the editor controls row
opens the MentionEditorModal; empty state mirrors the featured-set empty state
("No mentions mapped yet. Add mentions ->" for editors, hidden entirely for
non-editors when the list is empty).

### 7c. `MentionEditorModal` (new)

Editor-only. Fields: subject type tabs (Riders default), `SearchPicker` for
the subject, timestamp input accepting `12:34` or raw seconds (parse both;
optional), excerpt textarea (optional), status toggle (Published default per
D2). Primary action "Save", secondary "Save + add another" which keeps the
modal open and clears subject + timestamp + excerpt (bulk entry friendly).
Edit mode: pass the existing mention, PATCH on save.

### 7d. FeedView + person page

- `FeedView` accepts `mentions?: Mention[]`; each becomes
  `{ kind: "mention", mention, sortDate: dateToSortNum(m.episode?.start_date) }`.
  Spine dot `bg-fuchsia-500` (D4). Chip "Mentions" added to `FILTER_LABELS`
  after Stories (D5); the mention kind is included under All.
- `/people/[id]/page.tsx`: add the subject GET beside the existing story
  fetches (L156-168), keyed on `resolvedId`, published only; pass through to
  FeedView at L665. Zero mentions must render the page byte-identical to
  today (acceptance A9).
- `/profile` (own timeline): should-have per D7. Whole-file pre-flight read
  first; if its fetch block mirrors the person page, add the same fetch,
  otherwise defer with a note.

---

## 8. Out of scope (hard list)

- Public `/t/[slug]` surfaces (episode, show, or person): Session C.
- Place / brand / board / event entity-page mention sections: Session C.
- Auto-surfaced tagged stories on public episode pages (F2): Session C
  (decision already locked: yes, auto-surface).
- Scheduled release / `publish_at` (F3): Session C.
- The transcript-to-mentions skill + seed import (F5): Session D, designed
  against this schema once it is real.
- Member-submitted mentions, moderation pipeline, owner hide toggle (D3).
- Audio playback, non-YouTube timestamp links.
- Any backfill of existing episodes (the archive pass is a Session D goal).
- Media community type (F4): recommendation against stands; not in this pass.

---

## 9. Acceptance criteria

A1. Migration applies clean; `information_schema` shows `mentions` with the
    dedupe unique index; `select count(*) from mentions` returns 0.
A2. Editor on an episode page adds a person mention with timestamp + excerpt
    via the modal; it appears in the Mentions section in timestamp order
    without a reload (refetch on save).
A3. The same mention appears on that person's `/people/[id]` timeline as a
    compact MentionRow in the decade bucket of the episode's start_date,
    reading `Mentioned on {show} #{n}` in third-person-safe voice.
A4. Expanding the row shows the excerpt; `Watch at {mm:ss}` opens YouTube at
    the right offset (verify with a real timestamped link).
A5. A draft mention is invisible to a signed-out visitor and to a non-editor
    member on BOTH surfaces; an editor sees it on the episode page with the
    Draft badge. Publishing it via the pencil makes it public.
A6. A non-person mention (e.g. a board) renders in the episode page list as
    an entity chip row; it does NOT appear on any timeline surface.
A7. Exact duplicate add (same episode, subject, timestamp) returns 409 and
    the UI surfaces "Already mapped" instead of a silent second row.
A8. `Save + add another` keeps the modal open and lands both rows.
A9. A person with zero mentions renders `/people/[id]` exactly as today; the
    Mentions chip shows only when the timeline actually contains mentions
    (mirror how the Stories chip handles emptiness; verify at build time and
    match the existing chip behavior, whichever it is).
A10. `npx tsc --noEmit` clean; no em dashes in any new user-visible string.

---

## 10. Suggested order

1. Pre-flight reads (§11), then the migration file; apply to prod (migrate
   first, then merge is fine here).
2. Types + `GET /api/mentions` + `POST /api/admin/mentions` (the vertical
   slice; test with curl against a hand-inserted row first).
3. Episode page section + MentionRow (`context="episode"`) + editor modal.
4. PATCH / DELETE + draft badge + edit pencil.
5. FeedView mention kind + chip + person page fetch (`context="timeline"`).
6. `/profile` should-have (D7), if clean.
7. Acceptance pass A1 to A10, tsc, PR, Ship sequence (surface the migration
   SQL in chat, wait for apply confirmation, prompt the merge, SHIP-LOG entry
   with `type: feature`, `scope: podcast-mentions-foundation`).

## 11. Builder pre-flight (before writing code)

- Whole-file reads: `episode-page.tsx`, `feed-view.tsx`,
  `people/[id]/page.tsx`, `api/events/[id]/guests/route.ts` (the route
  pattern), `search-picker.tsx` (its props contract), and `/profile`'s page
  file for D7.
- Check `event_guests` RLS treatment in `20260629000002` and mirror it for
  `mentions`.
- Confirm chip-row fit at 375px with the extra Mentions chip (D5 fallback).
- Test data: create a throwaway show + episode via Brands -> + New show ->
  + Add episode (in-app authoring, PR #144); delete both after the
  acceptance pass. Real FNRad seeding is a separate, pending working session.
- Dev server for smoke runs from the worktree path, NOT `~/lineage`
  (playbook check 20). Stop any stale dev server first so port 3000 binds
  to the worktree instance.

## 12. Post-deploy assertions

```sql
-- table + index landed
select indexname from pg_indexes where tablename = 'mentions';
-- expect mentions_pkey, mentions_dedupe, mentions_subject, mentions_episode

-- nothing but test rows during the acceptance pass
select count(*) from public.mentions;  -- expect 0 after test cleanup
```

Both verified trivially true-by-construction (new table); no assertion can be
noisy on day one (playbook check 9 satisfied by construction).
