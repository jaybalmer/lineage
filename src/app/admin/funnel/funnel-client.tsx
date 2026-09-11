"use client"

// Activation, retention, and funnel scoreboard (brief T6). One moderator-gated
// read of /api/admin/funnel, rendered as: a KPI row, an eight-step
// acquisition-to-activation funnel, a two-series daily time series, a weekly
// cohort retention table, and a content-contribution count. No chart library
// (D9): hand-built HTML/CSS and one inline-SVG line chart.

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Nav } from "@/components/ui/nav"
import { cn } from "@/lib/utils"

interface FunnelSteps {
  landed: number
  aha: number
  save_shown: number
  signed_up: number
  onboarded: number
  posted_story: number
  returned: number
  activated: number
}
interface DailyRow { day: string; signups: number; activations: number }
interface ContentCounts {
  stories: number; claims: number; riding_days: number
  comments: number; reactions: number; connections: number
}
interface CohortRow { cohort_week: string; size: number; w1: number; w2: number; w3: number }
interface FunnelData {
  window_days: number
  since: string
  until: string
  steps: Partial<FunnelSteps>
  daily: DailyRow[]
  content: Partial<ContentCounts>
  cohorts: CohortRow[]
  excluded_count: number
  instrumentation_start: string
}

const WINDOWS = [7, 30, 90] as const

// Funnel step order and labels. Steps 1-3 count anonymous browsers by
// distinct_id; steps 4-8 count members by actor_id (the identity-space seam).
const STEP_DEFS: { key: keyof FunnelSteps; label: string; space: "browser" | "member" }[] = [
  { key: "landed",       label: "Landed on onboarding", space: "browser" },
  { key: "aha",          label: "Reached the aha step", space: "browser" },
  { key: "save_shown",   label: "Reached save",         space: "browser" },
  { key: "signed_up",    label: "Signed up",            space: "member" },
  { key: "onboarded",    label: "Finished onboarding",  space: "member" },
  { key: "posted_story", label: "Posted a story",       space: "member" },
  { key: "returned",     label: "Returned a later day", space: "member" },
  { key: "activated",    label: "Activated",            space: "member" },
]

function pct(n: number, d: number): string {
  if (!d) return "—"
  return `${Math.round((n / d) * 100)}%`
}

function fmtDate(iso: string): string {
  // "2026-08-31" -> "31 Aug"
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""))
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
}

export function FunnelClient() {
  const [windowDays, setWindowDays] = useState<number>(30)
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Read the window from the URL on mount so a chosen window survives reload.
  useEffect(() => {
    try {
      const d = parseInt(new URLSearchParams(window.location.search).get("days") ?? "", 10)
      if ((WINDOWS as readonly number[]).includes(d)) setWindowDays(d)
    } catch { /* no window */ }
  }, [])

  const refresh = useCallback(async (days: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/funnel?days=${days}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load")
      setData(json as FunnelData)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh(windowDays) }, [windowDays, refresh])

  const chooseWindow = (d: number) => {
    setWindowDays(d)
    try {
      const url = new URL(window.location.href)
      url.searchParams.set("days", String(d))
      window.history.replaceState(null, "", url.toString())
    } catch { /* no window */ }
  }

  const steps = data?.steps ?? {}
  const stepVals = STEP_DEFS.map((s) => ({ ...s, value: steps[s.key] ?? 0 }))
  const top = stepVals[0]?.value ?? 0

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Chart color roles, defined once so light/dark swap in one place. */}
      <style>{`
        .fnl {
          --fnl-bar: #3B82F6;
          --fnl-s1: #2a78d6;
          --fnl-s2: #eb6834;
          --fnl-grid: rgba(0,0,0,0.08);
        }
        :root:not([data-theme="light"]) .fnl {
          --fnl-s1: #3987e5;
          --fnl-s2: #d95926;
          --fnl-grid: rgba(255,255,255,0.10);
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .fnl {
            --fnl-s1: #3987e5;
            --fnl-s2: #d95926;
            --fnl-grid: rgba(255,255,255,0.10);
          }
        }
        :root[data-theme="dark"] .fnl {
          --fnl-s1: #3987e5;
          --fnl-s2: #d95926;
          --fnl-grid: rgba(255,255,255,0.10);
        }
      `}</style>
      <Nav />
      <div className="fnl max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-widest">Diagnostics</span>
              <span className="text-xs px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-400 rounded-full">Editors only</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Funnel</h1>
            <p className="text-sm text-muted mt-1">
              {data
                ? `Last ${data.window_days} days. ${data.excluded_count} internal account${data.excluded_count === 1 ? "" : "s"} and all bot-flagged traffic are excluded.`
                : "Acquisition to activation, unique people per step."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="shrink-0 px-3 py-2 rounded-lg bg-surface border border-border-default text-xs text-foreground hover:bg-surface-hover transition-colors"
            >
              ← Admin
            </Link>
            <button
              onClick={() => refresh(windowDays)}
              className="shrink-0 px-3 py-2 rounded-lg bg-surface border border-border-default text-xs text-foreground hover:bg-surface-hover transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Window buttons */}
        <div className="flex items-center gap-1.5 mb-6">
          {WINDOWS.map((d) => (
            <button
              key={d}
              onClick={() => chooseWindow(d)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors tabular-nums",
                windowDays === d
                  ? "bg-[#1C1917]/15 border-[#1C1917]/30 text-foreground"
                  : "border-border-default text-muted hover:text-foreground hover:border-blue-500/40",
              )}
            >
              {d} days
            </button>
          ))}
          {loading && <span className="text-xs text-muted ml-2">Loading…</span>}
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-700/40 text-sm text-red-400">
            {error}
          </div>
        )}

        {data && (
          <>
            <KpiRow steps={stepVals} />
            <FunnelBars steps={stepVals} top={top} />
            <DailySeries daily={data.daily} />
            <CohortTable cohorts={data.cohorts} instrumentationStart={data.instrumentation_start} />
            <ContentTable content={data.content} />
          </>
        )}
      </div>
    </div>
  )
}

