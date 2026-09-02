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

Before the first commit of any pre-existing file here, move inline reporter
emails and session URLs into `bugs/private/` so they do not enter git history.
