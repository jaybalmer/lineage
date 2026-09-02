# features/

Shared feature-session tracker, the mirror of `bugs/`. Committed to git so both
Claude Code (cloud sessions) and Cowork (local staging) read and write the same
folder.

Entry points, in order:

- `NEXT-FEATURE.md` is the single entry point for a feature session, always current.
- `feature-queue.md` is the fuller queue, deferred/parked list, and recent ships.
- Ship records go in `bugs/SHIP-LOG.md` (one shared log for bugs and features).

## Keep PII and secrets out of git

Anything sensitive (reporter contact details, session URLs, internal-only notes)
lives under `features/private/`, which stays gitignored. Committed briefs
reference a feature by its `scope:` slug, not by embedding private data.
