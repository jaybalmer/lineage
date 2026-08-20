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
# ---------------------------------------------------------------------------
#
set -uo pipefail

# ---------- config (edit these if needed) ----------
REPO="${LINESTRY_REPO:-$HOME/lineage}"
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

# ---------- logging ----------
LOG_DIR="$HOME/Library/Logs/linestry-autobugfix"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1
log() { echo "[$(date +%H:%M:%S)] $*"; }

# ---------- run ledger ----------
# One row per run, appended at whichever outcome the run reaches. The morning
# digest reads this file. Idempotent: only the first call in a run writes.
# Outcome vocabulary (keep stable, the digest keys on it):
#   merged | draft-needs-review | checks-failed | merge-failed
#   | paused | no-op | empty | aborted
RUNLOG="$REPO/bugs/RUN-LOG.md"
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

# ---------- exit trap ----------
# Always leave the repo on main and always leave a ledger row behind. Without
# this, a tsc failure parked the checkout on the auto branch and the next
# morning's triage read that as "a session is in progress".
cleanup() {
  local code=$?
  if [ "$RUN_RECORDED" != "true" ]; then
    record_run "aborted" "Exited with code $code before reaching a recorded outcome. Log: $LOG"
  fi
  [ -n "$PRE_UNTRACKED_FILE" ] && rm -f "$PRE_UNTRACKED_FILE"
  if [ -n "$BRANCH" ]; then
    git -C "$REPO" checkout --quiet "$MAIN_BRANCH" 2>/dev/null \
      && log "returned to $MAIN_BRANCH" \
      || log "could not return to $MAIN_BRANCH (repo left on $BRANCH)"
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

# Dirty-tree classification.
#
# BLOCKING: modified or staged TRACKED files. That is genuine in-progress work
# and the run must leave it alone.
TRACKED_DIRT="$(git status --porcelain --untracked-files=no)"
if [ -n "$TRACKED_DIRT" ]; then
  log "tracked changes present:"; echo "$TRACKED_DIRT" | sed 's/^/    /'
  fail "working tree has uncommitted changes to tracked files, leaving your work alone"
fi

# TOLERATED: untracked files. They cannot conflict with a branch checkout, and
# blocking on them is what silently killed three nights of runs. Snapshot the
# set now so the commit step can exclude exactly these paths later.
PRE_UNTRACKED_FILE="$(mktemp -t autobugfix-untracked)"
git ls-files --others --exclude-standard -z > "$PRE_UNTRACKED_FILE"
PRE_UNTRACKED_COUNT="$(tr -cd '\0' < "$PRE_UNTRACKED_FILE" | wc -c | tr -d ' ')"
if [ "$PRE_UNTRACKED_COUNT" != "0" ]; then
  log "$PRE_UNTRACKED_COUNT untracked path(s) present and tolerated; they will be excluded from the commit:"
  tr '\0' '\n' < "$PRE_UNTRACKED_FILE" | sed 's/^/    /'
fi

# only one auto PR in flight at a time
OPEN_AUTO="$(gh pr list --state open --search "head:$BRANCH_PREFIX" --json number --jq 'length' 2>/dev/null || echo 0)"
if [ "$OPEN_AUTO" != "0" ]; then
  log "an auto PR is already open and awaiting review/merge, pausing. Nothing to do."
  record_run "paused" "An auto PR is already open awaiting review or merge; run took no action."
  exit 0
fi

git fetch --quiet origin
git checkout --quiet "$MAIN_BRANCH"
git pull --quiet --ff-only origin "$MAIN_BRANCH" || fail "could not fast-forward $MAIN_BRANCH"

# is there a brief?
NS="bugs/NEXT-SESSION.md"
if [ ! -f "$NS" ]; then
  log "no $NS, nothing to do."
  record_run "no-op" "No bugs/NEXT-SESSION.md present."
  exit 0
fi
if grep -qi "NO BUILD-READY BRIEF YET" "$NS"; then
  log "triage left no build-ready brief, nothing to do."
  record_run "no-op" "Triage left NO BUILD-READY BRIEF YET; nothing to implement."
  exit 0
fi

# ---------- branch ----------
STAMP="$(date +%Y%m%d-%H%M)"
BRANCH="$BRANCH_PREFIX-$STAMP"
git checkout --quiet -b "$BRANCH"
log "working on branch $BRANCH (dry_run=$DRY_RUN)"
rm -f bugs/.auto-verdict.json

# ---------- run Claude Code headless ----------
# acceptEdits auto-approves file edits; Bash is allowed so the run never hangs on a
# permission prompt. The real guardrail is the merge gate below, not the tool list:
# nothing risky is ever auto-merged. Tighten allowedTools if you prefer (Claude may
# then fail on an unlisted command instead of running it).
PROMPT='You are running unattended. Read bugs/NEXT-SESSION.md and implement the LEAD brief it points to ("Build this"). Take the recommended DECISIONS defaults in that brief. Follow the repo CLAUDE.md bug-session rules. Make npx tsc --noEmit clean. Append a status: pending entry to bugs/SHIP-LOG.md per its schema. Do NOT push, do NOT open a PR, do NOT merge anything; the wrapper handles git. The working tree may contain pre-existing untracked scratch files that are not yours: do not edit, move, or delete anything you did not create for this brief. As your final action, write a file bugs/.auto-verdict.json with exactly this shape: {"bug_ids":["BUG-041"],"risk":"safe","migration_required":false,"reason":"one line","title":"BUG-041: short PR title"}. Set risk to "needs-review" if the change touches a DB migration, a _public view, auth, payments/Stripe, memberships, or a data backfill, otherwise "safe".'

claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Edit,Write,Glob,Grep,Bash" \
  || fail "claude headless run errored"

# ---------- tsc gate (do not trust the model's word) ----------
log "running tsc gate"
if ! npx --yes tsc --noEmit; then
  record_run "checks-failed" "tsc gate failed before any PR was opened. Branch $BRANCH left locally for inspection. Log: $LOG"
  notify "[Auto bug-fix] tsc failed, no PR opened" "Branch $BRANCH left locally for inspection. Log: $LOG"
  log "tsc not clean"
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
git add -A
git reset -q bugs/.auto-verdict.json 2>/dev/null || true   # never commit the verdict
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
CHANGED="$(git diff --name-only "$MAIN_BRANCH"...HEAD)"
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

log "done."
