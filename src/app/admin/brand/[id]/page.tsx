"use client"

import { use, useState, useRef } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import { SearchPicker } from "@/components/ui/search-picker"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import { resolveBrandColor, cn } from "@/lib/utils"
import { orgSlug } from "@/lib/mock-data"
import type { Org } from "@/types"

// /admin/brand/[id] - editor manage surface for the curated brand page (Brand
// Page Redesign Phase 2). Lives under the already-gated /admin/* layout
// (requireEditorPage), so no extra auth here. Saves through the generic
// /api/admin update path via updateCatalogEntity ("orgs" is whitelisted there);
// images upload to the board-images Supabase bucket like /admin/community.

type Milestone = { year: number; label: string }
type MediaItem = { kind?: string; title?: string; subtitle?: string; image_url?: string; link_url?: string }
type BrandLink = { label: string; url: string }

const inputCls =
  "w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500"
const labelCls = "block text-xs font-medium text-foreground mb-1.5"

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const copy = [...arr]
  const tmp = copy[i]
  copy[i] = copy[j]
  copy[j] = tmp
  return copy
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border-default rounded-xl p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function RowButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-2 py-1 rounded-md border border-border-default text-xs transition-colors " +
        (danger ? "text-red-400 hover:border-red-400/40" : "text-muted hover:text-foreground hover:border-foreground/30")
      }
    >
      {label}
    </button>
  )
}

