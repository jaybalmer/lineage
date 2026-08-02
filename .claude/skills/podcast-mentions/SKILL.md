---
name: podcast-mentions
description: Turn a podcast episode transcript into a reviewable mention seed file, then import it into Linestry as draft mentions. Use when asked to index an episode, turn a transcript into mentions, pull the mentions out of an episode, or when a transcript is dropped in alongside a show and episode number.
---

# Podcast mentions: transcript to draft mentions

A mention is an editor-curated pointer from an episode to a subject entity (a
person, place, brand, board or event) with an optional timestamp and a short
transcript excerpt. It surfaces on the episode page, on the mentioned entity's
timeline, and on the public episode page once published.

This skill covers the capture half: transcript in, reviewable seed file out,
then an idempotent import that lands **drafts**. It never publishes anything and
never writes to the database itself.

## Inputs

Ask for anything missing before starting:

1. **The transcript text.** Pasted or attached. Do not fetch it: there is no
   transcript or captions utility in this codebase, and a YouTube link is not a
   transcript. If only a link is given, ask for the transcript alongside it.
2. **The episode identity.** Either the `events.id`, or the show name plus the
   episode number.
3. **The media URL.** The YouTube watch URL, because timestamped links only seek
   on YouTube.

The episode must already exist in the app. If it does not, say so and point at
the in-app authoring flow (Brands -> the show -> Add episode). Do not create it.

## Step 1: find the stories, not the names

**Look for stories, not name-drops.** A mention earns its place only when it
sits inside something worth reading or listening to: something happened,
someone was there, a connection got made. A name spoken in passing is not a
mention, no matter how notable the person.

The test: read the excerpt on its own, with no other context. Does it tell you
something about who was there, what they did, or how they were connected? If
not, it does not belong in the seed.

- "I talked to Chip" is a name-drop. Discard it.
- "I went to Chip and said I want to make the West Beach Classic better" is a
  story. Keep it.

A good episode yields roughly 15 to 40 stories. If you are producing eighty,
you are indexing names instead of finding stories.

### Stories have a cast

One passage often establishes several entities at once: a road trip names the
people in the van, the mountain they drove to, and the contest they drove for.
That is **one story with several subjects**, not several unrelated mentions.

Capture each story with:

- `timestamp`: the time marker where the story starts, as `mm:ss` or `h:mm:ss`.
- `title`: a short line naming what happens, in plain words. This is for the
  person reviewing the seed, not for the database.
- `excerpt`: the story itself, two to six sentences, close to verbatim. Light
  cleanup of transcription noise is fine (stutters, repeated words, mangled
  proper nouns, filler) as long as you never add a fact, a name, or a claim
  that is not in the transcript. This is what a reader sees on the subject's
  timeline, so it has to read well on its own.
- `subjects`: every entity the story establishes, each with a `subject_name`, a
  `subject_type` (`person`, `place`, `org`, `board`, `event`), and optional
  `ghost` fields. A shop or a brand is `org`; a resort, a zone, a city or a
  venue is `place`.

The importer expands a story into one mention per subject, all sharing the
moment and the excerpt, so the whole story lands on every participant's
timeline rather than the fragment that happens to name them.

`subject_name` is the surface name as spoken, cleaned up to the form a catalog
entry would use. "Achenbach" alone becomes "Ken Achenbach" only if the
transcript establishes it elsewhere.

Hard rules:

- **Never invent a timestamp, a fact, or a name.** Everything must be grounded
  in the transcript as given. If someone is only ever called "Dad", write "Dad"
  and raise it at review rather than guessing who that is.
- **One story per moment.** The same person appearing in four stories across an
  episode is four rows, one per story. That is what makes an episode navigable,
  and it is why the dedupe index keys on the timestamp.
- Do not pad a thin moment into a story to get more coverage. Fewer, better.
- No em dashes in anything you write.

### Scope: snowboarding history, by default

These episodes range far beyond snowboarding. Import only what belongs to
snowboarding history: riders, shops, brands, resorts, terrain parks, contests,
associations, boards, and the people and places behind them.

Everything else is **trimmed, not dropped**. A trimmed candidate stays in the
seed with `"resolution": "skip"` plus two fields recording why:

- `activity`: the world it belongs to (`skateboarding`, `surfing`, `music`,
  `business`, `general`, and so on). Use `general` for biographical or
  incidental references that belong to no activity.
- `skip_reason`: one short line, so the call is legible later.

This matters because the seed is the permanent record of the transcript pass.
An episode should never need re-transcribing to pull its skate history out
later: when another activity or community goes live, its mentions are already
captured, timestamped and excerpted, waiting in the seed. Deleting a candidate
throws that away. Never delete one.

Things that are usually out of scope for snowboarding: skateparks, skate
contests and skate organizations; general-interest people and companies named
in passing; hometowns and biographical detail with no riding attached.

Things that stay in scope even though they look adjacent: a skate shop that
also sold snowboards, an indoor park that sponsored a mountain's terrain park,
a person who crossed over. If a mention is load-bearing for the snowboarding
story, keep it.

## Step 2: write the seed

Write `podcast-seeds/<show-slug>-ep<N>.json` as a `stories` array, in the format documented in
`podcast-seeds/README.md`, with `EXAMPLE.json` beside it as the reference. Set
every row's `resolution` to `new_ghost` and `subject_id` to null for now: the
next step fills them in.

Real seed files are gitignored. Do not commit one.

## Step 3: resolve against the catalog

```bash
node scripts/import-mentions.mjs podcast-seeds/<file>.json --resolve-only
```

This writes resolutions back into the seed and touches no database rows. Each
row comes back as:

- `matched_existing` with a `subject_id`: the name matched exactly one catalog
  entity.
- `new_ghost`: no match. The importer will create an unclaimed entity on apply.
- `ambiguous` with a `candidates` list: the name matched more than one. It is
  never auto-picked.

## Step 4: hand the list back for review

Present the candidates as a compact table: name, type, timestamp, resolution,
and the excerpt trimmed to a line. Call out explicitly:

- every `ambiguous` row, with its candidates, because import refuses them until
  a `subject_id` is set by hand;
- every `new_ghost` of type `board` or `event`, because those need extra `ghost`
  fields before they can be created (`brand` + `model` + `model_year` for a
  board, `start_date` for an event) and are otherwise refused;
- every name you had to infer from context rather than read in the transcript,
  because a wrong inference mints a wrong catalog node;
- the count of new entities the import would create, since each one is a
  permanent catalog node;
- what you trimmed and under which `activity`, so the scope call is visible;
- anything you were unsure about typing.

Apply the review edits to the seed: fix names, set `"resolution": "skip"` with
an `activity` and `skip_reason` on rows to trim, pick `subject_id` on ambiguous
rows, add `ghost` fields.

Then dry-run to confirm the plan:

```bash
node scripts/import-mentions.mjs podcast-seeds/<file>.json
```

## Step 5: import, on an explicit go-ahead

```bash
node scripts/import-mentions.mjs podcast-seeds/<file>.json --apply
```

This creates the ghosts and inserts the mentions as **drafts**. Drafts are
editor-only: they do not reach the public episode page or anyone's public
timeline. Re-running is a no-op.

Report the summary counts and finish by saying the mentions are drafts and that
publishing them is a manual action on the episode page. Do not offer to publish
them: this workflow deliberately stops at draft.

## What this skill does not do

- It does not write to the database. Only `scripts/import-mentions.mjs --apply`
  does, and only when asked.
- It does not publish mentions.
- It does not create shows or episodes.
- It does not fetch transcripts.
