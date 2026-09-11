// First-touch acquisition attribution. Client-safe, no server imports.
//
// This is the single place the stored shape is defined; everything else imports
// from here. The storage contract (the Touch shape, the localStorage key, the
// 90-day lifecycle, the PII-free props builder) is written so the durable
// `acquisition` build later reads exactly what this writes: the episode-1 carve
// ships capture + two stamped events, and adds nothing this file has to change.
//
// Why localStorage and not the Zustand store: capture has to run before React
// hydrates (see src/instrumentation-client.ts), and a standalone key is untouched
// by resetPerUserState() on sign-out, which is correct — a first touch belongs to
// the browser, not to whoever is signed in. Every access is wrapped in try/catch
// because localStorage throws (not just returns null) in private windows, with
// site data blocked, and in some embedded webviews; the repo already takes this
// posture for sessionStorage (src/components/onboarding/onboarding-flow.tsx).

export const ATTRIBUTION_STORAGE_KEY = "linestry_attribution_v1"
export const ATTRIBUTION_TTL_DAYS = 90

const MAX_VALUE_LEN = 64

/** A single acquisition touch. Every field but `at` is a sanitised tag or null. */
export interface Touch {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  ref: string | null
  /** Origin-only for cross-origin visits (next.config Referrer-Policy). */
  referrer: string | null
  /** Pathname only, never the query string. */
  landing_path: string | null
  /** ISO 8601 capture time. */
  at: string
}

export interface StoredAttribution {
  first: Touch
  last: Touch
}

/**
 * Marketing tags only, so a tight allowlist: lowercased, trimmed, non-matching
 * characters stripped to [a-z0-9_.-], truncated to 64 chars. Returns null for
 * anything that sanitises to empty, so a blank param never masquerades as a value.
 */
function sanitizeTag(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = String(raw)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, MAX_VALUE_LEN)
  return cleaned.length > 0 ? cleaned : null
}

/**
 * Build a Touch from the current location, or null when the visit carries no
 * acquisition signal at all (no UTM params, no `ref`, and an empty or same-origin
 * referrer). Returning null is what stops an internal click from overwriting
 * last-touch with nothing.
 */
export function parseTouch(search: string, referrer: string, pathname: string): Touch | null {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  } catch {
    params = new URLSearchParams("")
  }

  const source = sanitizeTag(params.get("utm_source"))
  const medium = sanitizeTag(params.get("utm_medium"))
  const campaign = sanitizeTag(params.get("utm_campaign"))
  const content = sanitizeTag(params.get("utm_content"))
  const term = sanitizeTag(params.get("utm_term"))
  const ref = sanitizeTag(params.get("ref"))

  // Is the referrer external? An empty or same-origin referrer is not a signal.
  let externalReferrer: string | null = null
  if (referrer) {
    try {
      const refHost = new URL(referrer).host
      const ownHost = typeof window !== "undefined" ? window.location.host : ""
      if (refHost && refHost !== ownHost) externalReferrer = referrer
    } catch {
      // A malformed referrer is not a usable signal.
    }
  }

  const hasSignal =
    source || medium || campaign || content || term || ref || externalReferrer
  if (!hasSignal) return null

  return {
    source,
    medium,
    campaign,
    content,
    term,
    ref,
    // Stored as given; per next.config Referrer-Policy this is already origin-only
    // for cross-origin visits.
    referrer: externalReferrer,
    // Pathname only, so a stray appended parameter cannot smuggle content in.
    landing_path: pathname || null,
    at: new Date().toISOString(),
  }
}

function readRaw(): StoredAttribution | null {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAttribution
    if (!parsed || !parsed.first || !parsed.last) return null
    return parsed
  } catch {
    return null
  }
}

function writeRaw(value: StoredAttribution): void {
  try {
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // no-op: private window, blocked site data, or embedded webview.
  }
}

function isExpired(first: Touch): boolean {
  const firstMs = Date.parse(first.at)
  if (Number.isNaN(firstMs)) return true
  const ageMs = Date.now() - firstMs
  return ageMs > ATTRIBUTION_TTL_DAYS * 24 * 60 * 60 * 1000
}

/**
 * The whole storage lifecycle. `first` is never overwritten (unless the record
 * has expired, which discards it whole); a later signalling visit updates `last`
 * only. Runs on a full page load only, which is by definition when first-touch
 * happens, so soft-nav last-touch misses are irrelevant (campaign links are
 * external).
 */
export function captureTouch(): void {
  let search = ""
  let referrer = ""
  let pathname = ""
  try {
    search = window.location.search
    referrer = document.referrer
    pathname = window.location.pathname
  } catch {
    return
  }

  const touch = parseTouch(search, referrer, pathname)
  if (!touch) return

  const existing = readRaw()

  if (!existing || isExpired(existing.first)) {
    writeRaw({ first: touch, last: touch })
    return
  }

  // Record present and fresh: update last-touch only. first is immutable.
  writeRaw({ first: existing.first, last: touch })
}

export function readAttribution(): StoredAttribution | null {
  return readRaw()
}

export function clearAttribution(): void {
  try {
    localStorage.removeItem(ATTRIBUTION_STORAGE_KEY)
  } catch {
    // no-op.
  }
}

/**
 * Flat, prefixed, PII-free props built from FIRST touch, with null fields omitted
 * entirely rather than sent as null. Spread directly into trackEvent props, so
 * this shape IS the PostHog property namespace: every key is prefixed `attr_` and
 * every value is a short sanitised string. Returns {} when nothing is stored, so
 * every call site can spread it unconditionally and degrade to today's behaviour.
 */
export function attributionProps(): Record<string, string> {
  return attributionPropsFrom(readRaw())
}

/**
 * The same mapping as attributionProps() but from a supplied record rather than
 * from localStorage, so the cross-device path (a magic link opened on another
 * device, where localStorage is empty but the touch rode the pending_onboarding
 * stash) can stamp the same props. Returns {} for null.
 */
export function attributionPropsFrom(stored: StoredAttribution | null): Record<string, string> {
  if (!stored?.first) return {}
  const f = stored.first
  const out: Record<string, string> = {}

  if (f.source) out.attr_source = f.source
  if (f.medium) out.attr_medium = f.medium
  if (f.campaign) out.attr_campaign = f.campaign
  if (f.content) out.attr_content = f.content
  if (f.term) out.attr_term = f.term
  if (f.ref) out.attr_ref = f.ref
  if (f.landing_path) out.attr_landing_path = f.landing_path
  if (f.at) out.attr_first_seen_at = f.at

  // Host only, never the full referrer (D8). Drop the field if it does not parse.
  if (f.referrer) {
    try {
      const host = new URL(f.referrer).host
      if (host) out.attr_referrer_host = host
    } catch {
      // drop it
    }
  }

  return out
}
