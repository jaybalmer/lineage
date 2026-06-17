// Post-login returnTo handling (BUG-054). A returnTo can arrive from an
// untrusted source (a query param a user crafted, a comment-email deep link), so
// it is always validated down to a same-origin relative path before any redirect.
// This is the single guard against an open redirect bouncing a freshly signed-in
// user to an attacker-controlled site.

// Control characters (and DEL) that could smuggle a scheme or host past the
// prefix checks below.
const CONTROL_CHARS = /[\x00-\x1f\x7f]/

/**
 * Return the path when it is a safe same-origin relative target, else null.
 * Rejects absolute and scheme URLs ("https://", "javascript:"), protocol-relative
 * targets ("//host"), backslash variants that browsers fold into slashes
 * ("/\\host"), and control characters used to smuggle any of the above.
 */
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  if (!raw.startsWith("/")) return null                          // must be root-relative
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null // protocol-relative
  if (raw.includes("\\")) return null                            // backslash smuggling
  if (CONTROL_CHARS.test(raw)) return null                       // control chars
  return raw
}

/**
 * Build the /auth/signin href that carries where to return after login. Prefers
 * a returnTo already present on the page (e.g. one a comment-email link stamped)
 * over the raw current path, so the value is never nested inside itself.
 */
export function signInHref(
  currentPathWithSearch: string,
  existingReturnTo?: string | null,
): string {
  const target = safeReturnTo(existingReturnTo) ?? safeReturnTo(currentPathWithSearch)
  return target ? `/auth/signin?returnTo=${encodeURIComponent(target)}` : "/auth/signin"
}
