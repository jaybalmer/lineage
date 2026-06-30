"use client"

// FNRad authoring: editor-only "New show" form. Creates a media org via the
// editor route, then hands the new id back so the caller can route to its hub.

import { useState } from "react"
import { useLineageStore } from "@/store/lineage-store"

export function CreateShowModal({
  communitySlug, onClose, onCreated,
}: {
  communitySlug: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { addToast } = useLineageStore()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/show-episode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "show", name: name.trim(),
          description: description.trim() || undefined,
          logo_url: logoUrl.trim() || undefined,
          community_slug: communitySlug,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { addToast(d?.error ?? "Could not create the show.", "error"); return }
      addToast("Show created.")
      onCreated(d.id as string)
    } catch {
      addToast("Could not create the show.", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-background border border-border-default rounded-2xl w-full max-w-md my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
          <h2 className="text-lg font-semibold text-foreground">New show</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FNRad" autoFocus
              className="mt-1.5 w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What the show is about"
              className="mt-1.5 w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">Logo URL (optional)</label>
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…"
              className="mt-1.5 w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border-default">
          <button onClick={onClose} className="text-sm text-muted hover:text-foreground transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors">
            {saving ? "Creating…" : "Create show"}
          </button>
        </div>
      </div>
    </div>
  )
}