// ── KPI row ───────────────────────────────────────────────────────────────────
function KpiRow({ steps }: { steps: { key: string; value: number }[] }) {
  const by = (k: string) => steps.find((s) => s.key === k)?.value ?? 0
  const arrived = by("landed")
  const signedUp = by("signed_up")
  const activated = by("activated")
  const returned = by("returned")
  const tiles = [
    { label: "Arrived",   value: arrived,   sub: null },
    { label: "Signed up", value: signedUp,  sub: arrived ? `${pct(signedUp, arrived)} of arrived` : null },
    { label: "Activated", value: activated, sub: signedUp ? `${pct(activated, signedUp)} of signed up` : null },
    { label: "Returned",  value: returned,  sub: signedUp ? `${pct(returned, signedUp)} of signed up` : null },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-border-default bg-surface px-4 py-4">
          <div className="text-3xl font-bold tabular-nums text-foreground">{t.value}</div>
          <div className="text-sm text-muted mt-0.5">{t.label}</div>
          <div className="text-xs text-muted/70 mt-1 h-4">{t.sub ?? ""}</div>
        </div>
      ))}
    </div>
  )
}

// ── Funnel bars ─────────────────────────────────────────────────────────────
function FunnelBars({
  steps,
  top,
}: {
  steps: { key: string; label: string; value: number; space: "browser" | "member" }[]
  top: number
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-foreground mb-3">Acquisition to activation</h2>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const widthPct = top > 0 ? (s.value / top) * 100 : 0
          const prev = i === 0 ? null : steps[i - 1].value
          const stepPct = prev === null ? null : pct(s.value, prev)
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-xs text-muted text-right">{s.label}</div>
              <div className="flex-1 min-w-0 h-7 rounded bg-surface-2 relative overflow-hidden">
                <div
                  className="h-full rounded-r"
                  style={{ width: `${widthPct}%`, background: "var(--fnl-bar)", minWidth: s.value > 0 ? 2 : 0 }}
                />
              </div>
              <div className="w-28 shrink-0 text-xs text-foreground text-right tabular-nums">
                {s.value}
                {stepPct !== null && <span className="text-muted"> · {stepPct}</span>}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted/70 italic mt-3">
        Steps 1 to 3 count anonymous browsers by distinct_id; steps 4 to 8 count members by
        actor_id. Each percentage is of the step directly above it, and the step 3 to step 4
        conversion crosses two identity spaces, so it is approximate.
      </p>
    </section>
  )
}

