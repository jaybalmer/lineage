# podcast-seeds

Mention seed files: one JSON file per podcast episode, named
`<show-slug>-ep<N>.json` (for example `fnrad-ep21.json`).

A seed is the capture artifact for the transcript-to-mentions workflow. An
un-imported seed is inert: nothing in it is live in the catalog, and nothing is
public. Two independent hold points sit between a transcript and a published
mention:

1. The seed file itself. Writing it creates no catalog entities and no mentions.
2. Import lands every mention as a **draft**. Drafts are editor-only. Publishing
   is a manual action on the episode page.

Real seed files are gitignored, because a scrubbed seed carries proposed catalog
data that has not been reviewed yet. `EXAMPLE.json` is committed as the format
reference and is the only JSON file in here that ships.

## Workflow

Authoring is the `podcast-mentions` skill (`.claude/skills/podcast-mentions/`).
In Claude Code: give it the transcript, the show, the episode number and the
media URL, and it writes the seed.

### In the browser (works from any computer)

Paste the seed into `/admin/podcast/import`. The page resolves it against the
live catalog server-side, renders the review surface (stories with their casts,
timecodes, trim checkboxes, near-miss decisions, the count of nodes it would
create) and imports drafts, all under a normal editor login. Nothing needs a
checkout, and the service-role key never leaves the server.

This is the same code as the script below: `src/lib/mention-import.ts` and
`scripts/import-mentions.mjs` are mirrors, so a plan reviewed one way behaves
identically the other way.

### On the command line (needs a checkout with `.env.local`)

From the repo root:

```bash
node scripts/import-mentions.mjs podcast-seeds/fnrad-ep21.json --resolve-only
```

Resolves every subject against the live catalog and writes the result back into
the seed: matched ids filled in, unknown names flagged `new_ghost`, name
collisions flagged `ambiguous` with the candidate list. No database writes.

Scrub the seed by hand: fix names, drop noise (`"resolution": "skip"`), pick a
`subject_id` for every `ambiguous` row, add the `ghost` fields a new board or
event needs.

```bash
node scripts/import-mentions.mjs podcast-seeds/fnrad-ep21.json
```

Dry run. Prints exactly what `--apply` would do and writes nothing.

```bash
node scripts/import-mentions.mjs podcast-seeds/fnrad-ep21.json --apply
```

Creates the ghosts, inserts the draft mentions, skips anything already there.
Re-running is a no-op, so a partial run is safe to repeat.

## Fields

### `episode`

Identifies the episode, which must already exist (author it in-app first:
Brands -> the show -> Add episode).

| Field | Notes |
|---|---|
| `episode_event_id` | The `events.id`. When present, it wins and the rest is context. |
| `show_name` | Used with `episode_number` (or `episode_name`) when there is no id. Must match exactly one org. |
| `episode_number` | Preferred way to find an episode within a show. |
| `episode_name` | Fallback when the episode has no number. |
| `media_url` | Context for the author. The importer does not write it. |
| `public_slug` | Context only. |

### `stories[]`

A story is one passage of the episode that carries something worth reading: what
happened, who was there, how they were connected. It has a cast, and the
importer expands it into one mention per subject, all sharing the moment and the
excerpt. That way the whole story lands on every participant's timeline instead
of the fragment that happens to name them.

| Field | Notes |
|---|---|
| `timestamp` | Where the story starts. `mm:ss` or `h:mm:ss`. |
| `title` | Short line naming what happens. For the reviewer, never written to the database. |
| `excerpt` | The story, two to six sentences, close to verbatim. This is what a reader sees. |
| `subjects[]` | Every entity the story establishes (see below). |
| `resolution` | Set to `skip` to trim the whole story and its cast in one edit. |
| `activity`, `skip_reason` | On a trimmed story, as below. |

A subject carries `subject_name`, `subject_type`, `resolution`, `subject_id`,
and optional `ghost` fields. It may override the story's `timestamp` or
`excerpt`, but rarely needs to.

