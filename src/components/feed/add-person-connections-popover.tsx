"use client"

import { useEffect, useState } from "react"
import { SearchPicker } from "@/components/ui/search-picker"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import { useLineageStore } from "@/store/lineage-store"
import type { Claim, EntityType, Person, Predicate } from "@/types"

// Add Connections popover, opened from a person's profile (the non-owner public
// view). Any signed-in member can weave the person into the graph directly on
// their page: "they rode here", "they rode for Westbeach", "they competed at the
// Classic", "they rode with X" — plus a fast "I rode with them". Each pick
// writes one public claim through store.addClaim(), inheriting the optimistic
// insert, the can-tag precheck, the rollback toast, and the reward toast for
// free. Adds flow through the PB-009 pending pipeline, so the tagged person
// keeps control (they can decline from /me/tags). Removal lives there, so this
// surface is add-only, mirroring the story connections popover.
// See Operations/person-profile-connections-brief.md (June 23, 2026).

// Section kind → the one sensible relationship for that type (brief D4). No
// per-add relationship dropdown in v1; precise claims stay in AddClaimModal.
type SectionKind = "place" | "org" | "event" | "rider"
// The inline-create kinds AddEntityModal accepts that we surface here.
type CreateKind = "person" | "place" | "event" | "org"

interface AddPersonConnectionsPopoverProps {
  person: Person
  onClose: () => void
}

const SECTION_MAP: Record<SectionKind, { predicate: Predicate; objectType: EntityType }> = {
  place: { predicate: "rode_at", objectType: "place" },
  org:   { predicate: "sponsored_by", objectType: "org" },
  event: { predicate: "competed_at", objectType: "event" },
  rider: { predicate: "rode_with", objectType: "person" },
}

export function AddPersonConnectionsPopover({ person, onClose }: AddPersonConnectionsPopoverProps) {
  const { activePersonId, catalog, loadCatalog, addClaim, addToast } = useLineageStore()
  // When a search returns no match, the member can create a brand-new entity
  // inline (mirrors the story popover + Add Story modal), then connect against it.
  const [addingEntity, setAddingEntity] = useState<CreateKind | null>(null)
  // Same-session dedupe so a double-tap on the same item doesn't write two
  // claims (the picker never marks items as selected, so they stay tappable).
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [rodeWithDone, setRodeWithDone] = useState(false)

  // Lock the background page while the popover is open (BUG-048).
  useBodyScrollLock()

  // Same staleness rationale as the story popover: catalog is fetched once at
  // boot and never invalidated, so re-fetch when the pickers are about to be
  // used. Fire-and-forget; the pickers read from the store as it updates.
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
  const firstName = person.display_name.split(" ")[0]

  // Section add: subject = the profile person, object = the picked entity. The
  // optimistic claim shows on this profile immediately (the page filters
  // sessionClaims by subject_id === this person), and store.addClaim() surfaces
  // success via its own reward toast, so no local success toast is needed here.
  function connectSection(kind: SectionKind, objectId: string) {
    if (!viewerId) return
    const key = `${kind}:${objectId}`
    if (connected.has(key)) {
      addToast("Already added.", "info")
      return
    }
    const { predicate, objectType } = SECTION_MAP[kind]
    const claim: Claim = {
      id: crypto.randomUUID(),
      subject_id: person.id,
      subject_type: "person",
      predicate,
      object_id: objectId,
      object_type: objectType,
      confidence: "self-reported",
      visibility: "public",
      asserted_by: viewerId,
      created_at: new Date().toISOString(),
    }
    addClaim(claim)
    setConnected((s) => new Set(s).add(key))
  }

  // Fast path: subject = the VIEWER, object = the profile person. Lands on the
  // viewer's own timeline (NOT optimistically on this profile, since its subject
  // is the viewer), so it gets a naming toast of its own; the profile person
  // gets a pending tag. Closes after, matching the story popover's "I was there".
  function rodeWithThem() {
    if (!viewerId || rodeWithDone) return
    const claim: Claim = {
      id: crypto.randomUUID(),
      subject_id: viewerId,
      subject_type: "person",
      predicate: "rode_with",
      object_id: person.id,
      object_type: "person",
      confidence: "self-reported",
      visibility: "public",
      asserted_by: viewerId,
      created_at: new Date().toISOString(),
    }
    setRodeWithDone(true)
    addClaim(claim)
    addToast(`Added. You rode with ${firstName} now.`, "info")
    onClose()
  }

  // A brand-new entity was just created and persisted via AddEntityModal (it only
  // calls onAdded once the DB write lands), so connecting it now is FK-safe.
  function handleEntityCreated(kind: CreateKind, entityId: string) {
    setAddingEntity(null)
    connectSection(kind === "person" ? "rider" : kind, entityId)
  }

  // Exclude the profile person (no self rode_with, G6) and the viewer (served by
  // the fast path) from the Riders picker.
  const riders = catalog.people.filter((p) => p.id !== person.id && p.id !== viewerId)

  return (
    <>
      {/* Create sub-modal: AddEntityModal is z-[60], so it stacks above this
          z-50 popover and closing it returns here rather than the profile. */}
      {addingEntity && (
        <AddEntityModal
          entityType={addingEntity}
          // Brands default to org_type "brand" so an inline-created sponsor lands
          // in the right bucket; the member can still change it in the modal.
          initialOrgType={addingEntity === "org" ? "brand" : undefined}
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
            <h3 className="text-sm font-bold text-foreground">Add to {firstName}&apos;s timeline</h3>
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
            {viewerId && (
              <button
                type="button"
                onClick={rodeWithThem}
                disabled={rodeWithDone}
                className="w-full mb-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {rodeWithDone ? "Added" : "I rode with them"}
              </button>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Places — rode here</label>
                <SearchPicker
                  items={catalog.places}
                  selected={[]}
                  onToggle={(id) => connectSection("place", id)}
                  getLabel={(p) => p.name}
                  placeholder="Search places…"
                  onAddNew={() => setAddingEntity("place")}
                  addNewLabel="Add a new place"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Brands — ridden for</label>
                <SearchPicker
                  items={catalog.orgs}
                  selected={[]}
                  onToggle={(id) => connectSection("org", id)}
                  getLabel={(o) => o.name}
                  placeholder="Search brands…"
                  onAddNew={() => setAddingEntity("org")}
                  addNewLabel="Add a new brand"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Events — competed at</label>
                <SearchPicker
                  items={catalog.events}
                  selected={[]}
                  onToggle={(id) => connectSection("event", id)}
                  getLabel={(e) => `${e.name} ${e.year ?? ""}`}
                  placeholder="Search events…"
                  onAddNew={() => setAddingEntity("event")}
                  addNewLabel="Add a new event"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Riders — rode with</label>
                <SearchPicker
                  items={riders}
                  selected={[]}
                  onToggle={(id) => connectSection("rider", id)}
                  getLabel={(r) => r.display_name}
                  placeholder="Search riders…"
                  onAddNew={() => setAddingEntity("person")}
                  addNewLabel="Add a rider"
                />
              </div>
            </div>

            <p className="mt-4 text-[11px] text-muted leading-relaxed">
              Connections you add are visible to everyone and attributed to you. {firstName} can remove any tag.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
