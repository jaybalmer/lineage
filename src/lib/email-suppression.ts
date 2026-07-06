// Email suppression: the store + helpers behind one-click List-Unsubscribe.
//
// A notification email carries a List-Unsubscribe header pointing at
// GET/POST /api/unsubscribe, which records the address in email_suppressions.
// Every notification send path calls isEmailSuppressed(email) first and skips a
// suppressed recipient, so an unsubscribe is honored on the very next send. The
// store is keyed on the raw (lowercased) email because recipients include
// non-members (invitees, ghosts) with no profiles row.
//
// Server-only (uses the service client + node crypto via the token module).
import { getServiceClient } from "@/lib/auth"
import { signUnsubscribeToken } from "@/lib/unsubscribe-token"

const BASE_URL = "https://linestry.com"

function normalize(email: string): string {
  return email.trim().toLowerCase()
}

// The hosted one-click unsubscribe URL for an address. The email is base64url
// encoded so it is not carried in the clear in header/log lines, and the token
// authorizes the suppression (no login on the POST from a mail provider).
export function unsubscribeUrl(email: string): string {
  const e = Buffer.from(normalize(email), "utf8").toString("base64url")
  const t = signUnsubscribeToken(email)
  return `${BASE_URL}/api/unsubscribe?e=${e}&t=${t}`
}

// RFC 8058 one-click List-Unsubscribe headers for a given recipient. Attach only
// to list-like notification emails, never to security or internal emails.
export function listUnsubscribeHeaders(email: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(email)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}

// True when the address has unsubscribed. Fails open (returns false) on a query
// error so a transient DB hiccup never silently drops a legitimate send.
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const addr = normalize(email)
  if (!addr) return false
  try {
    const db = getServiceClient()
    const { data, error } = await db
      .from("email_suppressions")
      .select("email")
      .eq("email", addr)
      .maybeSingle()
    if (error) {
      console.error("[email-suppression] lookup failed:", error.message)
      return false
    }
    return !!data
  } catch (err) {
    console.error("[email-suppression] lookup threw:", err)
    return false
  }
}

// Record an unsubscribe. Idempotent (upsert on the email PK).
export async function suppressEmail(email: string, source: string): Promise<boolean> {
  const addr = normalize(email)
  if (!addr) return false
  try {
    const db = getServiceClient()
    const { error } = await db
      .from("email_suppressions")
      .upsert({ email: addr, source }, { onConflict: "email", ignoreDuplicates: true })
    if (error) {
      console.error("[email-suppression] upsert failed:", error.message)
      return false
    }
    return true
  } catch (err) {
    console.error("[email-suppression] upsert threw:", err)
    return false
  }
}
