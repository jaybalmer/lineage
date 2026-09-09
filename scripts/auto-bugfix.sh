#!/bin/bash
#
# auto-bugfix.sh
# Local autonomous Linestry bug-fix runner. Runs after the daily triage.
# Reads bugs/NEXT-SESSION.md, implements the lead brief with Claude Code headless,
# opens a PR (Vercel auto-previews and emails the link), then either auto-merges
# safe fixes to main (which deploys to prod) or leaves risky ones as a draft for Jay.
#
# Design doc: Drive/Lineage/Operations/auto-bugfix-pipeline-design.md
#
# Safe to re-run by hand any time:  bash scripts/auto-bugfix.sh
# Dry run (never merges, always leaves a draft):  bash scripts/auto-bugfix.sh --dry-run
#
# ---------------------------------------------------------------------------
# August 19, 2026 revision: dirty-worktree handling and run visibility.
#
# The old preflight aborted on ANY `git status --porcelain` output, which counts
# untracked files. Two long-lived untracked paths (.design-sync/ and
# docs/design-system.md) therefore killed the 05:00 run silently, night after
# night. Three changes fix that class of failure:
#
#   1. DIRT IS CLASSIFIED, NOT COUNTED. Only modified or staged TRACKED files
#      block the run, because that is what "your uncommitted work" actually
#      means. Untracked files are tolerated.
#   2. THE COMMIT IS NARROWED. The old `git add -A` is why the guard had to be
#      so blunt: it would have swept untracked scratch into the auto commit.
#      The run now snapshots the untracked set BEFORE the session and unstages
#      exactly those paths afterward, so pre-existing scratch can never be
#      committed even though it is allowed to sit there.
#   3. THE RUN RECORDS ITSELF. bugs/RUN-LOG.md says rows are "written by the
#      script at each outcome". They never were; the morning digest backfilled
#      them by inference, which made "fired and aborted" indistinguishable from
#      "launchd never fired". Every terminal path now appends its own row.
#
# Plus two smaller guards: a conservative stale .git/index.lock clear (the
# August 18 blocker) and an EXIT trap that always returns the repo to main, so a
# failed run cannot leave the checkout parked on an auto branch and confuse the
# next morning's triage into thinking a session is in progress.
#
# September 8, 2026 revision: ops paths are committed, not counted.
#
# The August 19 revision correctly stopped counting untracked files, but three
# files under bugs/ and features/ were tracked (two READMEs and a stray brief),
# and Cowork rewrites those directories every day (triage 04:06, digest 07:15,
# brief drafting). So the same class of silent failure returned through a
# different door: a day whose write touched one of the tracked files left a
# modified TRACKED file, the gate blocked, and the run aborted, nine of the last
# ten mornings. The fix stops treating bugs/ and features/ as product code at
# all. Ops dirt there is committed at preflight as a chore(ops) commit on main
# and pushed, so the tree is clean before the branch is cut; the gate only blocks
# on tracked dirt OUTSIDE those paths; and the auto commit excludes them
# unconditionally, so the PR is always product code and never ops prose. See
# features/ops-tree-hygiene-brief.md.
#
# September 9, 2026 revision: worktree isolation + resilience.
#
# ops-tree-hygiene stopped the ops loop from dirtying the tree; a half-finished
# FEATURE session left in the primary checkout still killed the run, because the
# gate blocked on any tracked dirt. This revision removes that failure class by
# running the whole session in a throwaway `git worktree` cut off origin/main:
# the primary checkout is never touched, so its state (dirty, on a feature
# branch, whatever) is irrelevant to the run. The tracked-dirt abort is gone.
# The ops-commit is kept but made best-effort and conditional on the primary
# being on main, so origin/main still carries fresh trackers for the worktree
# without ever disturbing an in-flight human session. Plus: a stale-unmerged
# branch prune, an aged-P1 escalation email, and startup env diagnostics. See
# features/auto-bugfix-resilience-brief.md.
# ---------------------------------------------------------------------------
#
set -uo pipefail

