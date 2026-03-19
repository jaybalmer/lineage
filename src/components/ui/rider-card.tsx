"use client"

import { useState, useRef } from "react"
import type { Claim, Person, MembershipState } from "@/types"
import type { ProfileLink } from "@/types"
import { getLinkIcon } from "@/components/ui/edit-profile-modal"
import { supabase } from "@/lib/supabase"

// ── Card themes ───────────────────────────────────────────────────────────────

const THEMES = {
  alpine: {
    label: "Alpine",
    grad: ["#0c1e4a", "#071428", "#050d1a"],
    accent: "#3b82f6",
  },
  forest: {
    label: "Forest",
    grad: ["#052e16", "#031a0e", "#020c07"],
    accent: "#34d399",
  },
  crimson: {
    label: "Crimson",
    grad: ["#3f0d0d", "#260707", "#160404"],
    accent: "#f87171",
  },
  midnight: {
    label: "Midnight",
    grad: ["#1a1a2e", "#16213e", "#0f3460"],
    accent: "#a78bfa",
  },
  slate: {
    label: "Slate",
    grad: ["#1e2130", "#151820", "#0d0f14"],
    accent: "#94a3b8",
  },
} as const

type ThemeKey = keyof typeof THEMES

const TIER_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  annual:   { text: "MEMBER",            color: "#3b82f6", bg: "#3b82f622" },
  lifetime: { text: "LIFETIME MEMBER",   color: "#8b5cf6", bg: "#8b5cf622" },
  founding: { text: "FOUNDING MEMBER ✦", color: "#f59e0b", bg: "#f59e0b22" },
}

// ── Mountain SVG header illustration ─────────────────────────────────────────

function MountainHeader({ accent }: { accent: string }) {
  return (
    <svg
      viewBox="0 0 400 140"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {/* Sky stars */}
      {[[30,18],[85,10],[165,20],[265,8],[345,15],[385,6]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.2} fill="rgba(255,255,255,0.45)" />
      ))}
      {/* Ridges back → front */}
      <path d="M0 100 L40 60 L80 80 L130 38 L175 68 L225 28 L275 58 L325 43 L375 63 L400 50 L400 140 L0 140Z"
        fill="rgba(255,255,255,0.04)" />
      <path d="M0 115 L30 80 L70 96 L115 58 L165 84 L215 48 L265 74 L315 57 L365 77 L400 64 L400 140 L0 140Z"
        fill="rgba(255,255,255,0.07)" />
      <path d="M0 130 L22 102 L58 114 L95 76 L145 102 L195 68 L245 90 L295 73 L345 92 L382 78 L400 86 L400 140 L0 140Z"
        fill="rgba(255,255,255,0.11)" />
      {/* Snow caps */}
      <path d="M122 41 L130 26 L138 41Z" fill="rgba(255,255,255,0.65)" />
      <path d="M216 31 L225 16 L234 31Z" fill="rgba(255,255,255,0.60)" />
      <path d="M315 46 L323 32 L331 46Z" fill="rgba(255,255,255,0.55)" />
      {/* Bottom accent glow */}
      <defs>
        <radialGradient id="rg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="60" width="400" height="80" fill="url(#rg)" />
    </svg>
  )
}

// ── Stat cell ─────────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-3 px-1 bg-surface-hover">
      <span className="text-xl font-bold text-foreground leading-none tabular-nums">{value}</span>
      <span className="text-[9px] text-muted uppercase tracking-widest mt-1"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        {label}
      </span>
    </div>
  )
}

// ── RiderCard ─────────────────────────────────────────────────────────────────

interface Place { id: string; name: string }

export interface RiderCardProps {
  person: Partial<Person> & { display_name?: string }
  claims: Claim[]
  membership: MembershipState
  homeResort?: Place | null
  isOwn?: boolean
  userId?: string
  onEdit?: () => void
  onPlayTimeline?: () => void
  onMemberCard?: () => void
}

