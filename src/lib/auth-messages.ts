// Shared copy for the auth error codes already stamped into redirect URLs
// (?error=...). One home for the strings, so every landing renders a real
// message instead of a normal page, and an unknown code falls back to a
// sentence rather than rendering nothing (which was the bug). Copy of record:
// features/funnel-drop-off-repairs-brief.md Appendix A. No em dashes.
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  no_code:
    "That sign-in did not finish. Nothing you entered was lost. Try again below.",
  auth_failed:
    "We could not finish signing you in. The link may have already been used. Try again below and it should go through.",
  link_expired:
    "That link has expired. Links last one hour. Enter your email and we will send a fresh one.",
  default: "Something interrupted that sign-in. Try again below.",
}

/**
 * Resolve an auth error code (as it appears in a ?error= param) to a
 * user-facing message. Returns null for a null or empty code, the mapped
 * string for a known code, and the generic default for an unknown one. Never
 * returns or renders the raw code.
 */
export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  return AUTH_ERROR_MESSAGES[code] ?? AUTH_ERROR_MESSAGES.default
}
