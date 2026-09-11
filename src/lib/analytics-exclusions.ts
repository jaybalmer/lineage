// Actor ids excluded from every /admin/funnel number (brief D8). This is the
// internal-humans list: Jay's own account, plus any staged test / plus-aliased
// fixtures. It is a constant, not a profiles column, because it is a ~6-item list
// that changes twice a year and a profiles migration would be GATED. The page
// echoes the excluded count so the exclusion is visible, not hidden.
//
// Bots are handled separately, at the sink (POST /api/track/event stamps
// props.bot = true), and filtered inside the RPCs. This list is humans only.
export const EXCLUDED_ACTOR_IDS: readonly string[] = [
  "0394914d-6ffd-4a18-aa1f-1aafee7ce53a", // Jay Balmer (jaybalmer@gmail.com)
  // TODO: add plus-aliased test-account ids here as they are created. None found
  // in the account list at ship time (2026-09-10).
]

// The date analytics_events instrumentation began (the diagnostics-phase-1
// migration, F1). The funnel view is only meaningful from here forward; the
// scoreboard states this so a near-empty pre-instrumentation window is not read
// as a real drop. Retention is derived from durable state and works before this.
export const INSTRUMENTATION_START = "2026-06-02"
