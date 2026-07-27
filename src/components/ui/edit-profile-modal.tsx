"use client"

import { useState, useRef } from "react"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { PLACES } from "@/lib/mock-data"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import type { Person, PrivacyLevel, ProfileLink } from "@/types"

interface EditProfileModalProps {
  person: Person
  onClose: () => void
}

const currentYear = new Date().getFullYear()

// Detect platform from URL for icon + label suggestion
function detectPlatform(url: string): { icon: string; label: string } {
  const u = url.toLowerCase()
  if (u.includes("instagram.com"))  return { icon: "📸", label: "Instagram" }
  if (u.includes("youtube.com") || u.includes("youtu.be")) return { icon: "▶️", label: "YouTube" }
  if (u.includes("tiktok.com"))     return { icon: "🎵", label: "TikTok" }
  if (u.includes("twitter.com") || u.includes("x.com")) return { icon: "✖", label: "X / Twitter" }
  if (u.includes("facebook.com"))   return { icon: "📘", label: "Facebook" }
  if (u.includes("linkedin.com"))   return { icon: "💼", label: "LinkedIn" }
  if (u.includes("strava.com"))     return { icon: "🏃", label: "Strava" }
  if (u.includes("vimeo.com"))      return { icon: "🎬", label: "Vimeo" }
  return { icon: "🔗", label: "Link" }
}

export function getLinkIcon(url: string): string {
  return detectPlatform(url).icon
}

