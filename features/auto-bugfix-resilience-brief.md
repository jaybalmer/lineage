# Auto-bugfix Resilience: worktree isolation, stale-branch cleanup, startup diagnostics, P1 aging escalator

> Cowork-authored ops brief, September 9 2026. Self-contained. ONE PR, NO migration.
> Changes `scripts/auto-bugfix.sh` only. Run it in a LOCAL Claude Code session
> (terminal `claude` or desktop Environment=Local): the wrapper lives outside the
> repo's committed tree and touches launchd-adjacent behavior, and cloud/bridge
> sessions cannot push to `jaybalmer/lineage` and strand `.git/index.lock`.
>
> **Sequence: run this AFTER `ops-tree-hygiene-brief.md`.** That brief stops the ops
> loop from dirtying the tree; this one makes the run survive a dirty tree of any
> kind. They are complementary, not redundant: ops-tree-hygiene finishes the #214
> tracking migration (queues readable from a clone, which brief 3 needs); this one
> removes the tracked-dirt abort entirely.

---

## Why this exists

The brief's Goal 1 is "bug-fix work and feature work happen in separate worktrees
so an incomplete feature session can never block the daily bug run again." Today
the runner does the opposite: `auto-bugfix.sh:175-178` classifies any modified or
staged TRACKED file as BLOCKING and calls `fail`, so a feature session left
mid-edit in the primary checkout kills that night's bug run. This is the single
mechanism behind most of the dead overnight runs this summer.

**What is already done (do NOT rebuild):**
- Never-silent: `fail()` at `:126` already sends the "[Auto bug-fix] stopped"
  email and writes a RUN-LOG row. The Aug 17 scoping doc predates this; the Aug 19
  revision shipped it.
- Untracked tolerance: `:180-190` already snapshots and excludes pre-existing
  untracked scratch, so untracked files no longer block.
- Stale `.git/index.lock` sweep: `:154-167` already clears a zero-byte lock older
  than `LOCK_STALE_SECONDS`.
- Merged-branch prune: `prune_merged_auto_branches()` at `:305` already deletes
  remote `auto/bugfix-*` branches that are fully merged.

So the gap is narrow and specific: real isolation (a worktree so tracked dirt in
the primary checkout is irrelevant), cleanup of UNMERGED stale branches, startup
diagnostics, and an aging escalator so a stuck P1 is never silent.

---

## DECISIONS (review before building)

**D1. Isolate every run in a throwaway `git worktree` off `origin/main`, not the primary checkout. DEFAULT: yes.**
This is the load-bearing change and it is the option the scoping doc preferred
(§6, "work in a worktree"). Instead of `git checkout -b` on the primary checkout
(`:220`), create `git worktree add <tmp> -b auto/bugfix-<stamp> origin/main`, run
the whole session there, open the PR from there, and `git worktree remove` at the
end (in a trap so it also cleans up on failure). The primary checkout is never
touched, so a dirty tracked tree in it is irrelevant and the BLOCKING abort at
`:175-178` is removed for the run path. `.claude/worktrees/` already establishes
the pattern in this repo. The alternative (stash-and-restore) has more edge cases
and can lose work if a restore conflicts; reject it.

**D2. Keep a minimal safety check on the WORKTREE only. DEFAULT: yes.**
The worktree is created clean off `origin/main`, so it starts clean by
construction. Keep the untracked-scratch exclusion logic (`:180-190`, `:261-264`)
since the headless session may still write scratch, but the tracked-dirt abort no
longer applies to the primary checkout. Do not carry the primary checkout's dirt
into the worktree.

**D3. Prune stale UNMERGED `auto/bugfix-*` branches older than 14 days at preflight. DEFAULT: yes, 14 days.**
`priorities.md` carries "stale auto/bugfix-* branches" as recurring debt. The
existing prune only removes MERGED branches. Add a second pass that deletes local
and remote `auto/bugfix-*` branches whose tip commit is older than
`STALE_BRANCH_DAYS` (default 14) and which are not merged, EXCEPT the current
run's branch and any branch with an open PR (a needs-review draft must survive).
Log each deletion. This is destructive to abandoned branches only; abandoned auto
branches are by definition disposable (the fix re-derives from the brief).

**D4. Add an aging escalator on the no-op / paused paths. DEFAULT: yes, 3 days.**
The brief's Goal 3 is "escalation only," and the audit's R2 aging escalator is
designed but never built. Today a run that is paused (an open auto PR) or a no-op
(no build-ready brief) is quiet. Add: when the run does not ship, read the lead
bug's age from `bugs/NEXT-SESSION.md` (the "Build this" line names a `BUG-xxx` and
a dated brief file); if the lead is a P1 (or any P1 is open) and its brief file is
older than `P1_AGING_DAYS` (default 3), send one escalation notify
("[Auto bug-fix] P1 BUG-xxx has not shipped in N days") and record it in RUN-LOG.
Debounce so it fires at most once per day per bug. This is the only new outbound
message and it fires only on genuine sticking, which is exactly the brief's bar.

**D5. Log resolved environment at startup. DEFAULT: yes.**
Add a startup log line with the resolved `PATH`, `command -v claude`,
`claude --version`, `node --version`, and `npm --version`. The scoping doc §6
called this out: a PATH or auth failure under launchd is currently undiagnosable
from the log. Pure logging, no behavior change.

---

## Tasks (suggested order)

