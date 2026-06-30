"use client"

// FNRad authoring: editor-only "Add episode" form on a show hub. Creates an
// episode event (event_type='episode') linked to the show, via the editor route,
// then hands the new id back so the caller can route to it for curation.

import { useState } from "react"
import { useLineageStore } from "@/store/lineage-store"

export function EpisodeCreateModal({
  showOrgId, communitySlug, onClose, onCreated,
}: {
  showOrgId: string
  communitySlug: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { addToast } = useLineageStore()
  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [episodeNumber, setEpisodeNumber] = useState("")
  const [mediaUrl, setMediaUrl] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/show-episode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "episode",
          show_org_id: showOrgId,
          name: name.trim(),
          start_date: date.trim() || undefined,
          episode_number: episodeNumber.trim() || undefined,
          media_url: mediaUrl.trim() || undefined,
          description: description.trim() || undefined,
          community_slug: communitySlug,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { addToast(d?.error ?? "Could not create the episode.", "error"); return }
      addToast("Episode created.")
      onCreated(d.id as string)
    } catch {
      addToast("Could not create the episode.", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-background border border-border-default rounded-2xl w-full max-w-md my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
          <h2 className="text-lg font-semibold text-foreground">Add episode</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">Title</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FNRad: Jay Balmer" autoFocus
              className="mt-1.5 w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500" />
            </div>
            <div className="w-28">
              <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">Episode #</label>
              <input value={episodeNumber} onChange={(e) => setEpisodeNumber(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1" inputMode="numeric"
                className="mt-1.5 w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">Media URL</label>
            <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="YouTube or podcast link"
              className="mt-1.5 w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500" />
            <p className="mt-1 text-[11px] text-muted">A YouTube link auto-embeds; anything else shows a “Listen” button.</p>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional"
              className="mt-1.5 w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border-default">
          <button onClick={onClose} className="text-sm text-muted hover:text-foreground transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors">
            {saving ? "Creating…" : "Create episode"}
          </button>
        </div>
      </div>
    </div>
  )
}
