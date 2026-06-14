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
set -uo pipefail

# ---------- config (edit these if needed) ----------
REPO="${LINESTRY_REPO:-$HOME/lineage}"
NOTIFY_EMAIL="${LINESTRY_NOTIFY_EMAIL:-jaybalmer@gmail.com}"
MAIN_BRANCH="main"
BRANCH_PREFIX="auto/bugfix"
DRY_RUN="false"
[ "${1:-}" = "--dry-run" ] && DRY_RUN="true"

# Risky paths: if the diff touches any of these, never auto-merge. Hand to Jay.
RISKY_PATTERNS='supabase/migrations/|_public|src/lib/auth\.|src/app/api/auth/|stripe|memberships|backfill'

# ---------- logging ----------
LOG_DIR="$HOME/Library/Logs/linestry-autobugfix"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1
log() { echo "[$(date +%H:%M:%S)] $*"; }

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

fail() { log "ABORT: $*"; notify "[Auto bug-fix] stopped: $*" "Run log: $LOG"; exit 1; }

# ---------- preflight ----------
cd "$REPO" || fail "repo not found at $REPO"
command -v claude >/dev/null || fail "claude CLI not on PATH"
command -v gh >/dev/null || fail "gh CLI not on PATH"
gh auth status >/dev/null 2>&1 || fail "gh not authenticated (run: gh auth login)"

# do not touch uncommitted work
if [ -n "$(git status --porcelain)" ]; then
  fail "working tree is dirty, leaving your uncommitted work alone"
fi

# only one auto PR in flight at a time
OPEN_AUTO="$(gh pr list --state open --search "head:$BRANCH_PREFIX" --json number --jq 'length' 2>/dev/null || echo 0)"
if [ "$OPEN_AUTO" != "0" ]; then
  log "an auto PR is already open and awaiting review/merge, pausing. Nothing to do."
  exit 0
fi

git fetch --quiet origin
git checkout --quiet "$MAIN_BRANCH"
git pull --quiet --ff-only origin "$MAIN_BRANCH" || fail "could not fast-forward $MAIN_BRANCH"

# is there a brief?
NS="bugs/NEXT-SESSION.md"
[ -f "$NS" ] || { log "no $NS, nothing to do."; exit 0; }
if grep -qi "NO BUILD-READY BRIEF YET" "$NS"; then
  log "triage left no build-ready brief, nothing to do."
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
PROMPT='You are running unattended. Read bugs/NEXT-SESSION.md and implement the LEAD brief it points to ("Build this"). Take the recommended DECISIONS defaults in that brief. Follow the repo CLAUDE.md bug-session rules. Make npx tsc --noEmit clean. Append a status: pending entry to bugs/SHIP-LOG.md per its schema. Do NOT push, do NOT open a PR, do NOT merge anything; the wrapper handles git. As your final action, write a file bugs/.auto-verdict.json with exactly this shape: {"bug_ids":["BUG-041"],"risk":"safe","migration_required":false,"reason":"one line","title":"BUG-041: short PR title"}. Set risk to "needs-review" if the change touches a DB migration, a _public view, auth, payments/Stripe, memberships, or a data backfill, otherwise "safe".'

claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Edit,Write,Glob,Grep,Bash" \
  || fail "claude headless run errored"

# ---------- tsc gate (do not trust the model's word) ----------
log "running tsc gate"
if ! npx --yes tsc --noEmit; then
  notify "[Auto bug-fix] tsc failed, no PR opened" "Branch $BRANCH left locally for inspection. Log: $LOG"
  fail "tsc not clean"
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
git add -A
git reset -q bugs/.auto-verdict.json 2>/dev/null || true   # never commit the verdict
if git diff --cached --quiet; then fail "no changes were made"; fi
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
    gh pr merge "$BRANCH" --squash --delete-branch \
      && { log "merged to $MAIN_BRANCH, Vercel will deploy to prod"; \
           notify "[Auto bug-fix] shipped to prod: $TITLE" "Bugs: $BUGS. PR: $PR_URL"; } \
      || { log "merge failed"; notify "[Auto bug-fix] safe PR ready but merge failed: $TITLE" "Merge by hand: $PR_URL"; }
  else
    notify "[Auto bug-fix] checks failed on a safe PR: $TITLE" "Review before merge: $PR_URL"
    log "checks failed, left unmerged"
  fi
else
  PR_URL="$(gh pr create --draft --base "$MAIN_BRANCH" --head "$BRANCH" --title "$TITLE" --body "$PR_BODY")"
  REASON_LINE="$REASON"
  [ "$DRY_RUN" = "true" ] && REASON_LINE="DRY RUN (always draft). $REASON"
  log "draft PR opened for review: $PR_URL"
  notify "[Auto bug-fix] needs your review: $TITLE" "Bugs: $BUGS
Why held: $REASON_LINE
Test it on the Vercel preview (link in the PR), then merge if happy: $PR_URL"
fi

git checkout --quiet "$MAIN_BRANCH"
log "done."