**T1. Worktree isolation (D1, D2).** Replace the primary-checkout branch flow
with a worktree. Concretely:
- Remove the tracked-dirt BLOCKING abort at `:175-178` from the run path.
- After the `gh pr list` single-in-flight check (`:191-197`) and the
  `NEXT-SESSION.md` presence checks (`:206-219`), create
  `WT="$(mktemp -d -t autobugfix-wt)"; git worktree add --quiet "$WT" -b "$BRANCH" origin/"$MAIN_BRANCH"` and `cd "$WT"`.
- Register a trap: `trap 'cd "$REPO"; git worktree remove --force "$WT" 2>/dev/null; git branch -D "$BRANCH" 2>/dev/null || true' EXIT` so the worktree and its
  local branch are cleaned up on every exit path, success or fail. (The branch
  survives on the remote once pushed; only the local ref is dropped.)
- Everything from the headless `claude -p` call through PR creation now runs with
  the worktree as CWD. `git fetch`/`git pull --ff-only` on the primary checkout is
  no longer needed since the worktree is created off `origin/main` directly; keep
  a `git fetch --quiet origin` before the worktree add so `origin/main` is fresh.

**T2. Stale-branch prune (D3).** Add `STALE_BRANCH_DAYS=14` near the other config
constants (`:47-60`). Add a `prune_stale_unmerged_auto_branches()` that iterates
local and remote `auto/bugfix-*`, skips `$BRANCH` and any branch with an open PR
(`gh pr list --head "$b"`), and deletes those whose tip is older than the
threshold (`git log -1 --format=%ct`). Call it at preflight, after the lock sweep.

**T3. Aging escalator (D4).** Add `P1_AGING_DAYS=3`. On the `record_run "paused"`
and `record_run "no-op"` paths (`:194`, `:211`, `:216`), before `exit 0`, parse
the lead `BUG-xxx` and its brief filename from `bugs/NEXT-SESSION.md`, stat the
brief file's mtime, and if it is a P1 aged past the threshold, `notify` once
(debounced via a stamp file under `bugs/.escalation-stamps/`) and add a RUN-LOG
row. If parsing fails, do nothing (never crash the run on a format change).

**T4. Startup diagnostics (D5).** Immediately after the `log` helper is defined,
emit one `log` line with PATH, `claude` path + version, node, npm.

**T5. Update `bugs/RUN-LOG.md` header** to note the new `escalated` outcome value,
and add one line to repo `CLAUDE.md` documenting that runs now execute in a
throwaway worktree so a dirty primary checkout no longer blocks the pipeline.

---

## Acceptance criteria

1. With the primary checkout deliberately dirtied (a modified tracked `src/` file
   AND a staged tracked file), a `--dry-run` completes a full session in a
   worktree and leaves a DRAFT PR. The primary checkout's dirt is untouched
   afterward (`git status` in `$REPO` unchanged).
2. `git worktree list` shows no leftover autobugfix worktree after the run (trap
   cleaned it up), on both the success and the tsc-fail paths.
3. A stale unmerged `auto/bugfix-*` branch older than 14 days with no open PR is
   deleted at preflight; a needs-review draft's branch is NOT deleted.
4. With an open auto PR present (paused path) and a P1 lead brief file mtime set
   4 days ago, the run sends exactly one escalation notify and writes an
   `escalated` RUN-LOG row; a second run the same day sends none (debounce holds).
5. The startup log line shows a resolved `claude` path and version.
6. A real (non-dry) `safe` verdict still auto-merges and a `needs-review` verdict
   still opens a draft: the merge gate at `:283-347` is unchanged.

## Risks and gotchas

- **R1. The trap must `cd "$REPO"` before `git worktree remove`**, or removal runs
  from inside the worktree being removed and fails.
- **R2. `git worktree add` fails if the branch name already exists.** Since
  `$BRANCH` is timestamped to the minute, two runs in one minute would collide.
  Add seconds to `STAMP` (`date +%Y%m%d-%H%M%S`).
- **R3. `.env.local` and other gitignored files do not exist in a fresh worktree.**
  The headless session needs the Resend + Supabase env. Symlink or copy
  `.env.local` into the worktree at setup (`ln -s "$REPO/.env.local" "$WT/.env.local"`),
  and confirm `node_modules` resolves (a worktree shares the same working dir tree
  but not ignored files; if the build needs `node_modules`, symlink it too or run
  the session with the repo's installed deps on PATH). Verify this in the dry run.
- **R4. Do not delete a branch that has an open PR**, merged or not. The open-PR
  check in T2 is not optional.

## Ship sequence

No migration. Touches `scripts/auto-bugfix.sh`, `bugs/RUN-LOG.md`, repo `CLAUDE.md`.
SAFE by the risk model (no `src/`, no auth, no payments, no data), but it is
infrastructure, so smoke it with a `--dry-run` before trusting the next 05:00 fire,
then confirm the following morning's `bugs/RUN-LOG.md` row. SHIP-LOG entry:
`type: feature`, `ids: none`, `scope: auto-bugfix-resilience`, `migration: none`.

## What Jay does (gated, human-only)

1. Run this in a LOCAL Claude Code session (not cloud, not the Cowork bridge).
2. After it lands, run `bash scripts/auto-bugfix.sh --dry-run` yourself once and
   read the log to confirm the worktree path and cleanup.
3. Nothing in launchd changes; the next 05:00 fire picks up the new script.
