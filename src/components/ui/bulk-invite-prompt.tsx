"use client"

import { useEffect, useMemo, useState } from "react"
import { InviteRiderModal } from "@/components/ui/invite-rider-modal"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import {
  isInvitableNodeStatus,
  trackInviteEvent,
  type InviteSurface,
} from "@/lib/invite-tracking"
import type { Claim, Person, Story } from "@/types"

const DISMISS_KEY = "lineage_invite_bulk_dismissed_count"

interface UnclaimedRider {
  person: Person
  /** How many of the viewer's claims/stories reference this rider */
  refs: number
  /** Surface origin context for analytics */
  origins: { claims: number; stories: number }
}

interface BulkInvitePromptProps {
  activePersonId: string
  claims: Claim[]            // viewer's own personClaims (subject_id === activePersonId)
  allClaims: Claim[]         // full claim set so we can find companion claims I asserted
  stories: Story[]           // viewer's own stories
  people: Person[]           // catalog people
}

// Walks the viewer's data and returns every unclaimed rider they've touched.
function collectUnclaimedRiders({
  activePersonId,
  claims,
  allClaims,
  stories,
  people,
}: BulkInvitePromptProps): UnclaimedRider[] {
  const refs = new Map<string, { claims: number; stories: number }>()
  const bump = (id: string, kind: "claims" | "stories") => {
    if (!id || id === activePersonId) return
    const cur = refs.get(id) ?? { claims: 0, stories: 0 }
    cur[kind] += 1
    refs.set(id, cur)
  }

  // Direct person-object claims authored by the viewer (rode_with, coached_by, shot_by, …)
  for (const c of claims) {
    if (c.object_type === "person") bump(c.object_id, "claims")
  }
  // Companion claims the viewer wrote on other people
  for (const c of allClaims) {
    if (c.asserted_by === activePersonId && c.subject_type === "person" && c.subject_id !== activePersonId) {
      bump(c.subject_id, "claims")
    }
  }
  // Tagged riders in the viewer's stories
  for (const s of stories) {
    for (const rid of s.rider_ids ?? []) bump(rid, "stories")
  }

  const byId = new Map(people.map((p) => [p.id, p]))
  const result: UnclaimedRider[] = []
  for (const [id, counts] of refs) {
    const person = byId.get(id)
    if (!person) continue
    if (!isInvitableNodeStatus(person.node_status)) continue
    result.push({ person, refs: counts.claims + counts.stories, origins: counts })
  }
  // Most-referenced first — highest viral leverage at the top
  result.sort((a, b) => b.refs - a.refs)
  return result
}

export function BulkInvitePrompt(props: BulkInvitePromptProps) {
  const unclaimed = useMemo(() => collectUnclaimedRiders(props), [props])

  const [dismissedCount, setDismissedCount] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [invitee, setInvitee] = useState<Person | null>(null)

  // Read dismissal threshold once on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(DISMISS_KEY)
    setDismissedCount(raw ? Number(raw) || 0 : 0)
  }, [])

  // Fire prompt_shown once when the banner becomes visible
  const shouldShow = dismissedCount !== null && unclaimed.length > dismissedCount
  useEffect(() => {
    if (shouldShow) {
      trackInviteEvent("invite_prompt_shown", {
        surface: "profile_bulk_banner" satisfies InviteSurface,
        count: unclaimed.length,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow])

  if (!shouldShow) return null

  function handleDismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(unclaimed.length))
    }
    setDismissedCount(unclaimed.length)
    trackInviteEvent("invite_prompt_dismissed", {
      surface: "profile_bulk_banner" satisfies InviteSurface,
      count: unclaimed.length,
    })
  }

  function handleExpand() {
    setExpanded(true)
    trackInviteEvent("invite_prompt_clicked", {
      surface: "profile_bulk_banner" satisfies InviteSurface,
      count: unclaimed.length,
    })
  }

  const count = unclaimed.length

  return (
    <>
      {/* Compact banner */}
      <div
        className="mb-4 rounded-xl p-4 flex items-start gap-3"
        style={{ background: "#3b82f608", border: "1px dashed #3b82f640" }}
      >
        <span className="text-base shrink-0" style={{ color: "#3b82f6" }}>👤</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-0.5">
            {count === 1
              ? "1 rider in your timeline hasn't joined Lineage yet"
              : `${count} riders in your timeline haven't joined Lineage yet`}
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Invite them so they can claim their profiles and verify the connections.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleExpand}
              className="text-xs font-semibold transition-colors hover:opacity-80"
              style={{ color: "#3b82f6" }}
            >
              See who →
            </button>
            <button
              onClick={handleDismiss}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>

      {/* Expanded list modal */}
      {expanded && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setExpanded(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md bg-surface border border-border-default rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-default">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-foreground">Invite riders</h2>
                  <p className="text-xs text-muted mt-0.5">
                    {count === 1 ? "1 rider" : `${count} riders`} you&apos;ve tagged haven&apos;t joined yet
                  </p>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {unclaimed.map(({ person, refs, origins }) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors"
                  >
                    <RiderAvatar person={person} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {person.display_name}
                      </div>
                      <div className="text-[11px] text-muted">
                        {refToLabel(refs, origins)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setInvitee(person)
                        trackInviteEvent("invite_prompt_clicked", {
                          surface: "profile_bulk_list" satisfies InviteSurface,
                          person_id: person.id,
                        })
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0"
                      style={{ borderColor: "#3b82f640", color: "#3b82f6", background: "#3b82f610", borderWidth: 1 }}
                    >
                      Invite
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-border-default flex items-center justify-between">
                <button
                  onClick={() => { handleDismiss(); setExpanded(false) }}
                  className="text-xs text-muted hover:text-foreground transition-colors"
                >
                  Dismiss for now
                </button>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-xs font-medium text-foreground hover:opacity-80 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {invitee && (
        <InviteRiderModal
          personId={invitee.id}
          personName={invitee.display_name}
          predicate="rode_with"
          surface="profile_bulk_list"
          onClose={() => setInvitee(null)}
        />
      )}
    </>
  )
}

function refToLabel(refs: number, origins: { claims: number; stories: number }): string {
  if (origins.claims > 0 && origins.stories > 0) {
    return `In ${refs} of your entries`
  }
  if (origins.stories > 0) {
    return origins.stories === 1 ? "Tagged in 1 story" : `Tagged in ${origins.stories} stories`
  }
  return origins.claims === 1 ? "1 shared claim" : `${origins.claims} shared claims`
}
