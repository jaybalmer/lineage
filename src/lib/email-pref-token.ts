// Signed tokens for the one-click "change how often" links in comment emails.
// Server-only (uses node crypto). A token is an HMAC over `${userId}:${pref}`,
// so each link does exactly one thing for exactly one person and cannot be
// edited to target another account or another setting.
import crypto from "node:crypto"
import type { CommentEmailPref } from "@/lib/comment-email-prefs"

// The service-role key never leaves the server and the token is a one-way
// HMAC, so it is a safe signing key without adding a new env var. We hash it
// once with a fixed label so the raw key is never the literal HMAC key.
function signingKey(): string {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  return crypto.createHash("sha256").update(`comment-email-pref:${base}`).digest("hex")
}

export function signEmailPrefToken(userId: string, pref: CommentEmailPref): string {
  return crypto.createHmac("sha256", signingKey()).update(`${userId}:${pref}`).digest("hex").slice(0, 32)
}

export function verifyEmailPrefToken(userId: string, pref: CommentEmailPref, token: string): boolean {
  const expected = signEmailPrefToken(userId, pref)
  if (typeof token !== "string" || token.length !== expected.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}