# ---------- config (edit these if needed) ----------
REPO="${LINESTRY_REPO:-$HOME/lineage}"
# Ops state (queues, briefs, logs, dashboards) lives in its own repo now, no
# longer under $REPO/bugs + $REPO/features. Resolve it the same way as $REPO so a
# future move is one variable. See features/ops-cutover-brief.md.
OPS_REPO="${LINESTRY_OPS_REPO:-$HOME/linestry-ops}"
NOTIFY_EMAIL="${LINESTRY_NOTIFY_EMAIL:-jaybalmer@gmail.com}"
MAIN_BRANCH="main"
BRANCH_PREFIX="auto/bugfix"
DRY_RUN="false"
[ "${1:-}" = "--dry-run" ] && DRY_RUN="true"

# Delete remote auto/bugfix-* branches that are fully merged into main, at the
# end of a run. Set to "false" to keep them around.
PRUNE_BRANCHES="${LINESTRY_PRUNE_BRANCHES:-true}"

# A stale index.lock is cleared only if it is zero-byte, older than this many
# seconds, and no git process is running. Anything else is treated as live.
LOCK_STALE_SECONDS=600

# Delete UNMERGED auto/bugfix-* branches whose tip is older than this many days
# (except the current run's branch and any branch with an open PR).
STALE_BRANCH_DAYS="${LINESTRY_STALE_BRANCH_DAYS:-14}"

# Escalate an unshipped P1 lead whose brief file is older than this many days,
# once per day per bug.
P1_AGING_DAYS="${LINESTRY_P1_AGING_DAYS:-3}"

# Risky paths: if the diff touches any of these, never auto-merge. Hand to Jay.
RISKY_PATTERNS='supabase/migrations/|_public|src/lib/auth\.|src/app/api/auth/|stripe|memberships|backfill'

# ---------- state (declared up front: set -u is on) ----------
BRANCH=""
BUGS=""
RISK=""
TITLE=""
PR_URL=""
RUN_RECORDED="false"
PRE_UNTRACKED_FILE=""
PRE_UNTRACKED_COUNT="0"
WT=""

# ---------- logging ----------
LOG_DIR="$HOME/Library/Logs/linestry-autobugfix"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1
log() { echo "[$(date +%H:%M:%S)] $*"; }

# ---------- startup diagnostics (D5) ----------
# A PATH or auth failure under launchd is otherwise undiagnosable from the log.
# Logged before the command-existence checks so the PATH is visible even when
# `claude` is missing. Pure logging, no behavior change.
log "env: PATH=$PATH"
log "env: claude=$(command -v claude 2>/dev/null || echo 'NOT FOUND') version=$(claude --version 2>/dev/null | head -1 || echo '?')"
log "env: node=$(node --version 2>/dev/null || echo '?') npm=$(npm --version 2>/dev/null || echo '?') gh=$(command -v gh 2>/dev/null || echo 'NOT FOUND')"

# ---------- run ledger ----------
# One row per run, appended at whichever outcome the run reaches. The morning
# digest reads this file. Idempotent: only the first call in a run writes.
# Outcome vocabulary (keep stable, the digest keys on it):
#   merged | draft-needs-review | checks-failed | merge-failed
#   | paused | no-op | empty | aborted | escalated
# (escalated is written directly, out-of-band, so it can accompany a paused or
# no-op row rather than replacing it.)
RUNLOG="$OPS_REPO/log/RUN-LOG.md"
record_run() {
  local outcome="$1" detail="${2:-}"
  [ "$RUN_RECORDED" = "true" ] && return 0
  if [ ! -f "$RUNLOG" ]; then
    log "no $RUNLOG, cannot self-record outcome=$outcome"
    return 0
  fi
  RUN_RECORDED="true"
  local when branch bugs verdict
  when="$(date '+%Y-%m-%d %H:%M %Z')"
  branch="${BRANCH:-(none)}"
  bugs="${BUGS:-}"
  [ -z "$bugs" ] && bugs="(none)"
  verdict="${RISK:-n/a}"
  [ "$DRY_RUN" = "true" ] && detail="DRY RUN. $detail"
  # Table cells cannot contain a raw pipe or a newline.
  detail="$(printf '%s' "$detail" | tr '\n' ' ' | tr '|' ';')"
  printf '| %s | %s | %s | %s | %s | %s |\n' \
    "$when" "$branch" "$bugs" "$verdict" "$outcome" "$detail" >> "$RUNLOG"
  log "RUN-LOG row written: outcome=$outcome"
}

