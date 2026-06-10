"use client"

import { useEffect, useState } from "react"
import { SearchPicker } from "@/components/ui/search-picker"
import { useLineageStore } from "@/store/lineage-store"
import type { Story } from "@/types"

// Add Connections popover, opened from the + Connect button in the story
// card's interaction row. Any signed-in member can weave a public story into
// the graph: "I was there", "that was at Seymour", "that was the Westbeach
// Classic". Each pick POSTs immediately: one tap, one connection, mirroring
// how reactions feel. Removal lives on the card chips, so this surface is
// add-only. See Operations/story-connections-brief.md (June 9, 2026).

export type StoryConnectionType = "rider" | "place" | "event"

interface AddConnectionsPopoverProps {
  story: Story
  onClose: () => void
  /** Parent owns displayStory; it applies the optimistic chip update. */
  onAdded: (type: StoryConnectionType, entityId: string) => void
}

export function AddConnectionsPopover({ story, onClose, onAdded }: AddConnectionsPopoverProps) {
  const { activePersonId, catalog, loadCatalog, addToast } = useLineageStore()
  const [posting, setPosting] = useState<string | null>(null)

  // Same staleness rationale as AddStoryModal: the catalog is fetched once at
  // app boot and never invalidated, so re-fetch when the pickers are about to
  // be used. Fire-and-forget; the pickers read from the store as it updates.
  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const viewerId = activePersonId
  const riderSet = new Set(story.rider_ids ?? [])
  const placeSet = new Set([
    ...(story.linked_place_id ? [story.linked_place_id] : []),
    ...(story.community_places ?? []).map((p) => p.place_id),
  ])
  const eventSet = new Set([
    ...(story.linked_event_id ? [story.linked_event_id] : []),
    ...(story.community_events ?? []).map((e) => e.event_id),
  ])
  const viewerOnStory = !!viewerId && riderSet.has(viewerId)

  async function connect(type: StoryConnectionType, entityId: string) {
    if (posting) return
    const connectedSet = type === "rider" ? riderSet : type === "place" ? placeSet : eventSet
    if (connectedSet.has(entityId)) {
      addToast("Already connected to this story.", "info")
      return
    }
    setPosting(entityId)
    try {
      const r = await fetch(`/api/stories/${story.id}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, entity_id: entityId }),
      })
      const j = await r.json().catch(() => ({})) as {
        ok?: boolean; already?: boolean; reason?: string; error?: string
      }
      if (!r.ok) {
        if (j.reason === "previously_declined") {
          addToast("This rider was tagged before and the tag was removed.", "info")
        } else {
          addToast(j.error ?? "Could not add the connection.", "error")
        }
        return
      }
      if (j.already) {
        addToast("Already connected to this story.", "info")
        return
      }
      onAdded(type, entityId)
      if (type === "rider" && entityId === viewerId) {
        addToast("Added. You're on this story now.")
        onClose()
      } else {
        addToast("Connected.")
      }
    } catch {
      addToast("Could not add the connection.", "error")
    } finally {
      setPosting(null)
    }
  }

  // Self-adds go through the dedicated button, so the rider picker hides the
  // viewer (same filter as AddStoryModal's rider picker).
  const riders = catalog.people.filter((p) => p.id !== viewerId)

  return (
    <>
      {/* Backdrop: click to close. Dims on mobile, invisible on desktop. */}
      <div className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent" onClick={onClose} />

      {/* Mobile: bottom sheet. Desktop: absolute panel opening DOWNWARD from
          the interaction row. Downward keeps the whole panel scroll-reachable;
          an upward panel taller than the space above the first card would
          clip past the document top. */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-border-default bg-surface p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:left-0 sm:mt-2 sm:w-96 sm:max-h-[70vh] sm:rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Add connections</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {viewerId && !viewerOnStory && (
          <button
            type="button"
            onClick={() => connect("rider", viewerId)}
            disabled={posting !== null}
            className="w-full mb-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {posting === viewerId ? "Adding…" : "I was there"}
          </button>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Riders</label>
            <SearchPicker
              items={riders}
              selected={[]}
              onToggle={(id) => connect("rider", id)}
              getLabel={(r) => r.display_name}
              placeholder="Search riders…"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Places</label>
            <SearchPicker
              items={catalog.places}
              selected={[]}
              onToggle={(id) => connect("place", id)}
              getLabel={(p) => p.name}
              placeholder="Search places…"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Events</label>
            <SearchPicker
              items={catalog.events}
              selected={[]}
              onToggle={(id) => connect("event", id)}
              getLabel={(e) => `${e.name} ${e.year ?? ""}`}
              placeholder="Search events…"
            />
          </div>
        </div>

        <p className="mt-4 text-[11px] text-muted leading-relaxed">
          Connections you add are visible to everyone and attributed to you. Riders you tag can remove the tag.
        </p>
      </div>
    </>
  )
}
