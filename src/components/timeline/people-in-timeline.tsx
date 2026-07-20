"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import { personHref } from "@/lib/entity-links"
import { isInvitableNodeStatus } from "@/lib/invite-tracking"
import type { Claim, Person, Story } from "@/types"

const MAX_VISIBLE = 6

/**
 * "People in your timeline" strip on the owner's My Timeline (OwnerTimelinePanel).
 * Surfaces the viewer's rode_with partners as an always-on, browsable list so the
 * people graph feels alive: each partner links to your shared connection and offers
 * a single "Add a story" action (opens AddStoryModal pre-tagged with that rider).
 * Unclaimed partners get an inline "Not on Linestry yet" + "Help connect" treatment
 * so connecting them becomes a visible job (delivers batch B item 7 inline). Reads
 * only the claims already in scope on the page; writes nothing.
 */
export function PeopleInTimeline({
  claims,
  people,
  onStoryAdded,
}: {
  claims: Claim[]
  people: Person[]
  onStoryAdded?: (story: Story) => void
}) {
  const [storyRiderId, setStoryRiderId] = useState<string | null>(null)

  // The viewer's rode_with partners, deduped by person and ordered most-recent
  // first by the rode_with claim date (falling back to created_at). Ids that do
  // not resolve to a catalog person are skipped.
  const partners = useMemo(() => {
    const byPerson = new Map<string, { person: Person; key: string }>()
    for (const c of claims) {
      if (c.predicate !== "rode_with") continue
      const person = people.find((p) => p.id === c.object_id)
      if (!person) continue
      const key = c.start_date ?? c.created_at ?? ""
      const existing = byPerson.get(person.id)
      if (!existing || key > existing.key) byPerson.set(person.id, { person, key })
    }
    return [...byPerson.values()]
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((e) => e.person)
  }, [claims, people])

  const visible = partners.slice(0, MAX_VISIBLE)
  const overflow = partners.length - visible.length

  return (
    <section className="mb-6">
      {/* Header + prompt: the nudge to browse the Riders list or write a story. */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            People in your timeline
          </h2>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            {partners.length > 0
              ? "The riders you have logged riding with. Browse the Riders list to add more, or write a story about a day you shared."
              : "You have not linked anyone to your timeline yet. Browse the Riders list to add the riders you rode with, or write a story and tag who was there."}
          </p>
        </div>
        <Link
          href="/people"
          className="shrink-0 px-3 py-2 rounded-lg bg-surface-hover border border-border-default text-xs font-medium text-foreground hover:bg-surface-active transition-colors"
        >
          Browse riders
        </Link>
      </div>

      {partners.length > 0 && (
        <div className="space-y-2">
          {visible.map((person) => {
            const invitable = isInvitableNodeStatus(person.node_status)
            return (
              <div
                key={person.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-surface rounded-xl border border-border-default"
              >
                <RiderAvatar person={person} size="md" ring />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={personHref(person, people)}
                      className="font-semibold text-sm text-foreground hover:underline truncate"
                    >
                      {person.display_name}
                    </Link>
                    {invitable && (
                      <span
                        className="text-[10px] rounded px-1.5 py-0.5 font-medium shrink-0"
                        style={{ color: "#3b82f6", background: "#3b82f618", border: "1px solid #3b82f633" }}
                      >
                        Not on Linestry yet
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <CommunityLink
                      href={`/connections/${person.id}`}
                      className="text-[11px] text-blue-500 hover:text-blue-400 transition-colors"
                    >
                      See our connection
                    </CommunityLink>
                    <button
                      onClick={() => setStoryRiderId(person.id)}
                      className="text-[11px] text-muted hover:text-foreground transition-colors"
                    >
                      Add a story
                    </button>
                    {invitable && (
                      <Link
                        href={personHref(person, people)}
                        className="text-[11px] font-medium transition-colors hover:opacity-80"
                        style={{ color: "#3b82f6" }}
                      >
                        Help connect
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {overflow > 0 && (
            <Link
              href="/people?mine=1"
              className="block text-center text-xs text-muted hover:text-foreground py-2"
            >
              See all {partners.length}
            </Link>
          )}
        </div>
      )}

      {storyRiderId && (
        <AddStoryModal
          defaults={{ riderIds: [storyRiderId] }}
          onClose={() => setStoryRiderId(null)}
          onSaved={(s) => {
            onStoryAdded?.(s)
            setStoryRiderId(null)
          }}
        />
      )}
    </section>
  )
}