# ---------- email helper (Resend, key from repo .env.local) ----------
notify() {
  local subject="$1" body="$2"
  local key=""
  [ -f "$REPO/.env.local" ] && key="$(grep -E '^RESEND_API_KEY=' "$REPO/.env.local" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  if [ -z "$key" ]; then log "no RESEND_API_KEY, skipping email: $subject"; return; fi
  curl -s -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer $key" \
    -H "Content-Type: application/json" \
    -d "$(cat <<JSON
{"from":"Linestry <noreply@linestry.com>","to":["$NOTIFY_EMAIL"],"subject":"$subject","text":"$body"}
JSON
)" >/dev/null && log "emailed: $subject"
}

fail() {
  log "ABORT: $*"
  record_run "aborted" "$*. Log: $LOG"
  notify "[Auto bug-fix] stopped: $*" "Run log: $LOG"
  exit 1
}

# ---------- ops repo sync (D3) ----------
# The ops trackers (queues, briefs, logs, dashboards) live in $OPS_REPO now, a
# separate git repo. Cowork rewrites them every day (triage 04:06, digest 07:15)
# and this runner appends RUN-LOG/SHIP-LOG rows. Commit and push that state to the
# GitHub mirror, best-effort, so it is backed up. Called at preflight (so the
# 04:06 triage's writes are backed up before the 05:00 read) and once more at the
# end of a run that opened a PR (so the runner's own RUN-LOG/SHIP-LOG changes ride
# along). Replaces the old lineage ops-dirt commit block: the trackers no longer
# live in $REPO. Never fatal (a backup step must not disarm the run), makes no
# empty commit, and unwinds an un-pushed commit so local stays in sync with
# origin, mirroring the old block's posture. See features/ops-cutover-brief.md.
sync_ops_repo() {
  [ -d "$OPS_REPO/.git" ] || { log "no git repo at $OPS_REPO, skipping ops sync"; return 0; }
  git -C "$OPS_REPO" add -A 2>/dev/null || { log "WARNING: ops sync 'git add' failed, skipping"; return 0; }
  if git -C "$OPS_REPO" diff --cached --quiet 2>/dev/null; then
    log "ops repo clean, nothing to sync"
    return 0
  fi
  if git -C "$OPS_REPO" commit -q -m "ops: sync $(date +%F)"; then
    log "committed ops repo state"
    if git -C "$OPS_REPO" push -q; then
      log "pushed ops repo to origin"
    else
      log "WARNING: ops repo push failed; unwinding the un-pushed commit to keep local in sync with origin (ops state tolerated for this run)"
      git -C "$OPS_REPO" reset -q --mixed HEAD~1 2>/dev/null || log "WARNING: could not unwind the un-pushed ops commit"
    fi
  else
    log "WARNING: ops repo commit failed, continuing"
  fi
}

