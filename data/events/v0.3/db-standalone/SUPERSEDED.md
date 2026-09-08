# Superseded: this folder targets a greenfield schema

These files create `event_series`, `event_editions` and `event_results` as brand-new tables. They were
built and dry-run against a clean Postgres 16 before anyone had looked at the Linestry schema.

**Linestry already has `public.events` and `public.event_series`**, with `events.series_id` already
pointing at the series table, and a large ecosystem hanging off `events.id`: `story_events`,
`tag_events`, `event_people`, `event_places`, `event_boards`, `event_orgs`, `event_guests`,
`event_events`, `event_image_votes`, `place_event_images`, `mentions.episode_event_id` and
`stories.linked_event_id`. Creating a second, parallel set of event tables would fork the model.

So the real import maps the catalog INTO the existing tables. See
`features/events-catalog-import-brief.md` and `scripts/build-events-import.py`.

Kept here because two things in it are still worth reusing, and both were verified by dry run:

- `verify.sql` — the post-import assertions, which mostly port over unchanged.
- The three bugs the dry run caught, which apply to any schema in this repo:
  `placing` is a reserved word in Postgres; a uniqueness constraint over nullable columns needs
  `nulls not distinct` (Postgres 15+) or every re-run inserts duplicates instead of updating; and
  partial dates need a `date_precision` companion rather than being widened silently.
