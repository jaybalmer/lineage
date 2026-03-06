"use client"

import { useState } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import { PLACES } from "@/lib/mock-data"
import type { Person, PrivacyLevel } from "@/types"

interface EditProfileModalProps {
  person: Person
  onClose: () => void
}

const currentYear = new Date().getFullYear()

export function EditProfileModal({ person, onClose }: EditProfileModalProps) {
  const { setProfileOverride, onboarding } = useLineageStore()

  const [displayName, setDisplayName] = useState(person.display_name)
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
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(person.privacy_level)

  const canSave = displayName.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    setProfileOverride({
      display_name: displayName.trim(),
      birth_year: birthYear ? parseInt(birthYear) : undefined,
      riding_since: ridingSince ? parseInt(ridingSince) : undefined,
      bio: bio.trim() || undefined,
      home_resort_id: homeResortId || undefined,
      privacy_level: privacyLevel,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#1e1e1e] flex-shrink-0">
          <h2 className="text-base font-bold text-white">Edit profile</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Your details are private by default</p>
        </div>

        {/* Avatar preview */}
        <div className="px-6 pt-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
            {(displayName.trim()[0] ?? "?").toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{displayName.trim() || "—"}</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {birthYear && `b. ${birthYear}`}
              {birthYear && ridingSince && " · "}
              {ridingSince && `riding since ${ridingSince}`}
            </div>
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

          <Field label="Profile visibility">
            <div className="flex gap-2">
              {([
                { v: "private", icon: "🔒", desc: "Only you" },
                { v: "shared", icon: "👥", desc: "Connections" },
                { v: "public", icon: "🌐", desc: "Everyone" },
              ] as { v: PrivacyLevel; icon: string; desc: string }[]).map(({ v, icon, desc }) => (
                <button
                  key={v}
                  onClick={() => setPrivacyLevel(v)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg border text-xs transition-all",
                    privacyLevel === v
                      ? "border-blue-500 bg-blue-950/40 text-blue-200"
                      : "border-[#2a2a2a] text-zinc-500 hover:border-zinc-600 hover:text-white"
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
        <div className="px-6 py-4 border-t border-[#1e1e1e] flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white border border-[#2a2a2a] hover:border-zinc-600 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              canSave
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-[#1e1e1e] text-zinc-600 cursor-not-allowed"
            )}
          >
            Save profile
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5">
        {label}{required && <span className="text-blue-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
