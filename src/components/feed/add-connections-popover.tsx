"use client"

import { useEffect, useState } from "react"
import { SearchPicker } from "@/components/ui/search-picker"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
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
  const { activePersonId, catalog, loadCatalog, addToast, awardFeedback } = useLineageStore()
  const [posting, setPosting] = useState<string | null>(null)
  // When a search returns no match, the member can create a brand-new entity
  // inline (BUG-059), mirroring the Add Story modal. The AddEntityModal key
  // uses "person" for riders, matching its entityType prop.
  const [addingEntity, setAddingEntity] = useState<"person" | "place" | "event" | null>(null)

  // Lock the background page while the picker is open (BUG-048).
  useBodyScrollLock()

  // Same staleness rationale as AddStoryModal: the catalog is fetched once at
  // app boot and never invalidated, so re-fetch when the pickers are about to
  // be used. Fire-and-forget; the pickers read from the store as it updates.
  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // While the create sub-modal is open it owns Escape; closing the whole
      // popover out from under it would drop the half-typed entity.
      if (e.key === "Escape" && !addingEntity) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, addingEntity])

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
        ok?: boolean; already?: boolean; reason?: string; error?: string; tokens_awarded?: number
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
      // Reward moment (token-game-feel brief D1): augment the existing success
      // toast with the grant rather than stacking a second toast, then refresh
      // the daily chip with { toast: false } so it does not fire its own.
      const earned = typeof j.tokens_awarded === "number" && j.tokens_awarded > 0
        ? ` +${j.tokens_awarded} token${j.tokens_awarded === 1 ? "" : "s"} earned.`
        : ""
      if (type === "rider" && entityId === viewerId) {
        addToast(`Added. You're on this story now.${earned}`, "info")
        onClose()
      } else {
        addToast(`Connected.${earned}`, "info")
      }
      awardFeedback(j.tokens_awarded, { toast: false })
    } catch {
      addToast("Could not add the connection.", "error")
    } finally {
      setPosting(null)
    }
  }

  // A brand-new entity was just created and persisted via AddEntityModal (it
  // only calls onAdded once the DB write lands), so connecting it now is safe:
  // connect()'s server-side FK checks resolve against a row that exists. Map
  // the modal's "person" key onto the connection's "rider" type.
  async function handleEntityCreated(kind: "person" | "place" | "event", entityId: string) {
    setAddingEntity(null)
    await connect(kind === "person" ? "rider" : kind, entityId)
  }

  // Self-adds go through the dedicated button, so the rider picker hides the
  // viewer (same filter as AddStoryModal's rider picker).
  const riders = catalog.people.filter((p) => p.id !== viewerId)

  // Centered modal overlay (BUG-047). Anchored-to-the-card popovers opened far
  // below the fold on a long story card, off-screen behind the comments; a
  // centered portal-style overlay is always in view on desktop and mobile.
  return (
    <>
    {/* Create sub-modal: AddEntityModal is z-[60], so it stacks above this
        z-50 popover and closing it returns here rather than the story card. */}
    {addingEntity && (
      <AddEntityModal
        entityType={addingEntity}
        onClose={() => setAddingEntity(null)}
        onAdded={(id) => handleEntityCreated(addingEntity, id)}
      />
    )}
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop: click to close. */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel: bottom sheet on mobile, centered card on desktop. The header is
          fixed and the body scrolls so a long catalog list stays reachable. */}
      <div className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-2xl border border-border-default bg-surface shadow-2xl sm:max-h-[80vh] sm:w-96 sm:rounded-2xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
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

        <div className="flex-1 overflow-y-auto px-4 pb-4">
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
                onAddNew={() => setAddingEntity("person")}
                addNewLabel="Add a rider"
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
                onAddNew={() => setAddingEntity("place")}
                addNewLabel="Add a new place"
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
                onAddNew={() => setAddingEntity("event")}
                addNewLabel="Add a new event"
              />
            </div>
          </div>

          <p className="mt-4 text-[11px] text-muted leading-relaxed">
            Connections you add are visible to everyone and attributed to you. Riders you tag can remove the tag.
          </p>
        </div>
      </div>
    </div>
    </>
  )
}
