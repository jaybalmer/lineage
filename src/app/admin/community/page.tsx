"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import type { Community } from "@/types"

// Community Landing Redesign, Phase 2 (Workstream A 4.3)
// Editor-only community-setup screen. Lives under the already-gated /admin/*
// layout (requireEditorPage), so no extra auth here. Images only this phase;
// name/tagline/emoji editing is a Phase 3 follow-up.

type ImageKind = "avatar" | "hero" | "banner" | "boards"

const FIELD: Record<ImageKind, "avatar_url" | "hero_image_url" | "landing_banner_url" | "boards_banner_url"> = {
  avatar: "avatar_url",
  hero: "hero_image_url",
  banner: "landing_banner_url",
  boards: "boards_banner_url",
}

const META: Record<ImageKind, { label: string; hint: string }> = {
  avatar: { label: "Profile image", hint: "Square works best. Shown in place of the color dot in the header." },
  hero: { label: "Background image", hint: "Wide photo. Renders full-width behind the community name." },
  banner: { label: "Homepage banner", hint: "Wide photo. Full-width band across the top of the main landing page (not the community page)." },
  boards: { label: "Boards page banner", hint: "Wide photo. Full-width band across the top of the /boards catalog page." },
}

function ImageUploadField({ community, kind }: { community: Community; kind: ImageKind }) {
  const setCommunityImages = useLineageStore((s) => s.setCommunityImages)
  const field = FIELD[kind]
  const { label, hint } = META[kind]
  const currentUrl = community[field]
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function persist(url: string | null) {
    const res = await fetch("/api/admin/communities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: community.id, [field]: url }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.ok) throw new Error(json.error ?? "Save failed")
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError("Max 5 MB"); return }
    if (!file.type.startsWith("image/")) { setError("Images only"); return }
    setUploading(true)
    setError(null)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const path = `communities/${community.slug}-${kind}-${Date.now()}.${ext}`
      const { data, error: upErr } = await supabase.storage
        .from("board-images")
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr || !data) throw new Error(upErr?.message ?? "Upload failed")
      const { data: { publicUrl } } = supabase.storage.from("board-images").getPublicUrl(data.path)
      await persist(publicUrl)
      setCommunityImages(community.id, { [field]: publicUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleClear() {
    setError(null)
    setUploading(true)
    try {
      await persist(null)
      setCommunityImages(community.id, { [field]: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-foreground mb-1.5">{label}</div>
      <div className="flex items-start gap-3">
        {/* Preview */}
        <div className="flex-shrink-0">
          {currentUrl ? (
            kind === "avatar" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUrl} alt={`${community.name} ${label}`} className="w-16 h-16 rounded-full object-cover border border-border-default" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUrl} alt={`${community.name} ${label}`} className="w-40 h-20 rounded-lg object-cover border border-border-default" />
            )
          ) : (
            <div
              className={
                kind === "avatar"
                  ? "w-16 h-16 rounded-full border border-dashed border-border-default bg-surface-2 flex items-center justify-center text-muted text-[10px]"
                  : "w-40 h-20 rounded-lg border border-dashed border-border-default bg-surface-2 flex items-center justify-center text-muted text-[10px]"
              }
            >
              none
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-1.5 pt-0.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleUpload}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 rounded-lg bg-[#1C1917] text-white text-xs font-medium hover:bg-[#292524] transition-colors disabled:opacity-50"
            >
              {uploading ? "Uploading…" : currentUrl ? "Replace" : "Upload"}
            </button>
            {currentUrl && !uploading && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 rounded-lg border border-border-default text-muted text-xs font-medium hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted max-w-[16rem]">{hint}</p>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function CommunityCard({ community }: { community: Community }) {
  return (
    <div className="bg-surface border border-border-default rounded-xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        {community.emoji && <span className="text-xl leading-none">{community.emoji}</span>}
        <h2 className="text-base font-bold text-foreground">{community.name}</h2>
        <span className="text-xs text-muted">/{community.slug}</span>
      </div>
      <div className="flex flex-col sm:flex-row flex-wrap gap-5">
        <ImageUploadField community={community} kind="avatar" />
        <ImageUploadField community={community} kind="hero" />
        <ImageUploadField community={community} kind="banner" />
        <ImageUploadField community={community} kind="boards" />
      </div>
    </div>
  )
}

export default function AdminCommunityPage() {
  const communities = useLineageStore((s) => s.communities)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-widest">Community Setup</span>
            <span className="text-xs px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-400 rounded-full">Editors only</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Community Images</h1>
              <p className="text-sm text-muted mt-1">
                Set the profile and background images shown on each community landing page. Images only for now.
              </p>
            </div>
            <Link
              href="/admin"
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border-default text-xs text-foreground hover:bg-surface-hover transition-colors"
            >
              ← Dataset Editor
            </Link>
          </div>
        </div>

        {/* Community list */}
        {communities.length === 0 ? (
          <div className="text-center text-muted py-16 text-sm">Loading communities…</div>
        ) : (
          <div className="space-y-4">
            {communities.map((c) => (
              <CommunityCard key={c.id} community={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