# ---------- stale-branch prune (D3) ----------
# Delete local and remote auto/bugfix-* branches whose tip is older than
# STALE_BRANCH_DAYS and which are NOT the current run's branch and do NOT have an
# open PR (a needs-review draft must survive). Abandoned auto branches are
# disposable: the fix re-derives from the brief. Best-effort, never fatal.
prune_stale_unmerged_auto_branches() {
  [ "$PRUNE_BRANCHES" = "true" ] || return 0
  git -C "$REPO" fetch --quiet --prune origin 2>/dev/null || return 0
  local now cutoff b tip age
  now="$(date +%s)"; cutoff=$(( STALE_BRANCH_DAYS * 86400 ))
  # remote
  for b in $(git -C "$REPO" branch -r 2>/dev/null | sed 's|^[[:space:]]*||' \
             | grep "^origin/$BRANCH_PREFIX" | sed 's|^origin/||' || true); do
    [ -n "$BRANCH" ] && [ "$b" = "$BRANCH" ] && continue
    if [ "$(gh pr list --head "$b" --state open --json number --jq 'length' 2>/dev/null || echo 0)" != "0" ]; then
      continue
    fi
    tip="$(git -C "$REPO" log -1 --format=%ct "origin/$b" 2>/dev/null || echo "$now")"
    age=$(( now - tip ))
    if [ "$age" -gt "$cutoff" ]; then
      log "pruning stale unmerged remote branch $b (age $(( age/86400 ))d, no open PR)"
      git -C "$REPO" push --quiet origin --delete "$b" 2>/dev/null || log "could not delete remote $b"
    fi
  done
  # local
  for b in $(git -C "$REPO" branch 2>/dev/null | sed 's|^[* ]*||' \
             | grep "^$BRANCH_PREFIX" || true); do
    [ -n "$BRANCH" ] && [ "$b" = "$BRANCH" ] && continue
    tip="$(git -C "$REPO" log -1 --format=%ct "$b" 2>/dev/null || echo "$now")"
    age=$(( now - tip ))
    if [ "$age" -gt "$cutoff" ]; then
      log "pruning stale local branch $b (age $(( age/86400 ))d)"
      git -C "$REPO" branch -D "$b" 2>/dev/null || log "could not delete local $b"
    fi
  done
}

# ---------- aged-P1 escalation (D4) ----------
# On a run that does not ship (paused or no-op), if the P1 lead brief has been
# build-ready longer than P1_AGING_DAYS, send ONE escalation email, debounced to
# once per day per bug via a stamp file. Writes its own out-of-band RUN-LOG row
# (does not consume record_run, so the paused/no-op row still lands). Never
# crashes the run on a NEXT-SESSION.md format change.
maybe_escalate_aging_p1() {
  local ns="$OPS_REPO/queues/NEXT-SESSION.md" line brief bug mtime now age_days stampdir stamp briefpath
  [ -f "$ns" ] || return 0
  line="$(grep -m1 -i 'Build this:' "$ns" 2>/dev/null || true)"
  [ -n "$line" ] || return 0
  echo "$line" | grep -qi 'P1' || return 0
  # NEXT-SESSION may name the brief with a briefs/ or a legacy bugs/ prefix; the
  # file itself lives under $OPS_REPO/briefs/, so resolve it there by basename.
  brief="$(echo "$line" | grep -oE '(briefs|bugs)/[A-Za-z0-9._/-]+\.md' | head -1)"
  bug="$(echo "$line" | grep -oE 'BUG-[0-9]+' | head -1)"
  [ -n "$brief" ] || return 0
  briefpath="$OPS_REPO/briefs/$(basename "$brief")"
  [ -f "$briefpath" ] || return 0
  mtime="$(stat -f %m "$briefpath" 2>/dev/null || echo 0)"
  now="$(date +%s)"; age_days=$(( (now - mtime) / 86400 ))
  [ "$age_days" -ge "$P1_AGING_DAYS" ] || return 0
  stampdir="$OPS_REPO/.escalation-stamps"; mkdir -p "$stampdir" 2>/dev/null || true
  stamp="$stampdir/${bug:-lead}-$(date +%Y%m%d)"
  [ -f "$stamp" ] && { log "P1 escalation already sent today for ${bug:-lead}"; return 0; }
  : > "$stamp" 2>/dev/null || true
  log "escalating aged P1 ${bug:-lead}: brief $brief age ${age_days}d >= ${P1_AGING_DAYS}d"
  notify "[Auto bug-fix] P1 ${bug:-lead} has not shipped in ${age_days} days" \
    "The P1 lead brief $brief has been build-ready for ${age_days} days without shipping. Run log: $LOG"
  if [ -f "$RUNLOG" ]; then
    printf '| %s | %s | %s | %s | %s | %s |\n' \
      "$(date '+%Y-%m-%d %H:%M %Z')" "${BRANCH:-(none)}" "${bug:-(none)}" "n/a" "escalated" \
      "P1 ${bug:-lead} aged ${age_days}d unshipped; escalation email sent." >> "$RUNLOG"
    log "RUN-LOG row written: outcome=escalated"
  fi
}

