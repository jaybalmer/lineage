# Ops Tree Hygiene: stop the ops loop from blocking the code pipeline

> Cowork-authored ops brief, September 8 2026. Self-contained. ~30 to 45 min,
> ONE PR, NO migration. Changes `scripts/auto-bugfix.sh` plus one paragraph of
> repo `CLAUDE.md`, and performs one one-time git commit that finishes PR #214.
>
> **This is not product work.** It repairs the reason the 05:00 unattended run has
> aborted on nine of the last ten mornings while two pipeline-safe bug briefs sat
> ready. Do it before the next feature session, not after: it is short, and every
> day it waits is another dead overnight slot.

---

## DECISIONS (review before building)

**D1. The auto PR contains product code only. Nothing from `bugs/` or `features/` ever enters it. DEFAULT: yes.**
Today `git add -A` (line 261) stages everything and then subtracts only the
paths that were untracked at preflight. That worked while almost nothing under
`bugs/` was tracked. It stops working the moment T3 tracks all 60 files, because
then every tracker edit is a tracked change and would ride into the next bug PR.
Excluding those two directories unconditionally gives a hard seam: **the auto PR
diff is always `src/` and friends, never ops.** It also makes the existing
`RISKY_PATTERNS` check cleaner, since it stops scanning prose.

**D2. The wrapper commits ops dirt itself, at preflight. DEFAULT: yes. This is the load-bearing decision.**
Jay's framing was "either the bug session deals with it, or it gets cleaned up
before the bug session runs." This is the second, and it is the one that holds,
because it does not depend on anybody remembering. At preflight the wrapper
commits anything dirty under `bugs/` and `features/` as a `chore(ops)` commit,
then proceeds with a clean tree.

The alternative, "Cowork commits its own writes at the end of every session," was
the stated preference and it is still worth doing where possible, but it **cannot
be the mechanism**, for a concrete reason: the Cowork sandbox can create files
under `.git` but cannot unlink them. That is why `git status` from a Cowork run
strands a `.git/index.lock` (the August 18 blocker, and again today at 16:16). A
process that cannot remove `index.lock` cannot be relied on to complete a commit.
The wrapper runs on Jay's Mac with real permissions and has no such limit. So the
wrapper is the mechanism and Cowork discipline (T5) is the backup.

**D3. Ops dirt is logged, not silent. DEFAULT: yes.**
The run prints what it auto-committed. If Cowork ever writes something under
`bugs/` that is genuinely wrong, it should be visible in the log and in git
history, not swallowed.

**D4. Real code dirt still blocks, unchanged. DEFAULT: yes.**
The whole point of the existing guard is "do not touch Jay's in-progress work."
That stays exactly as it is for every path outside `bugs/` and `features/`. A
half-finished edit in `src/` still aborts the run, and should.

**D5. Do NOT add a lock sweep. It already exists. DEFAULT: change nothing here.**
`scripts/auto-bugfix.sh:155-169` already clears a zero-byte `.git/index.lock`
older than `LOCK_STALE_SECONDS` (600) when no git process is live, and fails loud
otherwise. That is the August 19 fix and it is correct. The lock Cowork strands
mid-afternoon is therefore already handled by the time the 05:00 run starts. The
residual cost is only to Jay running git by hand before then, which T6 addresses
with a note rather than code.

---

## 1. Why this, why now

`scripts/auto-bugfix.sh:175` blocks the run on any modified or staged **tracked**
file. Untracked files were already exempted in the August 19 revision, and that
was the right call.

The problem is what is tracked. **Git tracks exactly three files under `bugs/`
and `features/`:**

```
bugs/README.md
features/README.md
features/events-catalog-import-brief.md
```

Everything else, all 60 trackers and briefs, is untracked. PR #214 un-ignored the
two directories but only committed the two READMEs; `features/events-catalog-import-brief.md`
arrived separately with PR #239 because a build session committed its own brief.

Cowork writes into those directories every day: the 04:06 triage rewrites
`bug-triage.md` and `NEXT-SESSION.md`, the 07:15 digest rewrites three more and
archives shipped briefs, and drafting sessions add new ones. **Most days that
touches only untracked files and the pipeline is fine. Some days it touches one
of the three and the pipeline dies until someone notices.** That is why it looks
random from the outside and why cleaning up at the end of a day does not hold:
the next morning's triage re-dirties the tree at 04:06, fifty-four minutes before
the run.

Today's two blocking files are both ops, and both are Cowork's:

- `M bugs/README.md`, documentation of `scrub-pii.py` written September 4, never committed.
- `D features/events-catalog-import-brief.md`, **archived by this morning's digest**, which happened to move one of the three tracked files.

Nine of the last ten 05:00 slots aborted. Eight of those were this exact message.

---

## 2. Prerequisites

**P1.** `rm ~/lineage/.git/index.lock` if it is still present. Cowork stranded a
zero-byte lock at 16:16 on September 8. The wrapper clears it automatically, but
manual git in the repo fails until it is gone.

