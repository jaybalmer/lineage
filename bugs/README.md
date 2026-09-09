# bugs/

Shared bug-triage tracker. Committed to git on purpose so both Claude Code
(cloud sessions) and Cowork (local triage) read and write the same folder.

Entry points, in order:

- `NEXT-SESSION.md` is the single entry point for a bug-fix session, always current.
- `bug-triage.md` is the full queue, severity, repro notes, and hand-off note.
- `SHIP-LOG.md` is the append-only ship record every session writes one line to.

## Keep reporter PII out of git

Raw reporter data (email addresses, PostHog session URLs) does NOT go in the
committed files. It lives under `bugs/private/`, which stays gitignored.

- Committed docs reference a bug by its `BUG-NNN` id only.
- When a bug entry needs the reporter email or a PostHog replay link, put that
  in `bugs/private/BUG-NNN.md` (or a per-bug file) and reference it by id.
- `bugs/private/` is created on demand and never committed.

The pre-existing files were migrated on September 4, 2026: reporter addresses
became `R1`..`R4` / `OWNER`, PostHog replay URLs and session ids became `S-01`..`S-52`,
and the keys live in `bugs/private/reporters.md` and `bugs/private/session-ids.md`.

## Scrubbing before you commit

`python3 bugs/scrub-pii.py` rewrites any raw reporter address or PostHog session
id in `bugs/` and `features/` into its token and appends newly seen session ids
to the key. `--check` reports without writing and exits 1, so the daily triage
can gate on it. A new reporter is never guessed: add them to
`bugs/private/reporters.md` first, then re-run.

Cloud sessions have no `bugs/private/`, so the script exits 1 there rather than
reporting a false clean. Scrub on the machine that holds the keys.
