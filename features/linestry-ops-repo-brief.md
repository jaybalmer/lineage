# linestry-ops: the ops repo and PII scrub (the cloud + operator unlock)

> Cowork-authored ops brief, September 9 2026. Multi-step, part local and part
> GitHub. NO product-code migration. This is the single change that unpins the
> operating layer from the laptop and gives an outside operator (Dogu/Stambol) a
> place to attach. Source of the plan: `Operations/online-operating-model-scoping-2026-08-17.md` (Layer 1).
>
> Run the code-moving parts in a LOCAL Claude Code session. Repo creation and
> secrets are Jay's, in the browser and terminal.

---

## Why this is first among the cloud work

The intent brief wants cloud execution. The scoping doc's finding holds: the
product is already fully cloud-native; it is the OPS layer that is laptop-pinned,
and the biggest single binding is that `bugs/` and `features/` are gitignored
local-only because they hold reporter emails and PostHog session ids. Consequences:
the entire operational state lives on one disk with no backup, a cloud clone
cannot read the queues at all, and no outside agent can attach.

You cannot host the schedules or the loop (brief 4) until the queue state lives
somewhere a hosted runner can read without shipping personal data into a repo.
So this comes before brief 4. It needs no infrastructure change and is mostly a
move plus a scrub rule.

---

## DECISIONS (review before building)

**D1. Separate private repo `linestry-ops`, not a folder inside `lineage`. DEFAULT: yes.**
Splitting lets the ops repo keep its own access control and scrub rule so
`lineage` can stay clean and open to future collaborators while ops stays tight.
Structure per the scoping doc:
```
linestry-ops/
  queues/     bug-triage.md, feature-queue.md, NEXT-SESSION.md, NEXT-FEATURE.md
  briefs/     session briefs, active and archived
  log/        SHIP-LOG.md, RUN-LOG.md, morning digests
  runbooks/   how each recurring job runs and how to run it by hand
  docs/       operating model, decision records, the audit
  CLAUDE.md   entry point: what this repo is, how an agent should use it
```

**D2. PII is scrubbed to opaque ids at INTAKE, mapping held in Supabase. DEFAULT: yes.**
Reporter emails become `reporter:a91f`, PostHog session ids become `replay:7c2e`,
in the committed files. The mapping lives in Supabase (already the right home for
personal data, already RLS-protected, already holds `bug_reports` with those
columns). This is the thing that makes the whole directory shareable. The repo
already has `bugs/scrub-pii.py`; extend it rather than write a new one (it already
tokenizes reporters R1..R4/OWNER and sessions S-nn using keys in `bugs/private/`).
The change is to move the mapping's canonical home into a Supabase table so a
hosted runner (no `bugs/private/`) can resolve and assign tokens too.

**D3. `lineage` stops being an ops surface. DEFAULT: yes, but staged.**
End state: the triage task, the digest task, and `auto-bugfix.sh` read and write
queues in `linestry-ops`, not in `lineage/bugs` and `lineage/features`. To avoid a
flag-day, stage it: (a) create the repo and copy the current queues in, (b)
repoint the Cowork triage + digest tasks to write there, (c) repoint
`auto-bugfix.sh` to read `NEXT-SESSION.md` from there, (d) only then delete the
in-repo copies. Keep a one-line pointer stub in `lineage/bugs/README.md` naming the
new home.

**D4. Do NOT move `.env.local` or any secret into the ops repo. DEFAULT: yes.**
The Supabase service-role key stays on the server, standing rule. The ops repo
holds queues, briefs, logs, runbooks, docs. No credentials, ever.

---

## Tasks (suggested order)

**T1. Create the private repo.** Jay creates `jaybalmer/linestry-ops` (private) on
GitHub. Add the six top-level folders and a `CLAUDE.md` entry point describing what
the repo is and how an agent should use it (read `queues/NEXT-SESSION.md` for the
bug lead, `queues/NEXT-FEATURE.md` for the feature lead, never write PII).

