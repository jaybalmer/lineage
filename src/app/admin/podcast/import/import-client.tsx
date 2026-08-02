"use client"

// Podcast mention import: paste a seed, review it, import it.
//
// The back half of the transcript-to-mentions workflow, moved off Jay's Mac.
// Claude writes an UNRESOLVED seed anywhere (no database, no keys); this page
// resolves it against the live catalog server-side and renders the review
// surface, so the service-role key never leaves the server.
//
// Three steps: paste, review, import. Resolution is a dry run of the same route
// that performs the import, so the plan on screen is what will actually happen.
// Trimming and near-miss decisions are edits to the seed payload, which is
// re-resolved server-side on import, so nothing here is trusted client-side.

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { Nav } from "@/components/ui/nav"
import { cn, parseYouTubeId } from "@/lib/utils"
import { formatTimestamp } from "@/lib/mentions"
import type { ImportPlan, MentionSeed, PlanStory, PlanSubject } from "@/lib/mention-import"

/** A near-miss / ambiguous row a person has resolved on this page. */
type Decision = { subject_id?: string; confirm_new?: boolean }

const TYPE_LABEL: Record<string, string> = {
  person: "Rider", place: "Place", org: "Brand", event: "Event", board: "Board",
}

// Entity tier colours (CLAUDE.md): riders violet, places teal, brands cyan,
// events amber, boards emerald.
const TYPE_CHIP: Record<string, string> = {
  person: "text-violet-700 dark:text-violet-300 bg-violet-500/10 border-violet-500/40",
  place:  "text-teal-700 dark:text-teal-300 bg-teal-500/10 border-teal-500/40",
  org:    "text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border-cyan-500/40",
  event:  "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/40",
  board:  "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/40",
}

const PLACEHOLDER = `{
  "episode": { "show_name": "FNRad Podcast", "episode_number": 21 },
  "stories": [
    {
      "timestamp": "3:22",
      "title": "The Westbeach store in the Calgary mall",
      "excerpt": "...",
      "subjects": [
        { "subject_name": "Westbeach", "subject_type": "org" }
      ]
    }
  ]
}`

