"use client"

// Curated Member Profile (paid differentiator): the member sections that render
// below the RiderCard on both the public /people/[id] view and the owner's own
// timeline panel. Three blocks, members-only (annual|lifetime|founding):
//   T8  Statement  — a dark showcase block; the first line reads as a tagline.
//   T9  Milestones — a compact personal year-spine.
//   T10 Featured   — a horizontal rail of the member's curated stack entries
//                    (public_stack_entries, owner_type='profile'), the same
//                    selection that powers their /t/[slug] Stack View.
//
// Gate is the live membership tier (D1): when a membership lapses to free, the
// whole block disappears and the stored fields are preserved. Free riders see
// nothing here (and, on their own profile, no owner affordances). All three
// blocks render nothing when empty for a visitor; the owner gets a quiet
// "add" affordance instead so the page is never a dead end.

import { useEffect, useState } from "react"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { useLineageStore } from "@/store/lineage-store"
import { memberBadgeFor } from "@/components/ui/member-badge"
import { personHrefById, entityHref } from "@/lib/entity-links"
import type { Person } from "@/types"
import type { PublicStackPayload, ResolvedStackEntry } from "@/lib/public-timeline-read"

interface Props {
  person: Partial<Person> & { id?: string; display_name?: string }
  /** Owner viewing their own profile: unlocks the "add" affordances. */
  isOwner: boolean
  /** Opens the Edit Profile modal (owner affordance targets the Member page section). */
  onEdit?: () => void
}

const ACCENT_HEX: Record<string, string> = {
  violet: "#8b5cf6", teal: "#0d9488", amber: "#f59e0b", emerald: "#10b981", cyan: "#06b6d4",
}

export function MemberCuratedSections({ person, isOwner, onEdit }: Props) {
  const { catalog } = useLineageStore()
  const isPaid = !!memberBadgeFor(person.membership_tier)

  const [featured, setFeatured] = useState<ResolvedStackEntry[]>([])

  // Featured rail: read the member's curated stack. Public endpoint, no auth.
  useEffect(() => {
    if (!isPaid || !person.id) return
    let cancelled = false
    fetch(`/api/people/${person.id}/stack`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PublicStackPayload | null) => {
        if (cancelled || !data) return
        // Skip category_summary cards in the rail — they have no single target.
        setFeatured((data.entries ?? []).filter((e) => e.entry_type !== "category_summary").slice(0, 6))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isPaid, person.id])

  if (!isPaid) return null

  const statement = (person.profile_statement ?? "").trim()
  const milestones = (person.profile_milestones ?? []).slice().sort((a, b) => a.year - b.year)
  const firstName = (person.display_name ?? "This rider").split(" ")[0]

  const hasStatement = statement.length > 0
  const hasMilestones = milestones.length > 0

  // Nothing to show and not the owner → render nothing (no empty scaffold).
  if (!hasStatement && !hasMilestones && featured.length === 0 && !isOwner) return null

  const statementLines = statement.split("\n")
  const tagline = statementLines[0]
  const rest = statementLines.slice(1).join("\n").trim()

  return (
    <div className="mb-8 space-y-5">
      {/* ── Statement (T8) ── */}
      {hasStatement ? (
        <section
          className="rounded-2xl px-6 py-6 sm:px-8 sm:py-7"
          style={{ background: "linear-gradient(160deg, #1b2233 0%, #12151f 60%, #0c0e15 100%)" }}
        >
          <p className="text-lg sm:text-xl font-bold leading-snug text-white">{tagline}</p>
          {rest && (
            <p className="mt-3 text-sm font-light leading-relaxed text-white/75 whitespace-pre-wrap">{rest}</p>
          )}
        </section>
      ) : isOwner ? (
        <button
          onClick={onEdit}
          className="w-full rounded-2xl border border-dashed border-border-default px-6 py-5 text-left text-sm text-muted hover:text-foreground hover:border-blue-500/40 transition-colors"
        >
          + Add your statement <span className="text-muted">— a line that sums up your riding.</span>
        </button>
      ) : null}

      {/* ── Milestones (T9) ── */}
      {hasMilestones ? (
        <section className="rounded-2xl border border-border-default bg-surface px-5 py-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Milestones</h3>
          <ol className="relative ml-2 border-l border-border-default">
            {milestones.map((m, i) => (
              <li key={`${m.year}-${i}`} className="relative pl-5 pb-4 last:pb-0">
                <span
                  className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full"
                  style={{ background: "var(--accent, #3b82f6)" }}
                />
                <span className="text-sm font-bold tabular-nums text-foreground">{m.year}</span>
                <span className="ml-2 text-sm text-muted">{m.label}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : isOwner ? (
        <button
          onClick={onEdit}
          className="w-full rounded-2xl border border-dashed border-border-default px-6 py-4 text-left text-sm text-muted hover:text-foreground hover:border-blue-500/40 transition-colors"
        >
          + Add milestones <span className="text-muted">— the moments that shaped your riding.</span>
        </button>
      ) : null}

      {/* ── Featured (T10) ── */}
      {featured.length > 0 && (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">
            {isOwner ? "Your featured" : `${firstName}'s featured`}
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {featured.map((e) => (
              <FeaturedCard key={e.id} entry={e} catalog={catalog} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function FeaturedCard({
  entry,
  catalog,
}: {
  entry: ResolvedStackEntry
  catalog: ReturnType<typeof useLineageStore.getState>["catalog"]
}) {
  const accent = ACCENT_HEX[entry.accent] ?? "#3b82f6"

  const inner = (
    <div className="w-40 shrink-0 rounded-xl border border-border-default bg-surface overflow-hidden hover:border-blue-500/40 transition-colors">
      <div className="relative h-24 bg-surface-hover" style={{ borderBottom: `2px solid ${accent}` }}>
        {entry.thumbPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.thumbPhotoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl" style={{ color: accent }}>
            {entry.entry_type === "story" ? "✍" : entry.entry_type === "place" ? "🏔"
              : entry.entry_type === "event" ? "🏆" : entry.entry_type === "board" ? "🏂" : "👤"}
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: accent }}>
          {entry.kicker}
        </div>
        <div className="mt-0.5 text-xs font-medium text-foreground leading-snug line-clamp-2">{entry.title}</div>
        {entry.kickerMeta && <div className="mt-0.5 text-[10px] text-muted truncate">{entry.kickerMeta}</div>}
      </div>
    </div>
  )

  // Deep-link each card to its underlying record, matching how the rest of the
  // profile links entities. Riders are top-level (/people); other entities are
  // community-scoped; stories open the stories index focused on the moment.
  if (!entry.refId) return inner
  if (entry.entry_type === "rider") {
    return <Link href={personHrefById(entry.refId, catalog.people)} className="block">{inner}</Link>
  }
  if (entry.entry_type === "story") {
    return <CommunityLink href={`/stories?focus=${entry.refId}`} className="block">{inner}</CommunityLink>
  }
  const href = entityHref(entry.refId, entry.entry_type, catalog)
  return <CommunityLink href={href} className="block">{inner}</CommunityLink>
}