The flat `mentions[]` array below still works, so seeds written before the story
format keep importing. New seeds should use `stories[]`.

### `mentions[]` (legacy flat form)

| Field | Notes |
|---|---|
| `subject_name` | The surface name from the transcript. Drives resolution. |
| `subject_type` | `person`, `place`, `org`, `board` or `event`. |
| `resolution` | `matched_existing`, `new_ghost`, `review`, `ambiguous` or `skip`. |
| `confirm_new` | `true` overrides a `review` flag: "I looked, it really is a different entity." |
| `subject_id` | Filled by `--resolve-only`, or set by hand to disambiguate. A row that already carries one is never re-resolved. |
| `candidates` | Written by `--resolve-only` on an `ambiguous` row: the ids to choose between. |
| `timestamp_seconds` | Whole seconds. |
| `timestamp` | Alternative to the above: `mm:ss` or `h:mm:ss`. Same rule as the in-app editor. |
| `excerpt` | A short verbatim quote from the transcript. Never paraphrase. |
| `ghost` | Extra columns a `new_ghost` needs (see below). Ignored for a matched row. |
| `activity` | On a trimmed row: the world it belongs to (`skateboarding`, `music`, `business`, `general`). |
| `skip_reason` | On a trimmed row: one line on why it was trimmed. |
| `status` | Always imported as `draft`. A seed saying `published` is downgraded with a warning. |

### Trimmed rows are kept, not deleted

A transcript pass captures far more than snowboarding history. Anything out of
scope is marked `"resolution": "skip"` with an `activity` and a `skip_reason`
rather than removed from the seed.

The seed is the permanent record of the pass. Keeping the trimmed candidates
means an episode never has to be re-transcribed to pull, say, its skate history
out later: when another activity or community goes live, those mentions are
already captured, timestamped and excerpted. The importer reports them grouped
by activity so you can see what is parked.

### `ghost` fields, per subject type

Most ghosts need nothing beyond the name. Two tables have a NOT NULL column with
no default, so the seed has to carry it and the importer refuses the row rather
than inventing a value:

| Type | Required | Optional |
|---|---|---|
| `person` | nothing | |
| `place` | nothing | `place_type` (default `resort`), `region`, `country` |
| `org` | nothing | `org_type` (default `brand`), `brand_category`, `country` |
| `board` | `brand`, `model`, `model_year` | `shape` |
| `event` | `start_date` (`YYYY` or `YYYY-MM-DD`) | `event_type` (default `gathering`), `year`, `place_id` |

Person ghosts land `node_status: 'unclaimed'` and `community_status:
'unverified'`, so they are claimable nodes rather than plain catalog rows. Every
created ghost is linked into the episode's community.

## Actor

The importer stamps `created_by` (mentions) and `added_by` (ghosts) with a
`profiles.id`. Set `MENTIONS_IMPORT_ACTOR_ID` in `.env.local`, or pass
`--actor <uuid>`. `--apply` refuses to run without one.

## Near misses

Exact name matching alone is not safe. The first real import wrote "Mount Baker"
while the catalog held "Mt. Baker Ski Area", found nothing, and created a second
Baker. The same happened to Nakiska, Breckenridge, Whistler and Blackcomb.

So when nothing matches exactly, the resolver looks for names that are close:
same significant tokens after normalizing abbreviations (`Mt.` to `Mount`) and
dropping words that carry no identity (`Ski`, `Area`, `Resort`, `Mountain`). A
hit lands the row as `review` with the candidates listed, and the importer
refuses it.

Resolve a `review` row one of two ways:

- set `subject_id` to the catalog entity it should point at, or
- add `"confirm_new": true` to the subject, meaning you looked and it really is
  a different thing.

The check is deliberately loose. A false flag costs one decision; a missed one
costs a permanent duplicate node that other people start linking to.