# ---------- exit trap ----------
# Always tear down the throwaway worktree and its local branch, and always leave
# a ledger row behind. R1: cd back to $REPO first, or `git worktree remove` runs
# from inside the worktree it is trying to remove and fails. The branch survives
# on the remote once pushed (the PR needs it); only the local ref is dropped.
cleanup() {
  local code=$?
  if [ "$RUN_RECORDED" != "true" ]; then
    record_run "aborted" "Exited with code $code before reaching a recorded outcome. Log: $LOG"
  fi
  [ -n "$PRE_UNTRACKED_FILE" ] && rm -f "$PRE_UNTRACKED_FILE"
  cd "$REPO" 2>/dev/null || true
  if [ -n "$WT" ]; then
    git -C "$REPO" worktree remove --force "$WT" 2>/dev/null \
      && log "removed worktree $WT" \
      || { log "could not git-worktree-remove $WT, forcing"; rm -rf "$WT" 2>/dev/null; git -C "$REPO" worktree prune 2>/dev/null || true; }
  fi
  if [ -n "$BRANCH" ]; then
    git -C "$REPO" branch -D "$BRANCH" 2>/dev/null \
      && log "dropped local branch $BRANCH" || true
  fi
}
trap cleanup EXIT

# ---------- preflight ----------
cd "$REPO" || fail "repo not found at $REPO"
command -v claude >/dev/null || fail "claude CLI not on PATH"
command -v gh >/dev/null || fail "gh CLI not on PATH"
gh auth status >/dev/null 2>&1 || fail "gh not authenticated (run: gh auth login)"

# Stale index.lock. A live lock means another git process owns the repo and we
# must not touch it. A zero-byte lock with no git process and real age is the
# August 18 failure mode: a crashed run left it behind and every later run died.
LOCK="$REPO/.git/index.lock"
if [ -f "$LOCK" ]; then
  lock_age=$(( $(date +%s) - $(stat -f %m "$LOCK" 2>/dev/null || echo 0) ))
  lock_size="$(stat -f %z "$LOCK" 2>/dev/null || echo 1)"
  if pgrep -x git >/dev/null 2>&1; then
    fail "a git process is running and .git/index.lock is present, not touching it"
  elif [ "$lock_size" = "0" ] && [ "$lock_age" -gt "$LOCK_STALE_SECONDS" ]; then
    log "clearing STALE .git/index.lock (zero-byte, age ${lock_age}s, no git process running)"
    rm -f "$LOCK" || fail "could not remove stale .git/index.lock"
  else
    fail ".git/index.lock present (size ${lock_size}b, age ${lock_age}s) and does not look stale"
  fi
fi

# Prune abandoned auto branches (D3), after the lock sweep so it never fights a
# lock. At this point $BRANCH is empty, so the current run's branch (created
# later) is never a candidate.
prune_stale_unmerged_auto_branches

# NOTE (resilience D1): there is no longer a tracked-dirt abort here. The whole
# session runs in a throwaway worktree cut off origin/main (created below), so
# the primary checkout's state, dirty or on a feature branch, cannot block or
# contaminate the run. The untracked snapshot that the commit step relies on is
# taken INSIDE the worktree, once it exists.

