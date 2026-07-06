// Signed tokens for the one-click List-Unsubscribe links on notification emails.
// Server-only (uses node crypto). A token is an HMAC over the lowercased email,
// so an unsubscribe link only ever suppresses the address it was minted for and
// cannot be edited to unsubscribe someone else.
import crypto from "node:crypto"

// The service-role key never leaves the server and the token is a one-way HMAC,
// so it is a safe signing key without adding a new env var. We hash it once with
// a fixed label so the raw key is never the literal HMAC key. Mirrors
// src/lib/email-pref-token.ts.
function signingKey(): string {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  return crypto.createHash("sha256").update(`email-unsubscribe:${base}`).digest("hex")
}

function normalize(email: string): string {
  return email.trim().toLowerCase()
}

export function signUnsubscribeToken(email: string): string {
  return crypto.createHmac("sha256", signingKey()).update(normalize(email)).digest("hex").slice(0, 32)
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = signUnsubscribeToken(email)
  if (typeof token !== "string" || token.length !== expected.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}