**P2.** Pull `main`. Tip at drafting was `f0cc660` (PR #246).

**P3.** Run from `~/lineage`.

**P4.** Read `scripts/auto-bugfix.sh:15-40` first. It is the design note for the
August 19 revision and it explains the classification the wrapper already does.
This brief extends that reasoning rather than replacing it; keep the comment
block coherent by adding a short September 8 paragraph to it (T4).

---

## 3. Task specs

### T1. Ops-blind gate (`scripts/auto-bugfix.sh`, around line 175)

Replace the single `TRACKED_DIRT` read with a split: ops paths are separated out
and reported, everything else still blocks.

```bash
# Ops paths. Cowork writes these every day (triage 04:06, digest 07:15, brief
# drafting). They are prose, not product code, and they must never block a code
# run. See features/ops-tree-hygiene-brief.md.
OPS_PATHS=(bugs features)

# BLOCKING: modified or staged TRACKED files OUTSIDE the ops paths. That is
# genuine in-progress work and the run must leave it alone.
TRACKED_DIRT="$(git status --porcelain --untracked-files=no -- . ':(exclude)bugs' ':(exclude)features')"
if [ -n "$TRACKED_DIRT" ]; then
  log "tracked changes present outside the ops paths:"; echo "$TRACKED_DIRT" | sed 's/^/    /'
  fail "working tree has uncommitted changes to tracked files, leaving your work alone"
fi
```

Verify the pathspec syntax on the actual git version before relying on it:
`git status --porcelain --untracked-files=no -- . ':(exclude)bugs' ':(exclude)features'`
should print nothing today, while the unfiltered form prints the two files in
section 1.

### T2. Auto-commit ops dirt at preflight (immediately after T1)

```bash
# TOLERATED AND COMMITTED: ops dirt. Committing it here, rather than blocking on
# it, is what keeps the daily Cowork loop from disarming the nightly code loop.
OPS_DIRT="$(git status --porcelain -- "${OPS_PATHS[@]}")"
if [ -n "$OPS_DIRT" ]; then
  log "ops-path changes present, committing them before the run:"
  echo "$OPS_DIRT" | sed 's/^/    /'
  git add -- "${OPS_PATHS[@]}"
  git reset -q -- bugs/.auto-verdict.json 2>/dev/null || true
  if git diff --cached --quiet; then
    log "ops paths produced nothing to commit after exclusions"
  else
    git commit -q -m "chore(ops): tracker state $(date +%Y-%m-%d)" \
      && log "committed ops tracker state" \
      || log "WARNING: ops commit failed, continuing with a dirty ops tree"
  fi
fi
```

Notes that matter:

- This runs on `main`, before the auto branch is cut, so the ops commit lands on
  `main` and is not entangled with the fix.
- It runs **after** the stale-lock clear at `:155-169` and **after** the
  `gh auth` check, so it never fights a lock or runs in a broken environment.
- `bugs/.auto-verdict.json` is excluded here for the same reason line 262
  excludes it from the fix commit: it is per-run scratch. Consider adding it to
  `.gitignore` instead, which is cleaner and removes both exclusions. Jay's call,
  noted as a follow-up rather than done here.
- A failed ops commit **warns and continues** rather than aborting. A hygiene
  step must never become a new reason the run does not fire. That is the whole
  lesson of the last ten mornings.

### T3. Finish PR #214, one time, by hand

```bash
git add bugs/ features/
git commit -m "chore(ops): track the bug and feature trackers (finishes #214)"
```

**Before running it:**

1. `python3 bugs/scrub-pii.py --check` and fix anything it reports. This is the
   gate that keeps reporter addresses and PostHog session ids out of git history.
   The script exits 1 in a cloud session with no `bugs/private/`, so run it on
   the machine that holds the keys.
2. Delete the five scratch probes that will otherwise be swept in:
   `bugs/.write-test`, `bugs/.write_test`, `bugs/.writetest`, `bugs/.wt`,
   `bugs/.wtest`.
3. Decide `bugs/.auto-verdict.json`: `.gitignore` is the better home.
4. Classify the three unrelated untracked paths that are NOT ops and must not be
   swept in by a careless `git add -A`: `.ae-query.mjs`, `.design-sync/`, and
   `docs/design-system.md`. The command above is scoped to `bugs/ features/`, so
   it does not touch them, but do not widen it.

**T1 and T2 MUST ship before T3.** This is the one hard ordering constraint in
the brief. The moment all 60 trackers are tracked, every Cowork write becomes a
tracked change, so running T3 against today's gate would block the pipeline
permanently instead of occasionally. Ship the script change, confirm one clean
run, then commit the trackers.

### T4. Extend the design note (`scripts/auto-bugfix.sh:15-40`)

Add a short September 8 paragraph to the existing revision block, in its voice:
the August 19 revision correctly stopped counting untracked files, but three ops
files were tracked and Cowork rewrites that directory daily, so the same class of
silent failure returned through a different door. Ops paths are now committed
rather than counted.

### T5. Repo `CLAUDE.md`, standing rule

Add to the bug-session and feature-session standing rules:

> **Ops paths are committed, not carried.** `bugs/` and `features/` hold the
> trackers and briefs Cowork rewrites daily. The 05:00 wrapper commits any dirt
> there as `chore(ops)` before it starts, and the auto PR never contains a file
> from either directory. If you edit a tracker in a session, commit it in its own
> `chore(ops)` commit rather than folding it into a fix or feature commit.

### T6. `bugs/RUN-LOG.md`, one line at the top of the schema note

> A Cowork sandbox can create files under `.git` but cannot unlink them, so a
> read-only `git status` from a triage or digest run can strand a zero-byte
> `.git/index.lock`. The wrapper clears it at preflight
> (`auto-bugfix.sh:155-169`), so it does not cost a run, but manual git in the
> repo fails until it is removed: `rm ~/lineage/.git/index.lock`.

---

## 4. Out of scope (hard list)

- **Any new lock-sweep code.** It exists at `:155-169`. D5.
- **Moving ops into a separate `linestry-ops` repo.** That is the durable answer
  and it is a real project. Section 7.
- **Changing what blocks for `src/` paths.** D4.
- **Widening the T3 commit beyond `bugs/` and `features/`.**
- **Any product behaviour.** No `src/` file is touched by this brief.

---

## 5. Acceptance criteria

1. With today's tree (`M bugs/README.md`, `D features/events-catalog-import-brief.md`)
   and T1 plus T2 in place, `bash scripts/auto-bugfix.sh --dry-run` **reaches the
   session step instead of aborting**, and logs an ops commit naming both files.
2. `git log -1 --stat` on `main` shows a `chore(ops)` commit containing only paths
   under `bugs/` or `features/`.
3. Introduce a deliberate dirty tracked file in `src/` and re-run: the wrapper
   still aborts with the existing message. D4 is intact.
4. After a full dry run, `git diff --name-only main...HEAD` on the auto branch
   contains **zero** paths under `bugs/` or `features/`. D1.
5. Re-run the wrapper twice in a row with no ops changes between: the second run
   makes no ops commit and logs nothing about ops paths (idempotent, no empty
   commits).
6. After T3, `git ls-files bugs/ features/ | wc -l` is roughly 60, not 3, and a
   fresh `git clone` of `main` can read `bugs/NEXT-SESSION.md`.
7. `python3 bugs/scrub-pii.py --check` exits 0 before T3 is committed.
8. Simulate a failed ops commit (for example by leaving a lock in place): the run
   logs the warning and **continues** rather than aborting.

---

## 6. Risks and gotchas

**R1. Ordering.** T3 before T1 and T2 blocks the pipeline permanently. Stated
twice on purpose.

**R2. Pathspec syntax.** `':(exclude)bugs'` needs a leading `.` pathspec
alongside it or git may interpret the argument list as exclude-only and match
nothing. Test the exact command in T1 before trusting it.

**R3. The ops commit lands on `main` unreviewed.** That is intentional and it is
prose only, but it does mean `main` gains a daily `chore(ops)` commit. If that
noise is unwelcome, the alternative is a long-lived `ops/trackers` branch, at the
cost of the trackers no longer being readable from a clone of `main`, which is
what #214 was for. Flagged, not decided.

**R4. `git add -- bugs features` also stages deletions**, which is correct here
(archiving a brief is a real ops change), but it means a brief accidentally
deleted by a bad run gets committed as deleted. `git log` makes that recoverable.

**R5. Do not let the ops commit run inside the auto branch.** It must happen at
preflight on `main`. If it were moved after `git checkout -b`, ops prose would
end up in the fix branch and defeat D1.

---

## 7. Follow-ups, NOT this session

1. **`linestry-ops` as a separate repo**, per the August 17 Stambol scoping
   (`Operations/online-operating-model-scoping-2026-08-17.md`). The structurally
   correct fix: the code worktree stops being an ops surface at all, so this
   class of collision cannot recur. Touches the triage task, the digest task, the
   wrapper, and both dashboards. Worth doing when the ops loop next needs
   changing anyway.
2. **`bugs/.auto-verdict.json` to `.gitignore`**, removing two special-case
   `git reset` lines.
3. **Cowork committing its own ops writes.** Still desirable as a backup to T2,
   but blocked on the sandbox `.git` unlink limitation. Revisit if Cowork ever
   gets a writable git path; until then T2 is the mechanism.
4. **A weekly ops-tree report** in the morning digest: what was auto-committed
   over the week, so the hygiene step stays visible rather than invisible.

---

## 8. Ship sequence

No migration. Touches `scripts/auto-bugfix.sh`, repo `CLAUDE.md`,
`bugs/RUN-LOG.md`. No `src/` file, no auth path, no payments, no data.

**SAFE: self-merge once the acceptance runs pass.** Then perform T3 by hand on
`main` as a separate commit, and confirm the next 05:00 run fires by checking
`bugs/RUN-LOG.md` the following morning.

SHIP-LOG entry: `type: feature`, `ids: none`, `scope: ops-tree-hygiene`,
`migration: none`.