# only one auto PR in flight at a time
OPEN_AUTO="$(gh pr list --state open --search "head:$BRANCH_PREFIX" --json number --jq 'length' 2>/dev/null || echo 0)"
if [ "$OPEN_AUTO" != "0" ]; then
  log "an auto PR is already open and awaiting review/merge, pausing. Nothing to do."
  maybe_escalate_aging_p1
  record_run "paused" "An auto PR is already open awaiting review or merge; run took no action."
  exit 0
fi

git fetch --quiet origin

# Back up the ops repo before the run reads it: the 04:06 triage rewrote the
# queues/briefs in $OPS_REPO, so commit and push them to the GitHub mirror before
# the 05:00 read (D3). Best-effort, never fatal.
sync_ops_repo

# is there a brief? (read from the ops repo, synced by sync_ops_repo above)
NS="$OPS_REPO/queues/NEXT-SESSION.md"
if [ ! -f "$NS" ]; then
  log "no $NS, nothing to do."
  maybe_escalate_aging_p1
  record_run "no-op" "No bugs/NEXT-SESSION.md present."
  exit 0
fi
if grep -qi "NO BUILD-READY BRIEF YET" "$NS"; then
  log "triage left no build-ready brief, nothing to do."
  maybe_escalate_aging_p1
  record_run "no-op" "Triage left NO BUILD-READY BRIEF YET; nothing to implement."
  exit 0
fi

# ---------- worktree (resilience D1) ----------
# Cut a throwaway worktree off origin/main and run the whole session there. The
# primary checkout is never touched. R2: seconds in the stamp so two runs in the
# same minute cannot collide on the branch name (git worktree add fails on a
# name clash).
STAMP="$(date +%Y%m%d-%H%M%S)"
BRANCH="$BRANCH_PREFIX-$STAMP"
WT="$(mktemp -d -t autobugfix-wt)"
git worktree add --quiet "$WT" -b "$BRANCH" "origin/$MAIN_BRANCH" \
  || fail "could not create worktree at $WT"
log "worktree $WT on branch $BRANCH off origin/$MAIN_BRANCH (dry_run=$DRY_RUN)"

# R3: a fresh worktree has none of the gitignored files the session and build
# need. Link them in from the primary checkout.
ln -s "$REPO/.env.local" "$WT/.env.local" 2>/dev/null \
  || log "WARNING: could not link .env.local into the worktree (headless session may lack env)"
if [ -e "$REPO/node_modules" ]; then
  ln -s "$REPO/node_modules" "$WT/node_modules" 2>/dev/null \
    || log "WARNING: could not link node_modules into the worktree (tsc may fail)"
fi

cd "$WT" || fail "could not enter worktree $WT"
rm -f bugs/.auto-verdict.json

# Snapshot the (clean) worktree's untracked set so the commit step can exclude
# any pre-existing scratch, mirroring the old primary-checkout behavior (D2). A
# fresh worktree is clean by construction, so this is normally empty; the linked
# .env.local / node_modules are gitignored and never appear here.
PRE_UNTRACKED_FILE="$(mktemp -t autobugfix-untracked)"
git ls-files --others --exclude-standard -z > "$PRE_UNTRACKED_FILE"
PRE_UNTRACKED_COUNT="$(tr -cd '\0' < "$PRE_UNTRACKED_FILE" | wc -c | tr -d ' ')"
if [ "$PRE_UNTRACKED_COUNT" != "0" ]; then
  log "$PRE_UNTRACKED_COUNT untracked path(s) already in the worktree, will be excluded from the commit:"
  tr '\0' '\n' < "$PRE_UNTRACKED_FILE" | sed 's/^/    /'
fi