// ── Daily two-series line chart ───────────────────────────────────────────────
function DailySeries({ daily }: { daily: DailyRow[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720, H = 200, padL = 28, padR = 16, padT = 12, padB = 22
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const maxY = useMemo(
    () => Math.max(1, ...daily.map((d) => Math.max(d.signups, d.activations))),
    [daily],
  )
  const n = daily.length
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => padT + innerH - (v / maxY) * innerH
  const line = (key: "signups" | "activations") =>
    daily.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ")

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-foreground">Signups and activations per day</h2>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full" style={{ background: "var(--fnl-s1)" }} /> Signups
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full" style={{ background: "var(--fnl-s2)" }} /> Activations
          </span>
        </div>
      </div>

      {n === 0 ? (
        <div className="rounded-xl border border-border-default bg-surface px-4 py-10 text-center text-sm text-muted">
          No events in this window.
        </div>
      ) : (
        <div className="rounded-xl border border-border-default bg-surface p-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ minWidth: 320 }}
            role="img"
            aria-label="Daily signups and activations"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
              const px = ((e.clientX - rect.left) / rect.width) * W
              const idx = n <= 1 ? 0 : Math.round(((px - padL) / innerW) * (n - 1))
              setHover(Math.max(0, Math.min(n - 1, idx)))
            }}
          >
            {/* recessive gridlines (0, mid, max) */}
            {[0, 0.5, 1].map((f) => (
              <line
                key={f}
                x1={padL} x2={W - padR}
                y1={padT + innerH - f * innerH} y2={padT + innerH - f * innerH}
                stroke="var(--fnl-grid)" strokeWidth={1}
              />
            ))}
            {/* y labels: 0 and max */}
            <text x={padL - 6} y={padT + innerH} textAnchor="end" dominantBaseline="middle" className="fill-current text-muted" fontSize={9}>0</text>
            <text x={padL - 6} y={padT} textAnchor="end" dominantBaseline="middle" className="fill-current text-muted" fontSize={9}>{maxY}</text>

            <path d={line("signups")} fill="none" stroke="var(--fnl-s1)" strokeWidth={2} />
            <path d={line("activations")} fill="none" stroke="var(--fnl-s2)" strokeWidth={2} />

            {/* end labels */}
            {n > 0 && (
              <>
                <text x={x(n - 1) + 3} y={y(daily[n - 1].signups)} dominantBaseline="middle" fill="var(--fnl-s1)" fontSize={9} fontWeight={700}>{daily[n - 1].signups}</text>
                <text x={x(n - 1) + 3} y={y(daily[n - 1].activations)} dominantBaseline="middle" fill="var(--fnl-s2)" fontSize={9} fontWeight={700}>{daily[n - 1].activations}</text>
              </>
            )}

            {/* crosshair + points on hover */}
            {hover !== null && daily[hover] && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke="var(--fnl-grid)" strokeWidth={1} />
                <circle cx={x(hover)} cy={y(daily[hover].signups)} r={3} fill="var(--fnl-s1)" />
                <circle cx={x(hover)} cy={y(daily[hover].activations)} r={3} fill="var(--fnl-s2)" />
              </>
            )}
          </svg>
          <div className="text-xs text-muted mt-1 h-4 tabular-nums">
            {hover !== null && daily[hover]
              ? `${fmtDate(daily[hover].day)} · ${daily[hover].signups} signups · ${daily[hover].activations} activations`
              : ""}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Cohort retention table ────────────────────────────────────────────────────
function CohortTable({
  cohorts,
  instrumentationStart,
}: {
  cohorts: CohortRow[]
  instrumentationStart: string
}) {
  const cell = (count: number, size: number) => {
    const p = size > 0 ? count / size : 0
    // Sequential accent tint keyed to the percentage; the number stays as text so
    // it is legible at every tint step (tint is a secondary encoding only).
    const alpha = size > 0 ? 0.08 + p * 0.42 : 0
    return (
      <td className="px-3 py-2 text-right tabular-nums" style={{ background: `rgba(59,130,246,${alpha.toFixed(3)})` }}>
        {size > 0 ? (
          <span className="text-foreground">{count} <span className="text-muted">· {pct(count, size)}</span></span>
        ) : (
          <span className="text-muted/50">—</span>
        )}
      </td>
    )
  }
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-foreground mb-1">Weekly cohort retention</h2>
      <p className="text-xs text-muted/70 mb-3">
        Of the members who signed up in each week, how many returned on a later day in W+1, W+2, W+3.
        Built from durable state, so it reaches back before instrumentation began ({fmtDate(instrumentationStart)} 2026).
      </p>
      {cohorts.length === 0 ? (
        <div className="rounded-xl border border-border-default bg-surface px-4 py-8 text-center text-sm text-muted">
          No cohorts yet.
        </div>
      ) : (
        <div className="border border-border-default rounded-xl overflow-x-auto">
          <table className="w-full text-xs min-w-[420px]">
            <thead>
              <tr className="text-muted border-b border-border-default">
                <th className="px-3 py-2 text-left font-semibold">Cohort week</th>
                <th className="px-3 py-2 text-right font-semibold">Size</th>
                <th className="px-3 py-2 text-right font-semibold">W+1</th>
                <th className="px-3 py-2 text-right font-semibold">W+2</th>
                <th className="px-3 py-2 text-right font-semibold">W+3</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.cohort_week} className="border-b border-border-default last:border-0">
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(c.cohort_week)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">{c.size}</td>
                  {cell(c.w1, c.size)}
                  {cell(c.w2, c.size)}
                  {cell(c.w3, c.size)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── Content contributions ─────────────────────────────────────────────────────
function ContentTable({ content }: { content: Partial<ContentCounts> }) {
  const rows: { label: string; key: keyof ContentCounts }[] = [
    { label: "Stories", key: "stories" },
    { label: "Claims", key: "claims" },
    { label: "Riding days", key: "riding_days" },
    { label: "Comments", key: "comments" },
    { label: "Reactions", key: "reactions" },
    { label: "Connections", key: "connections" },
  ]
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-foreground mb-3">Content contributions</h2>
      <div className="border border-border-default rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className={cn("border-border-default", i < rows.length - 1 && "border-b")}>
                <td className="px-4 py-2 text-muted">{r.label}</td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{content[r.key] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