export function PodcastImportClient() {
  const [text, setText] = useState("")
  const [seed, setSeed] = useState<MentionSeed | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [imported, setImported] = useState<ImportPlan | null>(null)
  const [trimmed, setTrimmed] = useState<Set<string>>(new Set())
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [busy, setBusy] = useState<"resolve" | "import" | null>(null)

  /**
   * The seed as edited on this page: trims become `resolution: "skip"` and
   * decisions become a `subject_id` or `confirm_new` on the subject, which is
   * exactly what the seed format already means. No side channel, so the server
   * re-resolves a normal seed and stays the only authority.
   */
  const buildPayload = useCallback((): MentionSeed | null => {
    if (!seed) return null
    const next = JSON.parse(JSON.stringify(seed)) as MentionSeed

    ;(next.stories ?? []).forEach((story, i) => {
      if (trimmed.has(`s:${i}`)) story.resolution = "skip"
      ;(story.subjects ?? []).forEach((subject, j) => {
        const decision = decisions[`s:${i}:${j}`]
        if (!decision) return
        if (decision.subject_id) subject.subject_id = decision.subject_id
        if (decision.confirm_new) subject.confirm_new = true
      })
    })
    ;(next.mentions ?? []).forEach((row, i) => {
      if (trimmed.has(`m:${i}`)) row.resolution = "skip"
      const decision = decisions[`m:${i}`]
      if (!decision) return
      if (decision.subject_id) row.subject_id = decision.subject_id
      if (decision.confirm_new) row.confirm_new = true
    })

    return next
  }, [seed, trimmed, decisions])

  const run = useCallback(async (payload: MentionSeed, apply: boolean) => {
    setBusy(apply ? "import" : "resolve")
    setServerError(null)
    try {
      const res = await fetch("/api/admin/mentions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: payload, dryRun: !apply }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setServerError((body as { error?: string } | null)?.error ?? `Request failed (${res.status})`)
        return
      }
      const result = body as ImportPlan
      setPlan(result)
      if (apply) setImported(result)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setBusy(null)
    }
  }, [])

  /** Step 1. Parse locally first, so bad JSON never reaches the server (A10). */
  const onResolve = useCallback(async () => {
    setParseError(null)
    setServerError(null)
    setImported(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      setPlan(null)
      setSeed(null)
      // A paste that does not even start with an object is almost always the
      // transcript itself, which is the first thing anyone reaches for. Name
      // that case rather than handing back a JSON parser message about it.
      setParseError(
        text.trim().startsWith("{")
          ? err instanceof Error ? err.message : "Could not parse JSON"
          : "TRANSCRIPT",
      )
      return
    }
    setSeed(parsed as MentionSeed)
    setTrimmed(new Set())
    setDecisions({})
    await run(parsed as MentionSeed, false)
  }, [text, run])

  const onReresolve = useCallback(async () => {
    const payload = buildPayload()
    if (payload) await run(payload, false)
  }, [buildPayload, run])

  const onImport = useCallback(async () => {
    const payload = buildPayload()
    if (payload) await run(payload, true)
  }, [buildPayload, run])

  const isTrimmed = useCallback(
    (story: PlanStory) => story.trimmed || trimmed.has(story.key),
    [trimmed],
  )

  const toggleTrim = useCallback((key: string) => {
    setTrimmed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const decide = useCallback((key: string, decision: Decision | null) => {
    setDecisions((prev) => {
      const next = { ...prev }
      if (decision) next[key] = decision
      else delete next[key]
      return next
    })
  }, [])

  // Live summary. The server's counts describe the plan it was handed; trims and
  // decisions made since then are local, so the bar recomputes rather than
  // round-tripping on every checkbox.
  const summary = useMemo(() => {
    if (!plan) return null
    let stories = 0, mentions = 0, ghosts = 0, matched = 0, pending = 0, refused = 0, skipped = 0
    for (const story of plan.stories) {
      if (isTrimmed(story)) continue
      stories++
      for (const subject of story.subjects) {
        if (subject.outcome === "skipped") continue
        if (subject.outcome === "refused") { refused++; continue }
        if (subject.outcome === "already_mapped") { skipped++; continue }
        if (subject.outcome === "review" || subject.outcome === "ambiguous") {
          const decision = decisions[subject.key]
          if (!decision) { pending++; continue }
          // A decided row will import: as a match, or as a node it now creates.
          mentions++
          if (decision.confirm_new) ghosts++
          else matched++
          continue
        }
        mentions++
        if (subject.creates_node) ghosts++
        if (subject.outcome === "matched_existing") matched++
      }
    }
    return { stories, mentions, ghosts, matched, pending, refused, skipped }
  }, [plan, decisions, isTrimmed])

  const videoId = plan?.episode.media_url ? parseYouTubeId(plan.episode.media_url) : null
  const liveStories = plan?.stories.filter((s) => !s.trimmed) ?? []
  const parkedStories = plan?.stories.filter((s) => s.trimmed) ?? []

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-4xl mx-auto px-4 py-8 pb-32">

        {/* ── header ── */}
        <div className="mb-6">
          <Link href="/admin" className="text-xs text-muted hover:text-foreground transition-colors">
            &larr; Dataset Editor
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-2">Podcast mention import</h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            Resolves a mention seed against the live catalog, so you can see what would be
            created before anything is written. Import lands every mention as a draft:
            editor-only until you publish it from the episode page.
          </p>
        </div>

        {/* ── step 1: paste ── */}
        <section className="mb-6">
          <label htmlFor="seed" className="block text-xs font-semibold text-muted uppercase tracking-widest mb-2">
            1. Seed JSON
          </label>

          {/*
            The first thing anyone tries here is pasting a transcript, because that is
            what they have in hand. Say what this box wants BEFORE the box, not in a
            footnote under it.
          */}
          <div className="mb-3 p-3 rounded-lg border border-border-default bg-surface-2">
            <p className="text-sm text-foreground">
              This takes a <b>mention seed</b>, not a transcript.
            </p>
            <p className="text-sm text-muted mt-1">
              Give your transcript to Claude (anywhere: this repo, claude.ai, your phone) with
              the show and episode number, and ask it to index the episode. The{" "}
              <code className="px-1 py-0.5 rounded bg-surface border border-border-default text-xs">podcast-mentions</code>{" "}
              skill reads the transcript, writes the stories with their casts, and hands back
              the JSON that goes in this box. Extraction stays with Claude on your plan; this
              page does the catalog half.
            </p>
          </div>
          <textarea
            id="seed"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            rows={text ? 8 : 12}
            className="w-full font-mono text-xs leading-relaxed p-3 rounded-lg bg-surface border border-border-default text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <div className="flex items-center flex-wrap gap-3 mt-3">
            <button
              onClick={onResolve}
              disabled={!text.trim() || busy !== null}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-default transition-colors"
            >
              {busy === "resolve" ? "Resolving..." : "Resolve"}
            </button>
            <p className="text-xs text-muted">
              Seed format: <code className="px-1 py-0.5 rounded bg-surface border border-border-default">podcast-seeds/README.md</code>
            </p>
          </div>
          {parseError === "TRANSCRIPT" ? (
            <div className="mt-3 p-3 rounded-lg border border-red-500/40 bg-red-500/10">
              <p className="text-sm text-foreground font-semibold">That looks like a transcript, not a seed</p>
              <p className="text-sm text-muted mt-1">
                A seed starts with <code className="px-1 py-0.5 rounded bg-surface border border-border-default text-xs">{"{"}</code> and
                names the episode. Hand the transcript to Claude first: ask it to index the
                episode, give it the show name and episode number, and paste back what it
                returns. Nothing was sent anywhere.
              </p>
            </div>
          ) : parseError ? (
            <p className="mt-3 text-sm text-red-500 font-mono">
              Could not parse JSON: {parseError}
            </p>
          ) : null}
          {serverError && (
            <p className="mt-3 text-sm text-red-500">{serverError}</p>
          )}
        </section>

        {/* ── imported ── */}
        {imported && (
          <section className="mb-6 p-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10">
            <h2 className="text-sm font-semibold text-foreground">Imported</h2>
            <p className="text-sm text-muted mt-1">
              {imported.counts.mentions} draft {imported.counts.mentions === 1 ? "mention" : "mentions"} added
              {imported.counts.ghosts > 0 && `, ${imported.counts.ghosts} new ${imported.counts.ghosts === 1 ? "node" : "nodes"} created`}
              {imported.counts.skipped > 0 && `, ${imported.counts.skipped} already there`}
              {imported.counts.refused > 0 && `, ${imported.counts.refused} refused`}.
              Nothing is public yet.
            </p>
            <Link
              href={`/events/${imported.episode.id}`}
              className="inline-block mt-3 px-3 py-2 rounded-lg bg-surface border border-border-default text-sm text-foreground hover:bg-surface-hover transition-colors"
            >
              Open {imported.episode.name} to publish &rarr;
            </Link>
          </section>
        )}

        {/* ── step 2: review ── */}
        {plan && summary && (
          <section>
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">
                2. Review
              </h2>
              <p className="text-xs text-muted">
                {plan.episode.name}
                {plan.episode.episode_number !== null && ` (#${plan.episode.episode_number})`}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border-default border border-border-default rounded-lg overflow-hidden mb-4">
              <Tile value={summary.stories} label="stories" />
              <Tile value={summary.mentions} label="draft mentions" />
              <Tile value={summary.ghosts} label="new nodes" accent={summary.ghosts > 0} />
              <Tile value={summary.matched} label="matched in catalog" />
            </div>

            {summary.pending > 0 && (
              <p className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm text-foreground">
                <b>{summary.pending}</b> {summary.pending === 1 ? "name needs" : "names need"} a decision.
                Each one looks like something already in the catalog. Pick the existing entity, or
                confirm it really is new. Import is disabled until they are all decided.
              </p>
            )}

            {plan.refusals.length > 0 && (
              <div className="mb-4 p-3 rounded-lg border border-red-500/40 bg-red-500/10">
                <p className="text-sm text-foreground font-semibold">
                  {plan.refusals.length} {plan.refusals.length === 1 ? "row is" : "rows are"} refused and will be skipped
                </p>
                <ul className="mt-2 space-y-1">
                  {plan.refusals.map((r, i) => (
                    <li key={i} className="text-xs text-muted">
                      <span className="text-foreground">{r.where}</span> &mdash; {r.why}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">
                  Fix them in the seed and paste again, or import without them.
                </p>
              </div>
            )}

            <p className="text-xs text-muted mb-3">
              A dashed chip is an entity Linestry does not have yet and would create. A ringed chip
              needs a decision. Plain chips already exist. Tick a story to trim it and its whole cast.
            </p>

            <ul className="space-y-2">
              {liveStories.map((story) => (
                <StoryCard
                  key={story.key}
                  story={story}
                  videoId={videoId}
                  trimmed={trimmed.has(story.key)}
                  onToggleTrim={() => toggleTrim(story.key)}
                  decisions={decisions}
                  onDecide={decide}
                />
              ))}
            </ul>

            {parkedStories.length > 0 && (
              <details className="mt-6">
                <summary className="cursor-pointer text-xs font-semibold text-muted uppercase tracking-widest">
                  Parked in the seed, not imported &middot; {parkedStories.length}
                </summary>
                <p className="text-xs text-muted mt-2 mb-3">
                  Trimmed when the seed was written, but kept with their timecode and quote so this
                  episode never needs transcribing again.
                </p>
                <ul className="space-y-2">
                  {parkedStories.map((story) => (
                    <StoryCard
                      key={story.key}
                      story={story}
                      videoId={videoId}
                      trimmed
                      parked
                      onToggleTrim={() => {}}
                      decisions={decisions}
                      onDecide={decide}
                    />
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
      </div>

      {/* ── step 3: import ── */}
      {plan && summary && (
        <div className="sticky bottom-0 border-t border-border-default bg-background/95 backdrop-blur">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted flex-1 min-w-[200px]">
              {summary.pending > 0 ? (
                <>
                  <b className="text-foreground">{summary.pending}</b>{" "}
                  {summary.pending === 1 ? "name still needs" : "names still need"} a decision above.
                </>
              ) : (
                <>
                  <b className="text-foreground">{summary.stories}</b> stories,{" "}
                  <b className="text-foreground">{summary.mentions}</b> draft mentions,{" "}
                  <b className="text-foreground">{summary.ghosts}</b> new nodes
                  {summary.skipped > 0 && `, ${summary.skipped} already imported`}.
                </>
              )}
            </p>
            <button
              onClick={onReresolve}
              disabled={busy !== null}
              className="px-3 py-2 rounded-lg bg-surface border border-border-default text-sm text-foreground hover:bg-surface-hover disabled:opacity-40 transition-colors"
            >
              {busy === "resolve" ? "Re-resolving..." : "Re-resolve"}
            </button>
            <button
              onClick={onImport}
              disabled={busy !== null || summary.pending > 0 || summary.mentions === 0}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-default transition-colors"
            >
              {busy === "import" ? "Importing..." : `Import ${summary.mentions} drafts`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Tile({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className={cn("text-2xl font-bold tabular-nums", accent ? "text-blue-500" : "text-foreground")}>
        {value}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function StoryCard({
  story, videoId, trimmed, parked, onToggleTrim, decisions, onDecide,
}: {
  story: PlanStory
  videoId: string | null
  trimmed: boolean
  parked?: boolean
  onToggleTrim: () => void
  decisions: Record<string, Decision>
  onDecide: (key: string, decision: Decision | null) => void
}) {
  return (
    <li
      className={cn(
        "rounded-lg border border-border-default bg-surface p-4 transition-opacity",
        (trimmed || parked) && "opacity-50",
      )}
    >
      <div className="flex items-start gap-3">
        {!parked && (
          <input
            type="checkbox"
            checked={trimmed}
            onChange={onToggleTrim}
            aria-label={`Trim "${story.title ?? "this story"}"`}
            className="mt-1 h-4 w-4 shrink-0 accent-blue-600 cursor-pointer"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            {story.timestamp_seconds !== null && videoId ? (
              <a
                href={`https://www.youtube.com/watch?v=${videoId}&t=${story.timestamp_seconds}s`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-blue-500 hover:underline tabular-nums shrink-0"
              >
                {formatTimestamp(story.timestamp_seconds)}
              </a>
            ) : (
              <span className="font-mono text-xs text-muted tabular-nums shrink-0">
                {story.timestamp ?? "--"}
              </span>
            )}
            <h3 className={cn("text-sm font-semibold text-foreground", trimmed && "line-through")}>
              {story.title ?? "Untitled"}
            </h3>
          </div>

          {story.excerpt && (
            <p className="mt-2 text-sm text-muted leading-relaxed">&ldquo;{story.excerpt}&rdquo;</p>
          )}

          {parked && story.skip_reason && (
            <p className="mt-2 text-xs text-muted">
              Parked under {story.activity ?? "unfiled"}: {story.skip_reason}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {story.subjects.map((subject) => (
              <SubjectChip key={subject.key} subject={subject} decision={decisions[subject.key]} />
            ))}
          </div>

          {!trimmed && !parked && story.subjects.map((subject) =>
            subject.outcome === "review" || subject.outcome === "ambiguous" ? (
              <DecisionRow
                key={subject.key}
                subject={subject}
                decision={decisions[subject.key]}
                onDecide={onDecide}
              />
            ) : null,
          )}
        </div>
      </div>
    </li>
  )
}

function SubjectChip({ subject, decision }: { subject: PlanSubject; decision?: Decision }) {
  const needsDecision =
    (subject.outcome === "review" || subject.outcome === "ambiguous") && !decision
  const createsNode = subject.outcome === "new_ghost" || decision?.confirm_new === true

  let note = ""
  if (subject.outcome === "refused") note = "refused"
  else if (subject.outcome === "already_mapped") note = "already imported"
  else if (subject.outcome === "skipped") note = "trimmed"
  else if (needsDecision) note = "needs a decision"
  else if (createsNode) note = "new"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold",
        subject.outcome === "refused"
          ? "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/40"
          : TYPE_CHIP[subject.subject_type] ?? "text-muted bg-surface-2 border-border-default",
        createsNode && "border-dashed",
        needsDecision && "ring-1 ring-current",
        (subject.outcome === "skipped" || subject.outcome === "already_mapped") && "opacity-60",
      )}
      title={subject.refusal ?? subject.matched_label ?? subject.ghost_summary ?? undefined}
    >
      {subject.subject_name || "(no name)"}
      <em className="not-italic font-medium opacity-70 text-[10px] uppercase tracking-wide">
        {TYPE_LABEL[subject.subject_type] ?? subject.subject_type}
        {note && ` · ${note}`}
      </em>
    </span>
  )
}

/**
 * A near miss, held open until someone decides. This is the guard that stopped
 * five duplicate places on the first real import: the transcript says "Mount
 * Baker" and the catalog holds "Mt. Baker Ski Area". It refuses rather than
 * warns, because a wrong new node is permanent and other people start linking
 * to it.
 */
function DecisionRow({
  subject, decision, onDecide,
}: {
  subject: PlanSubject
  decision?: Decision
  onDecide: (key: string, decision: Decision | null) => void
}) {
  return (
    <div className="mt-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/5">
      <p className="text-xs text-foreground">
        <b>{subject.subject_name}</b>{" "}
        {subject.outcome === "ambiguous"
          ? "matches more than one entity. Pick the right one."
          : "is not in the catalog, but these look like the same thing."}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {subject.candidates.map((candidate) => (
          <button
            key={candidate.id}
            onClick={() =>
              onDecide(
                subject.key,
                decision?.subject_id === candidate.id ? null : { subject_id: candidate.id },
              )
            }
            className={cn(
              "px-2 py-1 rounded-md border text-xs transition-colors",
              decision?.subject_id === candidate.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-surface border-border-default text-foreground hover:bg-surface-hover",
            )}
          >
            {candidate.label}
          </button>
        ))}
        <button
          onClick={() => onDecide(subject.key, decision?.confirm_new ? null : { confirm_new: true })}
          className={cn(
            "px-2 py-1 rounded-md border border-dashed text-xs transition-colors",
            decision?.confirm_new
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-surface border-border-default text-foreground hover:bg-surface-hover",
          )}
        >
          Create it anyway
        </button>
      </div>
    </div>
  )
}