# ---------- run Claude Code headless ----------
# acceptEdits auto-approves file edits; Bash is allowed so the run never hangs on a
# permission prompt. The real guardrail is the merge gate below, not the tool list:
# nothing risky is ever auto-merged. Tighten allowedTools if you prefer (Claude may
# then fail on an unlisted command instead of running it).
PROMPT='You are running unattended. Read /Users/jaybalmer/linestry-ops/queues/NEXT-SESSION.md and implement the LEAD brief it points to ("Build this"); resolve that brief file by its name under /Users/jaybalmer/linestry-ops/briefs/. Take the recommended DECISIONS defaults in that brief. Follow the repo CLAUDE.md bug-session rules. Make npx tsc --noEmit clean. Append a status: pending entry to /Users/jaybalmer/linestry-ops/log/SHIP-LOG.md per its schema. Do NOT push, do NOT open a PR, do NOT merge anything; the wrapper handles git. The working tree may contain pre-existing untracked scratch files that are not yours: do not edit, move, or delete anything you did not create for this brief. As your final action, write a file bugs/.auto-verdict.json with exactly this shape: {"bug_ids":["BUG-041"],"risk":"safe","migration_required":false,"reason":"one line","title":"BUG-041: short PR title"}. Set risk to "needs-review" if the change touches a DB migration, a _public view, auth, payments/Stripe, memberships, or a data backfill, otherwise "safe".'

claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Edit,Write,Glob,Grep,Bash" \
  || fail "claude headless run errored"

# ---------- tsc gate (do not trust the model's word) ----------
log "running tsc gate"
if ! npx --yes tsc --noEmit; then
  record_run "checks-failed" "tsc gate failed before any PR was opened; the worktree is discarded and the run re-derives from the brief next time. Log: $LOG"
  notify "[Auto bug-fix] tsc failed, no PR opened" "The session's work was in a throwaway worktree (now removed); re-run to retry from the brief. Log: $LOG"
  log "tsc not clean; worktree will be removed by the exit trap"
  exit 1
fi

