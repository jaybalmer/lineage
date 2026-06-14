#!/usr/bin/env bash
# SessionEnd safety net for bugs/SHIP-LOG.md.
# Appends a minimal PENDING auto-stub if a build session shipped and the agent
# did not already log it. Idempotent and silent. Never fails a session.
#
# Writers: the build agent writes the rich entry (normal path); this script is
# the fallback; the daily Cowork reconcile flips pending to merged. See the
# header of bugs/SHIP-LOG.md.

set -u
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

LOG="bugs/SHIP-LOG.md"
[ -f "$LOG" ] || exit 0   # gitignored, local only; no-op on a fresh clone

BRANCH=$(git branch --show-current 2>/dev/null)
[ -n "$BRANCH" ] && [ "$BRANCH" != "main" ] || exit 0           # not on a work branch
[ "$(git rev-list --count main..HEAD 2>/dev/null || echo 0)" -gt 0 ] || exit 0  # nothing built
grep -q "branch: ${BRANCH}\$" "$LOG" && exit 0                  # already logged this branch

SHA=$(git rev-parse --short HEAD 2>/dev/null)
IDS=$(git log main..HEAD --format='%s %b' 2>/dev/null | grep -oE 'BUG-[0-9]+' | sort -u | paste -sd, -)
[ -n "$IDS" ] || IDS="none"

TYPE="feature"
printf '%s' "$IDS" | grep -q "BUG" && TYPE="bug"

PR=$(gh pr view "$BRANCH" --json number -q .number 2>/dev/null)
[ -n "$PR" ] && PR="#$PR" || PR="(open PR)"

printf '\n## %s - PENDING auto-stub (%s)\n- type: %s\n- pr: %s\n- branch: %s\n- commit: %s\n- ids: %s\n- status: pending\n- tsc: n/a\n\n_Auto-stub from the SessionEnd hook (agent did not log this session). Expand to a one-line summary and flip status to merged during the daily reconcile._\n' \
  "$(date +%F)" "$BRANCH" "$TYPE" "$PR" "$BRANCH" "$SHA" "$IDS" >> "$LOG"

exit 0
