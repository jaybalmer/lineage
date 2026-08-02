"use client"

// Podcast pass Session B: the editor surface for mapping podcast mentions.
//
// Editor-only, opened from the episode page. One subject per save, with a
// "Save + add another" path because a story has a cast: the modal stays open,
// clears the subject, and KEEPS the moment (title, timestamp, excerpt) so the
// next person in the same story is one pick away rather than a full retype.
//
// Pass `editMention` to switch to edit mode (PATCH instead of POST).

import { useState } from "react"
import { SearchPicker } from "@/components/ui/search-picker"
import { useLineageStore } from "@/store/lineage-store"
import { parseTimestampInput, formatTimestamp } from "@/lib/mentions"
import { cn } from "@/lib/utils"
import type { Mention, MentionSubjectType } from "@/types"

const inputCls =
  "w-full bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"

const SUBJECT_TABS: { type: MentionSubjectType; label: string }[] = [
  { type: "person", label: "Riders" },
  { type: "place", label: "Places" },
  { type: "org", label: "Brands" },
  { type: "board", label: "Boards" },
  { type: "event", label: "Events" },
]

export function MentionEditorModal({
  episodeId,
  editMention,
  onClose,
  onSaved,
}: {
  episodeId: string
  editMention?: Mention
  onClose: () => void
  onSaved: () => void
}) {
  const { catalog, addToast } = useLineageStore()
  const isEdit = Boolean(editMention)

  const [subjectType, setSubjectType] = useState<MentionSubjectType>(
    editMention?.subject_type ?? "person"
  )
  const [subjectId, setSubjectId] = useState<string | null>(editMention?.subject_id ?? null)
  const [stamp, setStamp] = useState(
    editMention?.timestamp_seconds != null ? formatTimestamp(editMention.timestamp_seconds) : ""
  )
  const [excerpt, setExcerpt] = useState(editMention?.excerpt ?? "")
  const [storyTitle, setStoryTitle] = useState(editMention?.story_title ?? "")
  const [status, setStatus] = useState<"draft" | "published">(editMention?.status ?? "published")
  const [saving, setSaving] = useState(false)

  // Subject candidates for the active tab, normalized to { id, label } so one
  // SearchPicker serves all five types.
  const items: { id: string; label: string }[] =
    subjectType === "person"
      ? catalog.people.map((p) => ({ id: p.id, label: p.display_name }))
      : subjectType === "place"
        ? catalog.places.map((p) => ({ id: p.id, label: p.name }))
        : subjectType === "org"
          ? catalog.orgs.map((o) => ({ id: o.id, label: o.name }))
          : subjectType === "board"
            ? catalog.boards.map((b) => ({ id: b.id, label: `${b.brand} ${b.model}`.trim() }))
            : catalog.events.map((e) => ({ id: e.id, label: e.name }))

  async function save(addAnother: boolean) {
    if (!subjectId) {
      addToast("Pick who or what was mentioned")
      return
    }
    const parsed = parseTimestampInput(stamp)
    if (parsed === undefined) {
      addToast("Timestamp should look like 12:34, 1:02:03, or a number of seconds")
      return
    }

    setSaving(true)
    const payload = {
      episode_event_id: episodeId,
      subject_type: subjectType,
      subject_id: subjectId,
      timestamp_seconds: parsed,
      excerpt,
      story_title: storyTitle,
      status,
    }
    const res = await fetch(
      isEdit ? `/api/admin/mentions/${editMention!.id}` : "/api/admin/mentions",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ).catch(() => null)
    setSaving(false)

    if (!res || !res.ok) {
      if (res?.status === 409) {
        addToast("Already mapped: that subject is on this episode at that timestamp")
        return
      }
      const d = await res?.json().catch(() => null)
      addToast(d?.error ?? "Could not save the mention")
      return
    }

    onSaved()
    if (isEdit || !addAnother) {
      onClose()
      return
    }
    // Save + add another: clear ONLY the subject, and keep the moment.
    //
    // Adding a story means entering its whole cast against one timestamp,
    // title and excerpt, so clearing those made an editor retype the same
    // paragraph once per person. Keeping them turns "add another" into "add the
    // next person in this story", which is the actual job. Clear the timestamp
    // and excerpt by hand to start a new moment.
    setSubjectId(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border-default rounded-2xl w-full max-w-lg my-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit mention" : "Add mentions"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Subject type */}
          <div>
            <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">
              Mentioned
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {SUBJECT_TABS.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => { setSubjectType(t.type); setSubjectId(null) }}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    subjectType === t.type
                      ? "bg-[#1C1917] border-[#1C1917] text-white"
                      : "border-border-default text-muted hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject picker */}
          <SearchPicker
            items={items}
            selected={subjectId ? [subjectId] : []}
            onToggle={(id) => setSubjectId((cur) => (cur === id ? null : id))}
            getLabel={(i) => i.label}
            placeholder="Search the catalog…"
            single
          />

          {/* Timestamp */}
          <div>
            <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">
              Timestamp (optional)
            </label>
            <input
              type="text"
              value={stamp}
              onChange={(e) => setStamp(e.target.value)}
              placeholder="12:34"
              className={cn(inputCls, "mt-1.5")}
            />
            <p className="text-[11px] text-muted mt-1">
              mm:ss, h:mm:ss, or raw seconds. Links the row straight to that moment.
            </p>
          </div>

          {/* Story title. Shared by every mention at the same moment, so the
              episode page can group a story's cast under one headline. */}
          <div>
            <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">
              Story title (optional)
            </label>
            <input
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              placeholder="e.g. The first snowboard in the family"
              className={cn(inputCls, "mt-1.5")}
            />
            <p className="text-[11px] text-muted mt-1">
              Heads the card on the episode page. Use the same title and timestamp for everyone in one story.
            </p>
          </div>

          {/* Excerpt */}
          <div>
            <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">
              What was said (optional)
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              placeholder="The line from the episode…"
              className={cn(inputCls, "mt-1.5 resize-y")}
            />
          </div>

          {/* Status */}
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={status === "draft"}
              onChange={(e) => setStatus(e.target.checked ? "draft" : "published")}
              className="accent-blue-600"
            />
            Keep as a draft (editors only)
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border-default">
          <button
            onClick={onClose}
            className="text-xs px-3 py-2 rounded-lg border border-border-default text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          {!isEdit && (
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="text-xs px-3 py-2 rounded-lg border border-border-default text-foreground hover:bg-surface-hover disabled:opacity-50 transition-colors"
            >
              Save + add another
            </button>
          )}
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="text-xs px-4 py-2 rounded-lg bg-[#1C1917] text-white font-medium hover:bg-[#292524] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