function ImageField({ label, hint, value, onChange, pathKey, orgId }: {
  label: string
  hint: string
  value: string
  onChange: (url: string) => void
  pathKey: string
  orgId: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError("Max 5 MB"); return }
    if (!file.type.startsWith("image/")) { setError("Images only"); return }
    setUploading(true)
    setError(null)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const path = `orgs/${orgId}-${pathKey}-${Date.now()}.${ext}`
      const { data, error: upErr } = await supabase.storage
        .from("board-images")
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr || !data) throw new Error(upErr?.message ?? "Upload failed")
      const { data: { publicUrl } } = supabase.storage.from("board-images").getPublicUrl(data.path)
      onChange(publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div>
      <div className={labelCls}>{label}</div>
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="w-40 h-20 rounded-lg object-cover border border-border-default" />
          ) : (
            <div className="w-40 h-20 rounded-lg border border-dashed border-border-default bg-surface-2 flex items-center justify-center text-muted text-[10px]">none</div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 pt-0.5">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 rounded-lg bg-[#1C1917] text-white text-xs font-medium hover:bg-[#292524] transition-colors disabled:opacity-50"
            >
              {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
            </button>
            {value && !uploading && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="px-3 py-1.5 rounded-lg border border-border-default text-muted text-xs font-medium hover:text-foreground transition-colors"
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

function BrandEditor({ org }: { org: Org }) {
  const catalog = useLineageStore((s) => s.catalog)
  const updateCatalogEntity = useLineageStore((s) => s.updateCatalogEntity)

  const [curationTier, setCurationTier] = useState<"standard" | "curated" | "founding">(org.curation_tier ?? "standard")
  const [brandColor, setBrandColor] = useState(org.brand_color ?? "")
  const [logoUrl, setLogoUrl] = useState(org.logo_url ?? "")
  const [bannerUrl, setBannerUrl] = useState(org.banner_url ?? "")
  const [heritage, setHeritage] = useState(org.heritage_statement ?? "")
  const [partnerLabel, setPartnerLabel] = useState(org.partner_label ?? "")
  const [milestones, setMilestones] = useState<Milestone[]>(Array.isArray(org.brand_milestones) ? org.brand_milestones : [])
  const [featuredIds, setFeaturedIds] = useState<string[]>(org.featured_rider_ids ?? [])
  const [mediaRows, setMediaRows] = useState<MediaItem[]>(Array.isArray(org.brand_media) ? org.brand_media : [])
  const [linkRows, setLinkRows] = useState<BrandLink[]>(Array.isArray(org.brand_links) ? org.brand_links : [])
  const [saved, setSaved] = useState(false)

  const publicPeople = catalog.people.filter((p) => p.privacy_level !== "private")
  const isCurated = curationTier !== "standard"
  const communitySlug = org.community_slugs?.[0] ?? "snowboarding"

  function save() {
    const patch = {
      curation_tier: curationTier,
      brand_color: brandColor.trim() || null,
      logo_url: logoUrl.trim() || null,
      banner_url: bannerUrl.trim() || null,
      heritage_statement: heritage.trim() || null,
      partner_label: partnerLabel.trim() || null,
      brand_milestones: milestones
        .filter((m) => m.label.trim())
        .map((m) => ({ year: Number(m.year) || 0, label: m.label.trim() })),
      featured_rider_ids: featuredIds,
      brand_media: mediaRows
        .filter((m) => m.title?.trim() || m.image_url?.trim())
        .map((m) => ({
          kind: m.kind?.trim() || undefined,
          title: m.title?.trim() || undefined,
          subtitle: m.subtitle?.trim() || undefined,
          image_url: m.image_url?.trim() || undefined,
          link_url: m.link_url?.trim() || undefined,
        })),
      brand_links: linkRows
        .filter((l) => l.url.trim())
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    }
    updateCatalogEntity("orgs", org.id, patch)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-5">
      {/* Tier + identity */}
      <Section title="Page tier" hint="Standard shows the lifted header only. Curated and founding add the hero, heritage, timeline, team, media, and contribute sections. Founding also shows the partner ribbon.">
        <div className="flex flex-wrap gap-2">
          {(["standard", "curated", "founding"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCurationTier(t)}
              className={
                "px-3 py-2 rounded-lg border text-sm capitalize transition-colors " +
                (curationTier === t ? "border-blue-500 bg-blue-950/30 text-blue-300" : "border-border-default text-muted hover:text-foreground")
              }
            >
              {t}
            </button>
          ))}
        </div>
        {curationTier === "founding" && (
          <div className="mt-4">
            <label className={labelCls}>Partner ribbon label</label>
            <input className={inputCls} value={partnerLabel} onChange={(e) => setPartnerLabel(e.target.value)} placeholder="Founding Brand Partner" />
          </div>
        )}
      </Section>

      <Section title="Identity">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Brand color (hex)</label>
            <div className="flex items-center gap-2">
              <input className={inputCls + " max-w-[180px]"} value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#D72638" />
              <span className="w-8 h-8 rounded-lg border border-border-default shrink-0" style={{ background: resolveBrandColor(brandColor) }} />
              <span className="text-xs text-muted">Falls back to Linestry blue when empty.</span>
            </div>
          </div>
          <ImageField label="Logo" hint="Square or transparent PNG works best. Shown in the header / hero lockup." value={logoUrl} onChange={setLogoUrl} pathKey="logo" orgId={org.id} />
          {isCurated && (
            <ImageField label="Hero banner" hint="Wide photo behind the curated hero. When empty, a brand-color gradient is used." value={bannerUrl} onChange={setBannerUrl} pathKey="banner" orgId={org.id} />
          )}
        </div>
      </Section>

      {isCurated && (
        <>
          <Section title="Heritage statement" hint="Brand-authored editorial blurb. Its first line also becomes the hero tagline.">
            <textarea className={inputCls + " min-h-[120px] resize-y"} value={heritage} onChange={(e) => setHeritage(e.target.value)} placeholder="Westbeach didn't just make outerwear. It shaped a generation..." />
          </Section>

          <Section title="Brand timeline" hint="Milestones render as a horizontal spine, in this order.">
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-2">
                  <input
                    className={cn(inputCls, "w-20 shrink-0")}
                    type="number"
                    value={m.year || ""}
                    onChange={(e) => setMilestones((prev) => prev.map((x, k) => k === i ? { ...x, year: parseInt(e.target.value) || 0 } : x))}
                    placeholder="Year"
                  />
                  <input
                    className={cn(inputCls, "flex-1 min-w-0")}
                    value={m.label}
                    onChange={(e) => setMilestones((prev) => prev.map((x, k) => k === i ? { ...x, label: e.target.value } : x))}
                    placeholder="What happened"
                  />
                  <div className="flex gap-1 shrink-0">
                    <RowButton label="↑" onClick={() => setMilestones((prev) => move(prev, i, -1))} />
                    <RowButton label="↓" onClick={() => setMilestones((prev) => move(prev, i, 1))} />
                    <RowButton label="✕" danger onClick={() => setMilestones((prev) => prev.filter((_, k) => k !== i))} />
                  </div>
                </div>
              ))}
              <RowButton label="+ Add milestone" onClick={() => setMilestones((prev) => [...prev, { year: 0, label: "" }])} />
            </div>
          </Section>

          <Section title="Featured riders (the team)" hint="Pick the riders to feature, in selection order. Private profiles are skipped on the page.">
            <SearchPicker
              items={publicPeople}
              selected={featuredIds}
              onToggle={(id) => setFeaturedIds((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id])}
              getLabel={(p) => p.display_name}
              placeholder="Search riders…"
            />
            {featuredIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {featuredIds.map((rid) => {
                  const p = catalog.people.find((x) => x.id === rid)
                  if (!p) return null
                  return (
                    <div key={rid} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background border border-border-default text-xs">
                      <RiderAvatar person={p} size="xs" />
                      {p.display_name}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          <Section title="Media & artifacts" hint="Catalog scans, video parts, ads, photos. Paste an image URL and an optional link.">
            <div className="space-y-3">
              {mediaRows.map((m, i) => (
                <div key={i} className="border border-border-default rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Item {i + 1}</span>
                    <RowButton label="Remove" danger onClick={() => setMediaRows((prev) => prev.filter((_, k) => k !== i))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input className={inputCls} value={m.title ?? ""} onChange={(e) => setMediaRows((prev) => prev.map((x, k) => k === i ? { ...x, title: e.target.value } : x))} placeholder="Title (e.g. 1991 Catalog)" />
                    <input className={inputCls} value={m.subtitle ?? ""} onChange={(e) => setMediaRows((prev) => prev.map((x, k) => k === i ? { ...x, subtitle: e.target.value } : x))} placeholder="Subtitle (e.g. Outerwear line)" />
                    <input className={inputCls} value={m.kind ?? ""} onChange={(e) => setMediaRows((prev) => prev.map((x, k) => k === i ? { ...x, kind: e.target.value } : x))} placeholder="Kind (e.g. Catalog scan)" />
                    <input className={inputCls} value={m.image_url ?? ""} onChange={(e) => setMediaRows((prev) => prev.map((x, k) => k === i ? { ...x, image_url: e.target.value } : x))} placeholder="Image URL" />
                    <input className={inputCls + " sm:col-span-2"} value={m.link_url ?? ""} onChange={(e) => setMediaRows((prev) => prev.map((x, k) => k === i ? { ...x, link_url: e.target.value } : x))} placeholder="Link URL (optional)" />
                  </div>
                </div>
              ))}
              <RowButton label="+ Add media item" onClick={() => setMediaRows((prev) => [...prev, {}])} />
            </div>
          </Section>

          <Section title="Brand links" hint="Outbound links shown in the sidebar 'From {brand}' card.">
            <div className="space-y-2">
              {linkRows.map((l, i) => (
                <div key={i} className="flex items-start gap-2">
                  <input className={cn(inputCls, "shrink-0 w-28 sm:w-44")} value={l.label} onChange={(e) => setLinkRows((prev) => prev.map((x, k) => k === i ? { ...x, label: e.target.value } : x))} placeholder="Label" />
                  <input className={cn(inputCls, "flex-1 min-w-0")} value={l.url} onChange={(e) => setLinkRows((prev) => prev.map((x, k) => k === i ? { ...x, url: e.target.value } : x))} placeholder="https://…" />
                  <RowButton label="✕" danger onClick={() => setLinkRows((prev) => prev.filter((_, k) => k !== i))} />
                </div>
              ))}
              <RowButton label="+ Add link" onClick={() => setLinkRows((prev) => [...prev, { label: "", url: "" }])} />
            </div>
          </Section>
        </>
      )}

      {/* Save bar */}
      <div className="sticky bottom-4 z-10">
        <div className="flex items-center gap-3 bg-surface border border-border-default rounded-xl px-4 py-3 shadow-lg">
          <button
            type="button"
            onClick={save}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Save changes
          </button>
          {saved && <span className="text-sm text-emerald-500 font-medium">Saved ✓</span>}
          <span className="flex-1" />
          <Link
            href={`/${communitySlug}/brands/${org.id}`}
            target="_blank"
            className="text-xs text-accent-strong hover:opacity-80 transition-opacity"
          >
            View page ↗
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AdminBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const catalog = useLineageStore((s) => s.catalog)
  const catalogLoaded = useLineageStore((s) => s.catalogLoaded)
  // Resolve by id OR slug (the public brand page does the same), so both
  // /admin/brand/<uuid> and /admin/brand/westbeach work. orgSlug is
  // case-preserving, so compare lowercased.
  const idLower = id.toLowerCase()
  const org = catalog.orgs.find((o) => o.id === id || orgSlug(o).toLowerCase() === idLower)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-widest">Brand Page</span>
            <span className="text-xs px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-400 rounded-full">Editors only</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{org ? `Manage ${org.name}` : "Manage brand page"}</h1>
              <p className="text-sm text-muted mt-1">Curate this brand&apos;s page: tier, identity, heritage, timeline, team, media, and links.</p>
            </div>
            <Link href="/admin" className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border-default text-xs text-foreground hover:bg-surface-hover transition-colors">
              ← Dataset Editor
            </Link>
          </div>
        </div>

        {!catalogLoaded ? (
          <div className="text-center text-muted py-16 text-sm">Loading…</div>
        ) : !org ? (
          <div className="text-center text-muted py-16 text-sm">No brand found for this id.</div>
        ) : (
          <BrandEditor key={org.id} org={org} />
        )}
      </div>
    </div>
  )
}
