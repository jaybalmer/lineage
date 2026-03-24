"use client"

import { useState, useRef, useCallback } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import { cn, parseYouTubeId } from "@/lib/utils"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import type { Story, PrivacyLevel } from "@/types"

type AddableEntity = "place" | "event" | "board" | "person"

const inputCls =
  "w-full bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"

// ── Search picker shared component ───────────────────────────────────────────

function SearchPicker<T extends { id: string }>({
  items,
  selected,
  onToggle,
  getLabel,
  placeholder,
  single = false,
  onAddNew,
  addNewLabel,
}: {
  items: T[]
  selected: string[]
  onToggle: (id: string) => void
  getLabel: (item: T) => string
  placeholder: string
  single?: boolean
  onAddNew?: () => void
  addNewLabel?: string
}) {
  const [query, setQuery] = useState("")
  const filtered = items
    .filter((i) => getLabel(i).toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)
  const noResults = filtered.length === 0

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className={cn(inputCls, "mb-1.5")}
      />
      <div className="max-h-36 overflow-y-auto rounded-lg border border-border-default divide-y divide-border-default">
        {filtered.map((item) => {
          const isSelected = selected.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs transition-colors",
                isSelected
                  ? "bg-blue-500/10 text-blue-400"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              )}
            >
              {isSelected ? "✓ " : ""}{getLabel(item)}
            </button>
          )
        })}
        {noResults && (
          <div className="px-3 py-2 text-xs text-muted italic">
            {query ? "No matches" : "None yet"}
          </div>
        )}
        {onAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            className={cn(
              "w-full text-left px-3 py-2 text-xs transition-colors font-medium",
              noResults && query
                ? "text-blue-400 hover:bg-blue-500/10"
                : "text-muted hover:text-blue-400 hover:bg-surface-hover"
            )}
          >
            + {addNewLabel ?? "Add new…"}
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map((id) => {
            const item = items.find((i) => i.id === id)
            if (!item) return null
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400"
              >
                {getLabel(item)}
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  className="hover:text-red-400 transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface AddStoryModalProps {
  onClose: () => void
  onSaved: (story: Story) => void
  defaults?: {
    linkedPlaceId?: string
    linkedEventId?: string
    boardId?: string
  }
  editStory?: Story   // if provided, modal is in edit mode
}

type UploadState = { file: File; preview: string; uploading: boolean; url?: string }

export function AddStoryModal({ onClose, onSaved, defaults, editStory }: AddStoryModalProps) {
  const { activePersonId, profileOverride, catalog } = useLineageStore()
  const isEditing = !!editStory

  const [title, setTitle]       = useState(editStory?.title ?? "")
  const [body, setBody]         = useState(editStory?.body ?? "")
  const [date, setDate]         = useState(editStory?.story_date ?? "")
  const [visibility, setVisibility] = useState<PrivacyLevel>(editStory?.visibility ?? "public")
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"details" | "links">("details")
  const [addingEntity, setAddingEntity] = useState<AddableEntity | null>(null)

  // Existing photos (edit mode) — track which ones to keep by ID
  const [existingPhotos]        = useState(editStory?.photos ?? [])
  const [keepPhotoIds, setKeepPhotoIds] = useState<Set<string>>(
    () => new Set((editStory?.photos ?? []).map((p) => p.id))
  )

  // YouTube
  const [youtubeUrl, setYoutubeUrl] = useState(editStory?.youtube_url ?? "")

  // New photo uploads
  const [uploads, setUploads]   = useState<UploadState[]>([])
  const fileInputRef            = useRef<HTMLInputElement>(null)

  // Link selections
  const [selectedPlaceId, setSelectedPlaceId]   = useState<string | null>(
    editStory?.linked_place_id ?? defaults?.linkedPlaceId ?? null
  )
  const [selectedEventId, setSelectedEventId]   = useState<string | null>(
    editStory?.linked_event_id ?? defaults?.linkedEventId ?? null
  )
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>(
    editStory?.board_ids ?? (defaults?.boardId ? [defaults.boardId] : [])
  )
  const [selectedRiderIds, setSelectedRiderIds] = useState<string[]>(
    editStory?.rider_ids ?? []
  )

  const allPlaces  = catalog.places
  const allEvents  = catalog.events
  const allBoards  = catalog.boards
  const allRiders  = catalog.people.filter((p) => p.id !== activePersonId)

  // ── Photo handling ─────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return
    const newUploads: UploadState[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 6 - uploads.length - [...keepPhotoIds].length)
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        uploading: true,
      }))

    setUploads((prev) => [...prev, ...newUploads])

    // Upload each to Supabase Storage immediately
    for (const up of newUploads) {
      const ext = up.file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const path = `${activePersonId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error: uploadError } = await supabase.storage
        .from("story-images")
        .upload(path, up.file, { contentType: up.file.type })

      const url = uploadError
        ? undefined
        : supabase.storage.from("story-images").getPublicUrl(data!.path).data.publicUrl

      setUploads((prev) =>
        prev.map((u) =>
          u.preview === up.preview ? { ...u, uploading: false, url } : u
        )
      )
    }
  }, [uploads.length, activePersonId])

  function removeUpload(preview: string) {
    setUploads((prev) => prev.filter((u) => u.preview !== preview))
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!date) { setError("Please pick a date for this story."); return }
    const keptCount = existingPhotos.filter((p) => keepPhotoIds.has(p.id)).length
    if (!body.trim() && uploads.length === 0 && keptCount === 0) {
      setError("Add some text or at least one photo."); return
    }
    setSaving(true)
    setError(null)

    const newPhotos = uploads.filter((u) => u.url).map((u) => ({ url: u.url! }))
    const commonFields = {
      title:           title.trim() || undefined,
      body:            body.trim(),
      story_date:      date,
      visibility,
      linked_place_id: selectedPlaceId || undefined,
      linked_event_id: selectedEventId || undefined,
      board_ids:       selectedBoardIds,
      rider_ids:       selectedRiderIds,
      youtube_url:     youtubeUrl.trim() || null,
    }

    if (isEditing && editStory) {
      // ── PATCH ────────────────────────────────────────────────────────────
      const res = await fetch("/api/stories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:             editStory.id,
          ...commonFields,
          keep_photo_ids: [...keepPhotoIds],
          new_photos:     newPhotos,
        }),
      })

      if (!res.ok) {
        const { error: msg } = await res.json()
        setError(msg ?? "Save failed")
        setSaving(false)
        return
      }

      const { photos: updatedPhotos } = await res.json()

      const updated: Story = {
        ...editStory,
        ...commonFields,
        updated_at: new Date().toISOString(),
        photos: updatedPhotos,
      }
      onSaved(updated)
    } else {
      // ── POST ─────────────────────────────────────────────────────────────
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_id: activePersonId,
          ...commonFields,
          photos: newPhotos.map((p, i) => ({ ...p, sort_order: i })),
        }),
      })

      if (!res.ok) {
        const { error: msg } = await res.json()
        setError(msg ?? "Save failed")
        setSaving(false)
        return
      }

      const { id } = await res.json()

      const story: Story = {
        id,
        author_id:   activePersonId!,
        ...commonFields,
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
        photos:      newPhotos.map((p, i) => ({
          id: `local-${i}`, story_id: id, url: p.url,
          sort_order: i, created_at: new Date().toISOString(),
        })),
        author: {
          display_name: profileOverride.display_name ?? "Rider",
          avatar_url:   profileOverride.avatar_url,
        },
      }
      onSaved(story)
    }
    onClose()
  }

  // Called by AddEntityModal after a new entity is created — auto-selects it
  function handleEntityAdded(type: AddableEntity, id: string) {
    if (type === "place")  setSelectedPlaceId(id)
    if (type === "event")  setSelectedEventId(id)
    if (type === "board")  setSelectedBoardIds((prev) => [...prev, id])
    if (type === "person") setSelectedRiderIds((prev) => [...prev, id])
    setAddingEntity(null)
  }

  return (
    <>
    {addingEntity && (
      <AddEntityModal
        entityType={addingEntity}
        onClose={() => setAddingEntity(null)}
        onAdded={(id) => handleEntityAdded(addingEntity, id)}
      />
    )}
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border-default rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border-default">
          <h2 className="text-base font-bold text-foreground">{isEditing ? "Edit Story" : "Add a Story"}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors text-xl leading-none">×</button>
        </div>

        {/* Tab nav */}
        <div className="flex gap-0 border-b border-border-default px-5">
          {(["details", "links"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-2.5 text-xs font-medium capitalize border-b-2 transition-colors -mb-px",
                activeTab === tab
                  ? "border-blue-500 text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-4">

          {activeTab === "details" && (
            <>
              {/* Date */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your story a headline…"
                  maxLength={120}
                  className={inputCls}
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Story</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Tell the story…"
                  rows={5}
                  className={cn(inputCls, "resize-none leading-relaxed")}
                />
              </div>

              {/* Photos */}
              <div>
                {(() => {
                  const keptExisting = existingPhotos.filter((p) => keepPhotoIds.has(p.id))
                  const totalCount = keptExisting.length + uploads.length
                  return (
                    <>
                      <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">
                        Photos ({totalCount}/6)
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Existing photos (edit mode) */}
                        {keptExisting.map((photo) => (
                          <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-surface-hover">
                            <img src={photo.url} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setKeepPhotoIds((prev) => { const s = new Set(prev); s.delete(photo.id); return s })}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {/* New uploads */}
                        {uploads.map((up) => (
                          <div key={up.preview} className="relative aspect-square rounded-lg overflow-hidden bg-surface-hover">
                            <img src={up.preview} alt="" className="w-full h-full object-cover" />
                            {up.uploading && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <span className="text-white text-xs">Uploading…</span>
                              </div>
                            )}
                            {!up.uploading && !up.url && (
                              <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center">
                                <span className="text-white text-xs">Failed</span>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeUpload(up.preview)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {totalCount < 6 && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-lg border-2 border-dashed border-border-default flex flex-col items-center justify-center gap-1 text-muted hover:text-foreground hover:border-blue-500 transition-colors"
                          >
                            <span className="text-xl">+</span>
                            <span className="text-[10px]">Add photo</span>
                          </button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                      />
                    </>
                  )
                })()}
              </div>

              {/* YouTube video */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">YouTube video (optional)</label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Paste a YouTube link…"
                  className={inputCls}
                />
                {youtubeUrl.trim() && (
                  <p className={cn(
                    "mt-1 text-[10px]",
                    parseYouTubeId(youtubeUrl) ? "text-emerald-400" : "text-amber-400"
                  )}>
                    {parseYouTubeId(youtubeUrl) ? "✓ Valid YouTube link" : "⚠ Doesn't look like a YouTube URL"}
                  </p>
                )}
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Visibility</label>
                <div className="flex gap-2">
                  {(["public", "private"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVisibility(v)}
                      className={cn(
                        "flex-1 py-2 rounded-lg border text-xs font-medium capitalize transition-colors",
                        visibility === v
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : "border-border-default text-muted hover:text-foreground"
                      )}
                    >
                      {v === "public" ? "🌍 Public" : "🔒 Only me"}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "links" && (
            <>
              <p className="text-xs text-muted">Link your story to places, events, boards, and riders so it shows up on those pages.</p>

              {/* Place */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Place</label>
                <SearchPicker
                  items={allPlaces}
                  selected={selectedPlaceId ? [selectedPlaceId] : []}
                  onToggle={(id) => setSelectedPlaceId((prev) => prev === id ? null : id)}
                  getLabel={(p) => p.name}
                  placeholder="Search places…"
                  single
                  onAddNew={() => setAddingEntity("place")}
                  addNewLabel="Add a new place"
                />
              </div>

              {/* Event */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Event</label>
                <SearchPicker
                  items={allEvents}
                  selected={selectedEventId ? [selectedEventId] : []}
                  onToggle={(id) => setSelectedEventId((prev) => prev === id ? null : id)}
                  getLabel={(e) => `${e.name} ${e.year ?? ""}`}
                  placeholder="Search events…"
                  single
                  onAddNew={() => setAddingEntity("event")}
                  addNewLabel="Add a new event"
                />
              </div>

              {/* Boards */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Boards</label>
                <SearchPicker
                  items={allBoards}
                  selected={selectedBoardIds}
                  onToggle={(id) => setSelectedBoardIds((prev) =>
                    prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
                  )}
                  getLabel={(b) => `${b.brand} ${b.model} '${String(b.model_year).slice(2)}`}
                  placeholder="Search boards…"
                  onAddNew={() => setAddingEntity("board")}
                  addNewLabel="Add a new board"
                />
              </div>

              {/* Riders */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Tag riders</label>
                <SearchPicker
                  items={allRiders}
                  selected={selectedRiderIds}
                  onToggle={(id) => setSelectedRiderIds((prev) =>
                    prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
                  )}
                  getLabel={(r) => r.display_name}
                  placeholder="Search riders…"
                  onAddNew={() => setAddingEntity("person")}
                  addNewLabel="Add a rider"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center gap-3 justify-end border-t border-border-default pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border-default text-sm text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploads.some((u) => u.uploading)}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Save Story"}
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