# ---------- read verdict ----------
VERDICT="bugs/.auto-verdict.json"
[ -f "$VERDICT" ] || fail "no verdict file written by the session"
RISK="$(grep -o '"risk"[^,]*' "$VERDICT" | grep -o 'safe\|needs-review' | head -1)"
MIG="$(grep -o '"migration_required"[^,]*' "$VERDICT" | grep -o 'true\|false' | head -1)"
TITLE="$(sed -n 's/.*"title":"\([^"]*\)".*/\1/p' "$VERDICT" | head -1)"
BUGS="$(sed -n 's/.*"bug_ids":\[\([^]]*\)\].*/\1/p' "$VERDICT" | tr -d '"' )"
REASON="$(sed -n 's/.*"reason":"\([^"]*\)".*/\1/p' "$VERDICT" | head -1)"
[ -z "$TITLE" ] && TITLE="Auto bug-fix $STAMP"
log "verdict: risk=$RISK migration=$MIG bugs=[$BUGS]"

# ---------- commit + push ----------
# Stage everything the session touched, then subtract the untracked paths that
# were already sitting in the tree when the run started. This is what lets the
# preflight tolerate untracked scratch: it is present during the run but can
# never reach a commit.
#
# D1: bugs/ and features/ are ops prose, already committed at preflight, and are
# excluded here UNCONDITIONALLY so the fix commit (and thus the PR diff) can never
# contain an ops path, even once every tracker is tracked. This also subsumes the
# old `git reset bugs/.auto-verdict.json`, since the verdict lives under bugs/.
# See features/ops-tree-hygiene-brief.md.
git add -A -- . ':(exclude)bugs' ':(exclude)features'
if [ "$PRE_UNTRACKED_COUNT" != "0" ]; then
  log "unstaging $PRE_UNTRACKED_COUNT pre-existing untracked path(s)"
  # Guarded by the count check: `git reset -- ` with no pathspec would unstage
  # the entire index, so this must never run on empty input.
  xargs -0 -n 50 git reset -q -- < "$PRE_UNTRACKED_FILE" 2>/dev/null || true
fi

if git diff --cached --quiet; then
  log "no changes were made"
  record_run "empty" "Session produced no committable change (branch created, nothing staged after excluding pre-existing untracked paths)."
  notify "[Auto bug-fix] nothing to ship" "The session produced no committable change. Log: $LOG"
  exit 0
fi

STAGED="$(git diff --cached --name-only)"
log "staged files:"; echo "$STAGED" | sed 's/^/    /'

git commit -q -m "$TITLE"
git push -q -u origin "$BRANCH"

# ---------- second guardrail: diff path check overrides a too-rosy verdict ----------
# Base is origin/main: the worktree branch was cut from it and local main may be stale.
CHANGED="$(git diff --name-only "origin/$MAIN_BRANCH"...HEAD)"
log "changed files:"; echo "$CHANGED" | sed 's/^/    /'
if echo "$CHANGED" | grep -qE "$RISKY_PATTERNS"; then
  log "diff touches a risky path, forcing needs-review"
  RISK="needs-review"
fi
[ "$MIG" = "true" ] && RISK="needs-review"

# ---------- prune merged remote auto branches ----------
# Only branches already fully merged into main are eligible, and never the one
# this run is using.
prune_merged_auto_branches() {
  [ "$PRUNE_BRANCHES" = "true" ] || return 0
  git fetch --quiet --prune origin 2>/dev/null || return 0
  local b
  for b in $(git branch -r --merged "origin/$MAIN_BRANCH" 2>/dev/null \
             | sed 's|^[[:space:]]*origin/||' \
             | grep "^$BRANCH_PREFIX" || true); do
    [ "$b" = "$BRANCH" ] && continue
    log "pruning merged remote branch $b"
    git push --quiet origin --delete "$b" 2>/dev/null || log "could not delete $b"
  done
}

# ---------- open PR ----------
PR_BODY="Automated fix for: $BUGS
Risk: $RISK
$REASON

Opened by scripts/auto-bugfix.sh. Vercel will attach a preview deployment.
Log: $LOG"

if [ "$RISK" = "safe" ] && [ "$DRY_RUN" = "false" ]; then
  PR_URL="$(gh pr create --base "$MAIN_BRANCH" --head "$BRANCH" --title "$TITLE" --body "$PR_BODY")"
  log "safe PR opened: $PR_URL"
  log "waiting for checks (Vercel preview + CI)"
  if gh pr checks "$BRANCH" --watch --fail-fast >/dev/null 2>&1; then
    if gh pr merge "$BRANCH" --squash --delete-branch; then
      log "merged to $MAIN_BRANCH, Vercel will deploy to prod"
      record_run "merged" "$PR_URL ($REASON)"
      notify "[Auto bug-fix] shipped to prod: $TITLE" "Bugs: $BUGS. PR: $PR_URL"
      prune_merged_auto_branches
    else
      log "merge failed"
      record_run "merge-failed" "Checks passed but gh pr merge failed. Merge by hand: $PR_URL"
      notify "[Auto bug-fix] safe PR ready but merge failed: $TITLE" "Merge by hand: $PR_URL"
    fi
  else
    record_run "checks-failed" "Checks failed on a safe PR, left unmerged: $PR_URL"
    notify "[Auto bug-fix] checks failed on a safe PR: $TITLE" "Review before merge: $PR_URL"
    log "checks failed, left unmerged"
  fi
else
  PR_URL="$(gh pr create --draft --base "$MAIN_BRANCH" --head "$BRANCH" --title "$TITLE" --body "$PR_BODY")"
  REASON_LINE="$REASON"
  [ "$DRY_RUN" = "true" ] && REASON_LINE="DRY RUN (always draft). $REASON"
  log "draft PR opened for review: $PR_URL"
  record_run "draft-needs-review" "$PR_URL. Held because: $REASON_LINE"
  notify "[Auto bug-fix] needs your review: $TITLE" "Bugs: $BUGS
Why held: $REASON_LINE
Test it on the Vercel preview (link in the PR), then merge if happy: $PR_URL"
fi

# Push the runner's own ops-state changes (the RUN-LOG row this run wrote, plus
# any SHIP-LOG line the session appended) to the mirror now, rather than waiting
# for the next preflight (D3).
sync_ops_repo

log "done."
