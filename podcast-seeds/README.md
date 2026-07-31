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

Then, from the repo root:

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

### `mentions[]`

| Field | Notes |
|---|---|
| `subject_name` | The surface name from the transcript. Drives resolution. |
| `subject_type` | `person`, `place`, `org`, `board` or `event`. |
| `resolution` | `matched_existing`, `new_ghost`, `ambiguous` or `skip`. |
| `subject_id` | Filled by `--resolve-only`, or set by hand to disambiguate. A row that already carries one is never re-resolved. |
| `candidates` | Written by `--resolve-only` on an `ambiguous` row: the ids to choose between. |
| `timestamp_seconds` | Whole seconds. |
| `timestamp` | Alternative to the above: `mm:ss` or `h:mm:ss`. Same rule as the in-app editor. |
| `excerpt` | A short verbatim quote from the transcript. Never paraphrase. |
| `ghost` | Extra columns a `new_ghost` needs (see below). Ignored for a matched row. |
| `status` | Always imported as `draft`. A seed saying `published` is downgraded with a warning. |

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
