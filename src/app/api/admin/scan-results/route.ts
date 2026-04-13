import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"

// ── Types ──────────────────────────────────────────────────────────────────

export interface MatchResult {
  type: "exact" | "fuzzy" | "none"
  person?: { id: string; display_name: string }
  candidates?: { id: string; display_name: string; score: number }[]
}

export interface ExtractedRow {
  raw: string
  name: string
  placement?: number
  division?: string
  country?: string
  score?: string
  match: MatchResult
}

// ── Text parsing ───────────────────────────────────────────────────────────

const COUNTRY_CODES = new Set([
  "USA", "CAN", "AUS", "NZL", "GBR", "FRA", "GER", "AUT", "SUI", "SWE",
  "NOR", "FIN", "JPN", "CHI", "CHN", "BRA", "ARG", "RUS", "NED", "BEL",
  "ITA", "ESP", "PRT", "POL", "CZE", "SVK", "SLO", "HUN", "ROU", "BUL",
  "US", "CA", "AU", "NZ", "GB", "FR", "DE", "AT", "CH", "SE", "NO", "FI",
])

const NOISE_PATTERNS = [
  /^[-–—=*#]+/, // pure separator lines
  /^(results|standings|final|heat|round|division|category|men|women|open|pro|am|amateur|junior|masters?)/i,
  /^\d{4}$/, // bare year
]

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 3) return true
  if (/^\d+$/.test(trimmed)) return true // pure number
  return NOISE_PATTERNS.some((p) => p.test(trimmed))
}

function stripLeadingRank(token: string): { name: string; placement?: number } {
  // Match "1.", "1)", "1st", "2nd", "3rd", "4th" at start
  const m = token.match(/^(\d+)(?:st|nd|rd|th)?[\.\)\s]+(.+)/)
  if (m) return { placement: parseInt(m[1], 10), name: m[2].trim() }
  return { name: token.trim() }
}

function stripTrailingTokens(name: string): { name: string; country?: string; score?: string } {
  let country: string | undefined
  let score: string | undefined

  // Strip score-like trailing tokens: "89.50", "88.75 pts"
  const scoreMatch = name.match(/\s+(\d{2,3}(?:\.\d+)?\s*(?:pts?|points?)?)$/i)
  if (scoreMatch) {
    score = scoreMatch[1].trim()
    name = name.slice(0, -scoreMatch[0].length).trim()
  }

  // Strip country code: "John Smith USA" or "John Smith (USA)"
  const countryMatch = name.match(/\s+\(?([A-Z]{2,3})\)?$/)
  if (countryMatch && COUNTRY_CODES.has(countryMatch[1])) {
    country = countryMatch[1]
    name = name.slice(0, -countryMatch[0].length).trim()
  }

  return { name, country, score }
}

function normaliseLastFirst(name: string): string {
  // "Smith, John" → "John Smith"
  const m = name.match(/^([A-Za-zÀ-ÖØ-öø-ÿ''-]+),\s*(.+)$/)
  if (m) return `${m[2].trim()} ${m[1].trim()}`
  return name
}

// Unicode-fold: lowercase + remove diacritics + collapse whitespace + remove punctuation
function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

interface ParsedLine {
  raw: string
  name: string
  placement?: number
  division?: string
  country?: string
  score?: string
}

function parseText(text: string): ParsedLine[] {
  const lines = text.split(/\r?\n/)
  const results: ParsedLine[] = []
  let currentDivision: string | undefined

  // Check if it looks like CSV
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? ""
  const isCSV = firstNonEmpty.includes(",") && firstNonEmpty.split(",").length >= 2

  if (isCSV) {
    return parseCSV(lines)
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Division header detection: "--- Women's Halfpipe ---" or "* Pro Men *"
    const divMatch = line.match(/^[-*=\s]*([A-Za-z].{3,40})[-*=\s]*$/)
    if (divMatch && isNoiseLine(line) && /[a-z]/i.test(line)) {
      // Could be a division header if it has alpha content but no real name pattern
      if (
        /\b(men|women|open|pro|am|amateur|junior|masters?|halfpipe|slopestyle|big\s*air|rail|street)\b/i.test(line)
      ) {
        currentDivision = divMatch[1].trim()
        continue
      }
    }

    if (isNoiseLine(line)) continue

    // Tab-separated or multi-space separated
    const isTSV = line.includes("\t")
    const parts = isTSV
      ? line.split("\t").map((p) => p.trim()).filter(Boolean)
      : line.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean)

    let rawName: string
    let placement: number | undefined

    if (parts.length >= 2) {
      // First part might be a rank
      const firstPartRank = parts[0].match(/^(\d+)(?:st|nd|rd|th)?\.?$/)
      if (firstPartRank) {
        placement = parseInt(firstPartRank[1], 10)
        rawName = parts[1]
      } else {
        const extracted = stripLeadingRank(parts[0])
        if (extracted.placement) {
          placement = extracted.placement
          rawName = extracted.name
        } else {
          rawName = line
        }
      }
    } else {
      const extracted = stripLeadingRank(line)
      placement = extracted.placement
      rawName = extracted.name
    }

    rawName = normaliseLastFirst(rawName)
    const { name, country, score } = stripTrailingTokens(rawName)

    if (name.length < 3) continue
    // Must contain at least one space (first + last name) or be clearly a single name
    if (!name.includes(" ") && name.length < 6) continue

    results.push({ raw, name, placement, division: currentDivision, country, score })
  }

  return results
}

