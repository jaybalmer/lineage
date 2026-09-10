// Coarse, PII-free bucket for a signup / sign-in failure, so the auth-gate cliff
// can be diagnosed in PostHog without logging raw error strings (D6). Auth error
// messages carry no email/PII, but bucketing keeps the funnel property clean.
//
// Extracted verbatim from save-step.tsx (T5) so the sign-in surface and the
// OAuth callback can bucket their errors the same way the signup surface does.
export function signupErrorClass(msg?: string | null): string {
  const m = (msg ?? "").toLowerCase()
  if (!m) return "unknown"
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to")) return "network"
  if (m.includes("rate") || m.includes("too many")) return "rate_limited"
  if (m.includes("no account") || m.includes("not found")) return "no_account"
  if (m.includes("popup") || m.includes("cancel") || m.includes("closed")) return "cancelled"
  if (m.includes("provider") || m.includes("oauth")) return "provider_error"
  return "other"
}