export function EditProfileModal({ person, onClose }: EditProfileModalProps) {
  const { setProfileOverride, onboarding, activePersonId, membership } = useLineageStore()

  // Curated Member Profile: the Member page section is a paid-tier benefit.
  const isMember = membership.tier !== "free"

  // Lock the background page while the modal is open (BUG-048).
  useBodyScrollLock()

  const [displayName, setDisplayName] = useState(person.display_name ?? "")
  const [birthYear, setBirthYear] = useState(person.birth_year ? String(person.birth_year) : "")
  const [ridingSince, setRidingSince] = useState(
    person.riding_since
      ? String(person.riding_since)
      : onboarding.start_year
      ? String(onboarding.start_year)
      : ""
  )
  const [bio, setBio] = useState(person.bio ?? "")
  const [homeResortId, setHomeResortId] = useState(person.home_resort_id ?? "")
  const [city, setCity]       = useState(person.city    ?? "")
  const [region, setRegion]   = useState(person.region  ?? "")
  const [country, setCountry] = useState(person.country ?? "")
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(person.privacy_level ?? "private")
  const [links, setLinks] = useState<ProfileLink[]>(person.links ?? [])
  const [newLinkUrl, setNewLinkUrl] = useState("")
  const [newLinkLabel, setNewLinkLabel] = useState("")

  // Member page (curated profile). Statement + milestones persist through the
  // tier-gated /api/me/profile-curation route, not the direct profiles write.
  const [statement, setStatement] = useState(person.profile_statement ?? "")
  const [milestones, setMilestones] = useState<{ year: string; label: string }[]>(
    (person.profile_milestones ?? []).map((m) => ({ year: String(m.year), label: m.label })),
  )

  // Avatar upload
  const [avatarUrl, setAvatarUrl] = useState<string | null>(person.avatar_url ?? null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activePersonId) return
    if (file.size > 5 * 1024 * 1024) { setAvatarError("Max 5 MB"); return }
    if (!file.type.startsWith("image/")) { setAvatarError("Images only"); return }
    setUploadingAvatar(true)
    setAvatarError(null)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const path = `avatars/${activePersonId}-${Date.now()}.${ext}`
      const { data, error } = await supabase.storage
        .from("board-images")
        .upload(path, file, { contentType: file.type, upsert: false })
      if (error || !data) throw new Error(error?.message ?? "Upload failed")
      const { data: { publicUrl } } = supabase.storage.from("board-images").getPublicUrl(data.path)
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", activePersonId)
      setAvatarUrl(publicUrl)
      setProfileOverride({ avatar_url: publicUrl })
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const canSave = displayName.trim().length > 0

  function addLink() {
    const url = newLinkUrl.trim()
    if (!url) return
    const fullUrl = url.startsWith("http") ? url : `https://${url}`
    const detected = detectPlatform(fullUrl)
    const label = newLinkLabel.trim() || detected.label
    setLinks((prev) => [...prev, { label, url: fullUrl }])
    setNewLinkUrl("")
    setNewLinkLabel("")
  }

  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateLinkLabel(i: number, label: string) {
    setLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, label } : l))
  }

  // ── Milestones (Member page) ──
  function addMilestone() {
    setMilestones((prev) => [...prev, { year: "", label: "" }])
  }
  function removeMilestone(i: number) {
    setMilestones((prev) => prev.filter((_, idx) => idx !== i))
  }
  function updateMilestone(i: number, field: "year" | "label", value: string) {
    setMilestones((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)))
  }

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!canSave) return

    // Add pending new link if URL entered but not yet submitted
    const finalLinks = [...links]
    if (newLinkUrl.trim()) {
      const url = newLinkUrl.trim().startsWith("http") ? newLinkUrl.trim() : `https://${newLinkUrl.trim()}`
      const detected = detectPlatform(url)
      finalLinks.push({ label: newLinkLabel.trim() || detected.label, url })
    }

    const override = {
      display_name:   displayName.trim(),
      birth_year:     birthYear   ? parseInt(birthYear)   : undefined,
      riding_since:   ridingSince ? parseInt(ridingSince) : undefined,
      bio:            bio.trim()  || undefined,
      home_resort_id: homeResortId || undefined,
      city:           city.trim()    || undefined,
      region:         region.trim()  || undefined,
      country:        country.trim() || undefined,
      privacy_level:  privacyLevel,
      links:          finalLinks.length > 0 ? finalLinks : undefined,
    }

    // Optimistically update store so UI reflects changes immediately
    setProfileOverride(override)

    // Persist to Supabase for real (non-mock) users
    if (isAuthUser(person.id)) {
      setSaving(true)
      setSaveError(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase.from("profiles").update({
          display_name:   override.display_name,
          birth_year:     override.birth_year     ?? null,
          riding_since:   override.riding_since   ?? null,
          bio:            override.bio            ?? null,
          home_resort_id: override.home_resort_id ?? null,
          city:           override.city           ?? null,
          region:         override.region         ?? null,
          country:        override.country        ?? null,
          privacy_level:  override.privacy_level  ?? "public",
          links:          override.links          ?? null,
        }).eq("id", user.id)

        if (error) {
          console.error("Profile save failed:", error)
          setSaveError(error.message)
          setSaving(false)
          return  // keep modal open so user can see error
        }
      }

      // Member page fields go through the tier-gated curation route (D8), so
      // the perk is enforced server-side. Only sent for members; a free caller
      // would 403 and it is not surfaced to them anyway.
      if (isMember) {
        const cleanedMilestones = milestones
          .map((m) => ({ year: parseInt(m.year, 10), label: m.label.trim() }))
          .filter((m) => Number.isFinite(m.year) && m.year >= 1900 && m.year <= 2100 && m.label.length > 0)
          .sort((a, b) => a.year - b.year)
        const trimmedStatement = statement.trim()
        try {
          const r = await fetch("/api/me/profile-curation", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile_statement: trimmedStatement || null,
              profile_milestones: cleanedMilestones,
            }),
          })
          if (r.ok) {
            setProfileOverride({
              profile_statement: trimmedStatement || null,
              profile_milestones: cleanedMilestones,
            })
          } else {
            const { error: curErr } = await r.json().catch(() => ({ error: "Could not save your member page." }))
            setSaveError(curErr ?? "Could not save your member page.")
            setSaving(false)
            return
          }
        } catch {
          setSaveError("Could not save your member page.")
          setSaving(false)
          return
        }
      }

      setSaving(false)
    }

    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-surface border border-border-default rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border-default flex-shrink-0">
          <h2 className="text-base font-bold text-foreground">Edit profile</h2>
          <p className="text-xs text-muted mt-0.5">Your details are private by default</p>
        </div>

        {/* Avatar preview + upload */}
        <div className="px-6 pt-5 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="w-14 h-14 rounded-full object-cover border-2 border-border-default" />
            ) : (
              <RiderAvatar
                person={{ ...person, display_name: displayName.trim() || person.display_name }}
                size="xl"
                ring={!!(person.membership_tier && person.membership_tier !== "free")}
              />
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              title="Change photo"
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-surface border border-border-default flex items-center justify-center text-[11px] hover:bg-surface-active transition-colors shadow-md"
            >
              {uploadingAvatar ? <span className="animate-pulse">…</span> : "📷"}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{displayName.trim() || "—"}</div>
            <div className="text-xs text-muted mt-0.5">
              {birthYear && `b. ${birthYear}`}
              {birthYear && ridingSince && " · "}
              {ridingSince && `riding since ${ridingSince}`}
            </div>
            {avatarError && <p className="text-[11px] text-red-400 mt-1">{avatarError}</p>}
          </div>
        </div>

        {/* Fields */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <Field label="Name" required>
            <input
              autoFocus
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Year of birth">
              <input
                type="number"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="e.g. 1985"
                min={1920}
                max={currentYear}
                className={inputCls}
              />
            </Field>
            <Field label="Riding since">
              <input
                type="number"
                value={ridingSince}
                onChange={(e) => setRidingSince(e.target.value)}
                placeholder="e.g. 1999"
                min={1965}
                max={currentYear}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Bio">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A little about your snowboarding story…"
              rows={3}
              className={cn(inputCls, "resize-none")}
            />
          </Field>

          <Field label="Home resort">
            <select
              value={homeResortId}
              onChange={(e) => setHomeResortId(e.target.value)}
              className={inputCls}
            >
              <option value="">— none selected —</option>
              {PLACES.filter((p) => p.place_type === "resort").map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Vancouver"
                maxLength={100}
                className={inputCls}
              />
            </Field>
            <Field label="Region / Province / State">
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. BC"
                maxLength={100}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Country">
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Canada"
              maxLength={100}
              className={inputCls}
            />
          </Field>

          {/* Links */}
          <div>
            <label className="block text-xs text-muted mb-2">Links</label>

            {/* Existing links */}
            {links.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 bg-background border border-border-default rounded-lg px-3 py-2">
                    <span className="text-sm flex-shrink-0">{detectPlatform(link.url).icon}</span>
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => updateLinkLabel(i, e.target.value)}
                      className="flex-1 min-w-0 bg-transparent text-xs text-foreground focus:outline-none"
                    />
                    <span className="text-[10px] text-muted truncate max-w-[100px]">{link.url.replace(/^https?:\/\//, "")}</span>
                    <button
                      onClick={() => removeLink(i)}
                      className="text-muted hover:text-red-400 transition-colors text-sm flex-shrink-0"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new link */}
            <div className="space-y-1.5">
              <input
                type="url"
                value={newLinkUrl}
                onChange={(e) => {
                  setNewLinkUrl(e.target.value)
                  // Auto-suggest label from URL
                  if (!newLinkLabel) {
                    const detected = detectPlatform(e.target.value)
                    if (detected.label !== "Link") setNewLinkLabel(detected.label)
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && addLink()}
                placeholder="https://instagram.com/username"
                className={inputCls}
              />
              {newLinkUrl.trim() && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addLink()}
                    placeholder={detectPlatform(newLinkUrl).label}
                    className="flex-1 bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={addLink}
                    className="px-4 py-2 bg-[#1C1917] text-white text-xs font-medium rounded-lg hover:bg-[#292524] transition-colors flex-shrink-0"
                  >
                    Add
                  </button>
                </div>
              )}
              {links.length === 0 && !newLinkUrl && (
                <p className="text-[11px] text-muted">Instagram, YouTube, personal site, etc.</p>
              )}
            </div>
          </div>

          {/* ── Member page (curated profile) ── */}
          {isMember ? (
            <div className="border-t border-border-default pt-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-foreground">Member page</span>
                <span className="text-[10px] text-accent-strong">Members only</span>
              </div>
              <p className="text-[11px] text-muted mb-3">
                A curated page, like the brands get. Your statement and milestones show on your profile.
              </p>

              <Field label="Statement">
                <textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  placeholder="A line that sums up your riding. The first line shows larger."
                  rows={3}
                  maxLength={600}
                  className={cn(inputCls, "resize-none")}
                />
              </Field>

              <div className="mt-4">
                <label className="block text-xs text-muted mb-2">Milestones</label>
                {milestones.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {milestones.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="number"
                          value={m.year}
                          onChange={(e) => updateMilestone(i, "year", e.target.value)}
                          placeholder="Year"
                          min={1900}
                          max={2100}
                          className="w-20 bg-background border border-border-default rounded-lg px-2.5 py-2 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={m.label}
                          onChange={(e) => updateMilestone(i, "label", e.target.value)}
                          placeholder="What happened"
                          maxLength={120}
                          className="flex-1 min-w-0 bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => removeMilestone(i)}
                          className="text-muted hover:text-red-400 transition-colors text-sm flex-shrink-0"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={addMilestone}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  + Add milestone
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted border-t border-border-default pt-4">
              Members can curate their page with a statement and milestones.{" "}
              <a href="/membership" className="text-accent-strong hover:underline">Learn more</a>
            </p>
          )}

          <Field label="Profile visibility">
            <div className="flex gap-2">
              {([
                { v: "private", icon: "🔒", desc: "Only you" },
                { v: "public", icon: "🌐", desc: "Everyone" },
              ] as { v: PrivacyLevel; icon: string; desc: string }[]).map(({ v, icon, desc }) => (
                <button
                  key={v}
                  onClick={() => setPrivacyLevel(v)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg border text-xs transition-all",
                    privacyLevel === v
                      ? "border-blue-500 bg-blue-950/40 text-blue-200"
                      : "border-border-default text-muted hover:border-border-default hover:text-foreground"
                  )}
                >
                  <span className="text-base">{icon}</span>
                  <span className="font-medium capitalize">{v}</span>
                  <span className="text-[10px] opacity-60">{desc}</span>
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-default flex-shrink-0 space-y-2">
          {saveError && (
            <p className="text-red-400 text-xs text-center">{saveError}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm text-muted hover:text-foreground border border-border-default hover:border-border-default transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                canSave && !saving
                  ? "bg-[#1C1917] text-white hover:bg-[#292524]"
                  : "bg-surface-active text-muted cursor-not-allowed"
              )}
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  "w-full bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1.5">
        {label}{required && <span className="text-blue-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