export function RiderCard({
  person,
  claims,
  membership,
  homeResort,
  isOwn,
  userId,
  onEdit,
  onPlayTimeline,
  onMemberCard,
}: RiderCardProps) {
  // Stats derived from claims
  const boardCount  = claims.filter((c) => c.predicate === "owned_board").length
  const placeCount  = new Set(
    claims.filter((c) => ["rode_at", "worked_at"].includes(c.predicate)).map((c) => c.object_id)
  ).size
  const eventCount  = new Set(
    claims.filter((c) => ["competed_at", "spectated_at", "organized_at"].includes(c.predicate)).map((c) => c.object_id)
  ).size
  const yearsRiding = person.riding_since
    ? new Date().getFullYear() - person.riding_since
    : null

  // Card theme (persisted per-browser)
  const [theme, setTheme] = useState<ThemeKey>(() => {
    if (typeof window === "undefined") return "alpine"
    return (localStorage.getItem("lineage_card_theme") as ThemeKey | null) ?? "alpine"
  })
  const t = THEMES[theme]

  function pickTheme(key: ThemeKey) {
    setTheme(key)
    localStorage.setItem("lineage_card_theme", key)
  }

  // Avatar upload
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (person as Person).avatar_url ?? null
  )
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 5 * 1024 * 1024) { setAvatarError("Max 5 MB"); return }
    if (!file.type.startsWith("image/")) { setAvatarError("Images only"); return }
    setUploadingAvatar(true)
    setAvatarError(null)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const path = `avatars/${userId}-${Date.now()}.${ext}`
      const { data, error } = await supabase.storage
        .from("board-images")
        .upload(path, file, { contentType: file.type, upsert: false })
      if (error || !data) throw new Error(error?.message ?? "Upload failed")
      const { data: { publicUrl } } = supabase.storage.from("board-images").getPublicUrl(data.path)
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId)
      setAvatarUrl(publicUrl)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const tier      = TIER_LABEL[membership.tier]
  const name      = person.display_name ?? "Rider"
  const initials  = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  const shareUrl  = typeof window !== "undefined"
    ? (userId ? `${window.location.origin}/riders/${userId}` : window.location.href)
    : ""

  const grad = `linear-gradient(170deg, ${t.grad[0]} 0%, ${t.grad[1]} 55%, ${t.grad[2]} 100%)`

  return (
    <div className="rounded-2xl overflow-hidden border border-border-default shadow-xl mb-8">

      {/* ── Header / photo area ────────────────────────────────────────────── */}
      {/* Note: no overflow:hidden here so the avatar circle (-bottom-10) isn't clipped */}
      <div className="relative h-44 flex items-center justify-center" style={{ background: grad }}>
        <div className="absolute inset-0 overflow-hidden rounded-t-2xl">
          <MountainHeader accent={t.accent} />
        </div>

        {/* Theme colour dots — top right */}
        {isOwn && (
          <div className="absolute top-3 right-3 flex gap-1.5 z-10">
            {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
              <button
                key={key}
                onClick={() => pickTheme(key)}
                title={THEMES[key].label}
                className="rounded-full border transition-transform"
                style={{
                  width: 14, height: 14,
                  background: THEMES[key].accent,
                  borderColor: theme === key ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
                  transform: theme === key ? "scale(1.35)" : "scale(1)",
                }}
              />
            ))}
          </div>
        )}

        {/* Avatar — sits at centre of header, overlaps the body below */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-10">
          <div
            className="w-20 h-20 rounded-full border-4 overflow-hidden flex items-center justify-center select-none"
            style={{
              borderColor: "var(--color-background)",
              background: `linear-gradient(145deg, ${t.accent}40, ${t.accent}10)`,
              boxShadow: `0 0 24px ${t.accent}50, 0 4px 12px rgba(0,0,0,0.4)`,
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span style={{ fontSize: 26, fontWeight: 800, color: t.accent, letterSpacing: -1, lineHeight: 1 }}>
                {initials}
              </span>
            )}
          </div>

          {/* Photo upload trigger (own profile) */}
          {isOwn && (
            <>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Change photo"
                className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-surface border border-border-default flex items-center justify-center text-xs hover:bg-surface-active transition-colors shadow-md"
              >
                {uploadingAvatar ? <span className="animate-pulse text-[10px]">…</span> : "📷"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Card body ─────────────────────────────────────────────────────── */}
      <div className="pt-12 px-5 pb-5 bg-surface">

        {/* Member tier badge */}
        {tier && (
          <div className="flex justify-center mb-2">
            <button
              onClick={onMemberCard}
              className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-widest hover:opacity-80 transition-opacity"
              style={{
                background: tier.bg,
                color: tier.color,
                border: `1px solid ${tier.color}55`,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {tier.text}
            </button>
          </div>
        )}

        {/* Name */}
        <h1 className="text-2xl font-bold text-foreground text-center leading-tight">
          {name}
        </h1>

        {/* Sub-info line */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 mt-1">
          {homeResort && (
            <span className="text-xs text-muted flex items-center gap-1">🏔 {homeResort.name}</span>
          )}
          {person.birth_year && (
            <span className="text-xs text-muted">b. {person.birth_year}</span>
          )}
          {person.riding_since && (
            <span className="text-xs text-muted">Since {person.riding_since}</span>
          )}
        </div>

        {/* Avatar upload error */}
        {avatarError && (
          <p className="text-xs text-red-400 text-center mt-1">{avatarError}</p>
        )}

        {/* ── Stats row ── */}
        <div
          className="grid grid-cols-4 gap-px mt-5 rounded-xl overflow-hidden border border-border-default"
          style={{ background: "var(--color-border-default)" }}
        >
          <Stat value={boardCount}  label="Boards"  />
          <Stat value={placeCount}  label="Places"  />
          <Stat value={eventCount}  label="Events"  />
          <Stat
            value={yearsRiding != null ? `${yearsRiding}y` : (person.riding_since ?? "—")}
            label="Riding"
          />
        </div>

        {/* Bio */}
        {(person as Person).bio ? (
          <p className="text-sm text-muted mt-4 leading-relaxed text-center max-w-sm mx-auto">
            {(person as Person).bio}
          </p>
        ) : isOwn ? (
          <button
            onClick={onEdit}
            className="w-full mt-4 text-xs text-muted hover:text-foreground transition-colors text-center py-1"
          >
            + Add a bio
          </button>
        ) : null}

        {/* Social links */}
        {(person as Person).links && (person as Person).links!.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {(person as Person).links!.map((link: ProfileLink, i: number) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover border border-border-default rounded-lg text-xs text-muted hover:text-foreground hover:border-blue-600 transition-all"
              >
                <span>{getLinkIcon(link.url)}</span>
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        )}

        {/* ── Action bar ── */}
        <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-border-default flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={onPlayTimeline}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-80 transition-opacity"
            >
              <span className="text-[10px]">▶</span> My Timeline
            </button>
            {isOwn && (
              <button
                onClick={onEdit}
                className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1.5 rounded hover:bg-surface-active"
              >
                Edit profile
              </button>
            )}
          </div>

          {/* Share */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: `${name} on Lineage`, url: shareUrl })
                  .catch((err: unknown) => {
                    // AbortError = user cancelled the share sheet — not a real error
                    if (err instanceof Error && err.name === "AbortError") return
                    navigator.clipboard.writeText(shareUrl).catch(() => null)
                  })
              } else {
                navigator.clipboard.writeText(shareUrl).then(() =>
                  alert("Profile link copied to clipboard!")
                )
              }
            }}
            className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1.5 rounded hover:bg-surface-active flex items-center gap-1"
          >
            <span>↗</span> Share
          </button>
        </div>
      </div>
    </div>
  )
}