function parseCSV(lines: string[]): ParsedLine[] {
  const results: ParsedLine[] = []
  let nameIdx = -1
  let placeIdx = -1
  let divisionIdx = -1
  let countryIdx = -1
  let scoreIdx = -1

  const header = lines[0]?.toLowerCase().split(",").map((h) => h.trim()) ?? []
  nameIdx = header.findIndex((h) => /^(name|rider|athlete|competitor|fullname|full.name)$/i.test(h))
  if (nameIdx === -1) nameIdx = 0 // fallback: first column
  placeIdx = header.findIndex((h) => /^(place|rank|pos|position|result|placing)$/i.test(h))
  divisionIdx = header.findIndex((h) => /^(division|div|category|cat|class)$/i.test(h))
  countryIdx = header.findIndex((h) => /^(country|nat|nationality|nation)$/i.test(h))
  scoreIdx = header.findIndex((h) => /^(score|points?|pts|total)$/i.test(h))

  const startRow = header.length > 0 && nameIdx !== -1 ? 1 : 0

  for (let i = startRow; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim()) continue
    const cols = raw.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))

    const rawName = cols[nameIdx] ?? ""
    if (!rawName || rawName.length < 3) continue

    const name = normaliseLastFirst(rawName.trim())
    const { name: cleanName, country: strippedCountry } = stripTrailingTokens(name)

    results.push({
      raw,
      name: cleanName,
      placement: placeIdx >= 0 ? parseInt(cols[placeIdx], 10) || undefined : undefined,
      division: divisionIdx >= 0 ? cols[divisionIdx] || undefined : undefined,
      country: countryIdx >= 0 ? cols[countryIdx] || strippedCountry : strippedCountry,
      score: scoreIdx >= 0 ? cols[scoreIdx] || undefined : undefined,
    })
  }

  return results
}

// ── Name matching ──────────────────────────────────────────────────────────

interface DbPerson { id: string; display_name: string }

function matchName(
  name: string,
  people: DbPerson[]
): MatchResult {
  const norm = normaliseName(name)

  // 1. Exact
  const exact = people.find((p) => normaliseName(p.display_name) === norm)
  if (exact) return { type: "exact", person: { id: exact.id, display_name: exact.display_name } }

  // 2. Fuzzy — score candidates
  const scored = people
    .map((p) => {
      const pNorm = normaliseName(p.display_name)
      const dist = levenshtein(norm, pNorm)

      // Token overlap: all tokens in query present in db name
      const queryTokens = norm.split(" ")
      const dbTokens = pNorm.split(" ")
      const allTokensPresent = queryTokens.every((t) => dbTokens.some((d) => d.startsWith(t) || t.startsWith(d)))

      const score = dist <= 2 ? dist : allTokensPresent ? 3 : 99
      return { ...p, score }
    })
    .filter((p) => p.score <= 3)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)

  if (scored.length > 0) {
    return {
      type: "fuzzy",
      person: { id: scored[0].id, display_name: scored[0].display_name },
      candidates: scored.map(({ id, display_name, score }) => ({ id, display_name, score })),
    }
  }

  return { type: "none" }
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { response } = await requireEditor()
  if (response) return response

  const body = await req.json() as { text: string; event_id?: string }
  const { text } = body

  if (!text || text.trim().length === 0) {
    return NextResponse.json({ error: "text is required" }, { status: 400 })
  }

  const client = getServiceClient()

  // Fetch all people for matching (people table + profiles)
  const [{ data: catalogPeople }, { data: profilePeople }] = await Promise.all([
    client.from("people").select("id, display_name"),
    client.from("profiles").select("id, display_name"),
  ])

  const allPeople: DbPerson[] = [
    ...(catalogPeople ?? []),
    ...(profilePeople ?? []),
  ].filter((p): p is DbPerson => Boolean(p.id && p.display_name))

  // Deduplicate by id
  const seen = new Set<string>()
  const uniquePeople = allPeople.filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  const parsed = parseText(text)

  const rows: ExtractedRow[] = parsed.map((p) => ({
    raw: p.raw,
    name: p.name,
    placement: p.placement,
    division: p.division,
    country: p.country,
    score: p.score,
    match: matchName(p.name, uniquePeople),
  }))

  return NextResponse.json({ rows })
}