**T2. Supabase mapping table.** Add a `ops_pii_map` table (or reuse a column on the
existing `bug_reports`): `token text primary key, kind text, raw_value text,
created_at timestamptz`. RLS: service-role only. This is the canonical token
mapping. One additive migration in the `lineage` repo's Supabase (not product
surface, but it is a DB change, so it follows the normal migration gate).

**T3. Extend `scrub-pii.py`.** Make it read/write the mapping from Supabase (via the
service-role key on the machine that has it) with the local `bugs/private/` files
as a fallback/cache. Preserve `--check` (exit 1 on unresolved). Confirm it still
stops rather than guess an unknown reporter.

**T4. Copy queues in and scrub.** Copy the current `bugs/` and `features/` contents
into `linestry-ops/queues|briefs|log`, run the extended scrub over everything, and
commit. Verify no raw email or UUIDv7 session id remains (`scrub-pii.py --check`
clean).

**T5. Repoint the writers.** Update the Cowork triage task, the Cowork digest task,
and `scripts/auto-bugfix.sh` to read/write the ops repo paths. For auto-bugfix,
this is the `NS="bugs/NEXT-SESSION.md"` reference and the RUN-LOG/SHIP-LOG paths;
point them at a local clone of `linestry-ops` (an env var `OPS_REPO` is cleanest).

**T6. Write the runbooks.** One short runbook per recurring job (triage, digest,
standup, auto-fix): what it does, its schedule, how to run it by hand, how to pause
it. This is the artifact Dogu's operators read to understand the system.

**T7. Retire the in-repo copies.** Once T5 is verified for a couple of days, delete
`lineage/bugs/*` and `lineage/features/*` working files (leave the README pointer),
and drop the `.gitignore` entries that are no longer needed. This closes the
"entire ops state on one disk" binding.

---

## Acceptance criteria

1. `git clone linestry-ops` on a machine with no `bugs/private/` yields readable
   queues with only opaque tokens, no emails, no raw session ids.
2. `scrub-pii.py --check` exits 0 against the committed ops repo.
3. A new bug intake run writes the tokenized report into `linestry-ops/queues`,
   assigns a new token, and stores the mapping in Supabase.
4. `auto-bugfix.sh` reads its lead from the ops repo and a full `--dry-run`
   completes end to end.
5. No secret or `.env.local` value appears anywhere in `linestry-ops` history.

## Risks and gotchas

- **R1. The scrub must run on the machine holding the key.** A cloud/bridge session
  has no service-role key and no `bugs/private/`, so it must NOT be the thing that
  commits tracker edits; it prepares a branch and Jay (or a hosted job with a
  scoped credential) commits. This is the same constraint the current setup has.
- **R2. Do not flag-day the move.** Stage T1 to T6, verify, then T7. A single
  repoint that misses one writer strands the queue in two places.
- **R3. History hygiene.** If any raw PII was ever committed to `lineage` under
  `bugs/`, note it: git history is permanent. The scrub protects new commits; a
  history rewrite of `lineage` is out of scope here and should be a separate,
  deliberate decision.
- **R4. This touches four writers** (triage, digest, auto-fix, and both
  dashboards). Inventory them before T5 so none is missed. Two of them are Cowork
  desktop scheduled tasks whose definitions live in the desktop app, so repointing
  them is a Cowork change, not a repo edit; do that in a Cowork session.

## Ship sequence

One additive Supabase migration (T2) in `lineage`, gated normally. The rest is repo
and task wiring, no product surface. Run the code parts in a LOCAL Claude Code
session; the repo creation, the migration apply, and the Cowork task repointing are
attended.

## What Jay does (gated, human-only)

1. Create the private `jaybalmer/linestry-ops` repo on GitHub.
2. Apply the `ops_pii_map` migration in Supabase when the session surfaces the SQL.
3. Repoint the two Cowork scheduled tasks (triage, digest) in a Cowork session to
   the ops repo paths (a build session cannot edit desktop scheduled tasks).
4. After a couple of clean days, approve the T7 deletion of the in-repo copies.
5. This is the artifact to send Dogu: give him read access to `linestry-ops` and
   walk the open questions in the scoping doc §8.
