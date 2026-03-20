import type { Claim, Person, OverlapFact, ConnectionSummary } from "@/types"
import { getEntityName } from "./mock-data"

// ─── Time window helpers ──────────────────────────────────────────────────────

function getYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null
  const y = parseInt(dateStr.substring(0, 4))
  return isNaN(y) ? null : y
}

function claimWindow(c: Claim): { start: number; end: number } {
  const now = new Date().getFullYear()
  const start = getYear(c.start_date) ?? now
  const end = getYear(c.end_date) ?? start
  return { start, end }
}

function overlappingRange(
  aStart: number, aEnd: number,
  bStart: number, bEnd: number
): { start: number; end: number } | null {
  const start = Math.max(aStart, bStart)
  const end = Math.min(aEnd, bEnd)
  return start <= end ? { start, end } : null
}

function fmtRange(start: number, end: number): string {
  if (start === end) return `${start}`
  return `${start}–${end}`
}

// ─── Main algorithm ───────────────────────────────────────────────────────────

export function computeConnectionSummary(
  personA: Person,
  personB: Person,
  claimsA: Claim[],
  claimsB: Claim[],
  resolveName?: (id: string, type: string) => string
): ConnectionSummary {
  const getName = resolveName ?? getEntityName
  const raw: OverlapFact[] = []

  // 1. Direct rode_with (+8)
  const directAtoB = claimsA.filter(
    (c) => c.predicate === "rode_with" && c.object_id === personB.id
  )
  const directBtoA = claimsB.filter(
    (c) => c.predicate === "rode_with" && c.object_id === personA.id
  )
  if (directAtoB.length > 0 || directBtoA.length > 0) {
    const claim = directAtoB[0] || directBtoA[0]
    const w = claimWindow(claim)
    raw.push({
      type: "rode_with",
      label: "Rode together",
      detail: fmtRange(w.start, w.end),
      score: 8,
      entityId: personB.id,
      entityType: "person",
    })
  }

  // 2. Shared resorts with year overlap (+2/overlapping year, cap +8)
  const resortA = claimsA.filter((c) => c.predicate === "rode_at" && c.object_type === "place")
  const resortB = claimsB.filter((c) => c.predicate === "rode_at" && c.object_type === "place")
  const seenResorts = new Set<string>()
  for (const cA of resortA) {
    if (seenResorts.has(cA.object_id)) continue
    for (const cB of resortB) {
      if (cA.object_id !== cB.object_id) continue
      const wA = claimWindow(cA)
      const wB = claimWindow(cB)
      const overlap = overlappingRange(wA.start, wA.end, wB.start, wB.end)
      if (!overlap) continue
      const years = overlap.end - overlap.start + 1
      const score = Math.min(years * 2, 8)
      const name = getName(cA.object_id, "place")
      raw.push({
        type: "resort",
        label: `Both rode ${name}`,
        detail: fmtRange(overlap.start, overlap.end),
        score,
        entityId: cA.object_id,
        entityType: "place",
      })
      seenResorts.add(cA.object_id)
    }
  }

  // 3. Shared event instances (+10)
  const eventA = claimsA.filter((c) => c.predicate === "competed_at")
  const eventB = claimsB.filter((c) => c.predicate === "competed_at")
  const seenEvents = new Set<string>()
  for (const cA of eventA) {
    if (seenEvents.has(cA.object_id)) continue
    for (const cB of eventB) {
      if (cA.object_id !== cB.object_id) continue
      const name = getName(cA.object_id, "event")
      const wA = claimWindow(cA)
      raw.push({
        type: "event",
        label: `Both attended ${name}`,
        detail: `${wA.start}`,
        score: 10,
        entityId: cA.object_id,
        entityType: "event",
      })
      seenEvents.add(cA.object_id)
    }
  }

  // 4. Shared sponsors with year overlap (+6)
  const sponsorA = claimsA.filter((c) => c.predicate === "sponsored_by")
  const sponsorB = claimsB.filter((c) => c.predicate === "sponsored_by")
  const seenSponsors = new Set<string>()
  for (const cA of sponsorA) {
    if (seenSponsors.has(cA.object_id)) continue
    for (const cB of sponsorB) {
      if (cA.object_id !== cB.object_id) continue
      const wA = claimWindow(cA)
      const wB = claimWindow(cB)
      const overlap = overlappingRange(wA.start, wA.end, wB.start, wB.end)
      if (!overlap) continue
      const name = getName(cA.object_id, "org")
      raw.push({
        type: "sponsor",
        label: `Both sponsored by ${name}`,
        detail: fmtRange(overlap.start, overlap.end),
        score: 6,
        entityId: cA.object_id,
        entityType: "org",
      })
      seenSponsors.add(cA.object_id)
    }
  }

  // 5. Same board model (+3) or same brand (+2)
  const boardA = claimsA.filter((c) => c.predicate === "owned_board")
  const boardB = claimsB.filter((c) => c.predicate === "owned_board")
  const seenBoards = new Set<string>()
  for (const cA of boardA) {
    if (seenBoards.has(cA.object_id)) continue
    for (const cB of boardB) {
      if (cA.object_id !== cB.object_id) continue
      const wA = claimWindow(cA)
      const wB = claimWindow(cB)
      if (!overlappingRange(wA.start, wA.end, wB.start, wB.end)) continue
      const overlap = overlappingRange(wA.start, wA.end, wB.start, wB.end)!
      const name = getName(cA.object_id, "board")
      raw.push({
        type: "board",
        label: `Both rode ${name}`,
        detail: fmtRange(overlap.start, overlap.end),
        score: 3,
        entityId: cA.object_id,
        entityType: "board",
      })
      seenBoards.add(cA.object_id)
    }
  }

  // 6. Shared teams/orgs (+3)
  const teamA = claimsA.filter((c) => c.predicate === "part_of_team")
  const teamB = claimsB.filter((c) => c.predicate === "part_of_team")
  const seenTeams = new Set<string>()
  for (const cA of teamA) {
    if (seenTeams.has(cA.object_id)) continue
    for (const cB of teamB) {
      if (cA.object_id !== cB.object_id) continue
      const wA = claimWindow(cA)
      const wB = claimWindow(cB)
      const overlap = overlappingRange(wA.start, wA.end, wB.start, wB.end)
      if (!overlap) continue
      const name = getName(cA.object_id, "org")
      raw.push({
        type: "team",
        label: `Both part of ${name}`,
        detail: fmtRange(overlap.start, overlap.end),
        score: 3,
        entityId: cA.object_id,
        entityType: "org",
      })
      seenTeams.add(cA.object_id)
    }
  }

  // ─── Sort + score ────────────────────────────────────────────────────────

  const facts = raw.sort((a, b) => b.score - a.score)
  const totalScore = facts.reduce((sum, f) => sum + f.score, 0)

  const strength: ConnectionSummary["strength"] =
    totalScore >= 20 ? "strong" : totalScore >= 8 ? "medium" : totalScore > 0 ? "light" : "none"

  // ─── Generate text ───────────────────────────────────────────────────────

  const topFacts = facts.slice(0, 7)
  const bullets = topFacts.map((f) => `${f.label} (${f.detail})`)

  // Headline: name + top 1-2 place names
  const topPlaces = facts
    .filter((f) => f.type === "resort")
    .slice(0, 2)
    .map((f) => f.label.replace("Both rode ", ""))
  const headline =
    topPlaces.length > 0
      ? `${personA.display_name} + ${personB.display_name}: ${topPlaces.join(" + ")} overlap`
      : facts[0]
      ? `${personA.display_name} + ${personB.display_name}: ${facts[0].label}`
      : `${personA.display_name} + ${personB.display_name}: no overlaps found`

  const strengthLabel = strength.charAt(0).toUpperCase() + strength.slice(1)

  const shortLines = [
    `🏔 ${headline}`,
    ...bullets.slice(0, 3).map((b) => `• ${b}`),
  ]
  const shortCardText = shortLines.join("\n").substring(0, 240)

  const longLines = [
    headline,
    `Connection: ${strengthLabel} (${totalScore} pts)`,
    "",
    ...bullets.map((b) => `• ${b}`),
  ]
  const longSummaryText = longLines.join("\n").substring(0, 600)

  return {
    score: totalScore,
    strength,
    headline,
    facts,
    bullets,
    shortCardText,
    longSummaryText,
  }
}
