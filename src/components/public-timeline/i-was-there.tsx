"use client"

// PB-010 Phase 4a: the "I was there" affordance + inline claim sheet.
//
// This is the activating surface of the public tag-to-claim loop. It lives on
// the public story card (timeline) and on story/place/event Stack cards. It is a
// fully self-contained client island: NO store, NO auth — it posts the visitor's
// name + email to /api/public/tag and transitions in place to a "check your
// email" state. No modal, no signup screen (spec). The form lives on a light
// surface, so `variant="panel"` wraps it in its own light strip when it sits on
// the dark Stack ground; `variant="inline"` blends into the light story card.

import { useState } from "react"
import { cn } from "@/lib/utils"

export type TagMoment = { kind: "place" | "event" | "story"; id: string }

type EventRole = "spectator" | "competitor" | "organizer"

const ROLES: { key: EventRole; label: string }[] = [
  { key: "spectator", label: "I watched" },
  { key: "competitor", label: "I competed" },
  { key: "organizer", label: "I organized" },
]

const CTA: Record<TagMoment["kind"], string> = {
  place: "I rode there",
  event: "I was there",
  story: "I was there too",
}

const INPUT =
  "w-full rounded-md border border-border-default bg-surface px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"

export function IWasThere({
  ownerSlug,
  ownerName,
  moment,
  linkedEvent,
  variant = "inline",
}: {
  ownerSlug: string
  ownerName: string
  moment: TagMoment
  /** Set on an event-linked story: offer spectator / competitor / organizer,
   *  tagged on the story AND this event. */
  linkedEvent?: { id: string; name: string }
  variant?: "inline" | "panel"
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<EventRole>("spectator")
  const [note, setNote] = useState("")

  // Event moments and event-linked stories both pick a role.
  const showRoles = moment.kind === "event" || (moment.kind === "story" && !!linkedEvent)
  const [submitting, setSubmitting] = useState(false)
  const [doneLabel, setDoneLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const wrapCls = variant === "panel"
    ? "postcard bg-surface rounded-xl mt-1.5 px-3.5 py-3"
    : "mt-3 pt-3 border-t border-border-default"

  // Stop clicks bubbling to a click-to-expand Stack card behind the affordance.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (submitting) return
    setError(null)
    if (!name.trim() || !email.trim() || !email.includes("@")) {
      setError("Add your name and a valid email.")
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch("/api/public/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: ownerSlug,
          moment,
          name: name.trim(),
          email: email.trim(),
          role: showRoles ? role : undefined,
          // Event-linked story: tells the server which event to tag alongside
          // the story (the moment id is the story id in that case).
          eventId: moment.kind === "story" && linkedEvent ? linkedEvent.id : undefined,
          note: note.trim() || undefined,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        momentLabel?: string
      }
      if (!r.ok || !j.ok) {
        setError(j.error ?? "Could not save your mark. Try again.")
        return
      }
      setDoneLabel(j.momentLabel ?? "this moment")
    } catch {
      setError("Could not save your mark. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (doneLabel) {
    return (
      <div className={wrapCls} onClick={stop}>
        <p className="text-xs text-foreground leading-relaxed">
          <span className="font-semibold">Marked.</span> Check{" "}
          <span className="font-medium">{email.trim()}</span> to claim your spot
          at <span className="font-medium">{doneLabel}</span>.
        </p>
      </div>
    )
  }

  if (!open) {
    return (
      <div className={wrapCls} onClick={stop}>
        <button
          type="button"
          onClick={(e) => {
            stop(e)
            setOpen(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-hover px-3 py-1.5 text-xs font-semibold text-accent-strong hover:bg-surface-active transition-colors"
        >
          <span aria-hidden className="text-sm leading-none">＋</span>
          {CTA[moment.kind]}
        </button>
      </div>
    )
  }

  return (
    <form className={wrapCls} onClick={stop} onSubmit={submit}>
      <p className="text-xs text-muted mb-2 leading-relaxed">
        Mark your spot on {ownerName}&rsquo;s timeline. We&rsquo;ll email you a
        link to claim it on Linestry.
      </p>
      <div className="flex flex-col gap-2">
        <input
          className={INPUT}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoComplete="name"
        />
        <input
          className={INPUT}
          placeholder="Your email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          autoComplete="email"
        />
        {showRoles && (
          <div className="flex flex-col gap-1.5">
            {moment.kind === "story" && linkedEvent && (
              <span className="text-[11px] text-muted">
                Your role at <span className="font-medium text-foreground">{linkedEvent.name}</span>
              </span>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              {ROLES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={(e) => {
                    stop(e)
                    setRole(key)
                  }}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    role === key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-surface text-muted border-border-default hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <input
          className={INPUT}
          placeholder="Add a note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex items-center gap-2 mt-2.5">
        <button
          type="submit"
          disabled={submitting}
          className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {submitting ? "Marking…" : "Mark it"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            stop(e)
            setOpen(false)
          }}
          className="px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
