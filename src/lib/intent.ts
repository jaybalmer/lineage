// Signup-intent handoff (features/signup-intent-handoff-brief.md).
//
// An "intent" is a small pointer that rides through the signup chain inside
// `returnTo` and is spent ONCE on arrival: it names a destination page and,
// optionally, an action to perform there and the subject that action is about.
// Its wire format is a plain internal URL, e.g.
//   /people/<uuid>?intent=add-story&subject=<uuid>
// which is what gets URL-encoded into `?returnTo=`. Because `safeReturnTo`
// already lets query strings pass through untouched, every hop that carries
// `returnTo` carries the intent for free.
//
// What an intent MAY contain: a root-relative destination path, an action from
// the hard allowlist below, and a uuid subject. What it MAY NOT contain: any
// free text, any action outside the allowlist, or any content to submit. The
// replay it drives may only ever OPEN a prefilled surface, never complete one.
// See section 10 of the brief before adding a second action type.

import { safeReturnTo } from "@/lib/safe-redirect"

/** Hard allowlist of replayable actions. Exactly one in v1. */
export const INTENT_ACTIONS = ["add-story"] as const
export type IntentAction = (typeof INTENT_ACTIONS)[number]

/** The reserved query-param names an intent uses. */
export const INTENT_PARAMS = ["intent", "subject"] as const

export type Intent = {
  /** Destination, root-relative; may carry its own unrelated query params. */
  path: string
  action?: IntentAction
  subject?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isIntentAction(value: string | null): value is IntentAction {
  return value != null && (INTENT_ACTIONS as readonly string[]).includes(value)
}

/**
 * Encode an intent into the internal URL that callers put in `?returnTo=`.
 * Preserves any unrelated query param already on `path`. When the action is
 * absent or not in the allowlist, returns the bare destination path (a stale or
 * unknown intent degrades to a plain navigation). Callers still wrap the result
 * in `encodeURIComponent` once when building the `returnTo` query param.
 */
export function encodeIntent(intent: Intent): string {
  const { path, action, subject } = intent
  if (!isIntentAction(action ?? null)) return path
  const qIndex = path.indexOf("?")
  const pathname = qIndex === -1 ? path : path.slice(0, qIndex)
  const params = new URLSearchParams(qIndex === -1 ? "" : path.slice(qIndex + 1))
  params.set("intent", action as string)
  if (subject) params.set("subject", subject)
  const qs = params.toString()
  const assembled = qs ? `${pathname}?${qs}` : pathname
  // Validate the whole thing through the same guard every consumer uses; fall
  // back to the bare path if our own construction somehow fails it.
  return safeReturnTo(assembled) ?? path
}

/**
 * Read an intent from a query string or URLSearchParams. Returns null unless a
 * recognised `intent` action is present AND `subject` is a well-formed uuid. No
 * free text is ever accepted, and no param other than the reserved two is read.
 * The returned `path` is empty: a reader only ever runs on the page the URL
 * already names, so it does not recover a destination.
 */
export function readIntent(search: string | URLSearchParams): Intent | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search
  const action = params.get("intent")
  if (!isIntentAction(action)) return null
  const subject = params.get("subject")
  if (!subject || !UUID_RE.test(subject)) return null
  return { path: "", action, subject }
}

/**
 * Return the query string with the reserved intent params removed, keeping any
 * unrelated params. Used to clear the intent from the URL after replay so it
 * fires once and never re-fires on reload or Back.
 */
export function stripIntent(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  for (const name of INTENT_PARAMS) params.delete(name)
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}
