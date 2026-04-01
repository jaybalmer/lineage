"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import type { ExtractedRow } from "@/app/api/admin/scan-results/route"

// ── Types ──────────────────────────────────────────────────────────────────

type Step = "input" | "review" | "done"

interface ReviewEntry extends ExtractedRow {
  /** Final resolved person_id (matched or newly assigned) */
  resolved_person_id?: string
  /** Editable name (may differ from parsed name) */
  edited_name: string
  /** Whether this row is included in the import */
  included: boolean
  /** Whether user overrode the auto-match */
  overridden?: boolean
}

interface DoneResult {
  created: number
  matched: number
  claims: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const EDITOR_PASSWORD = "outland"

const MATCH_BADGE: Record<string, { label: string; cls: string }> = {
  exact: { label: "Matched", cls: "bg-green-900/40 text-green-400 border border-green-700/40" },
  fuzzy: { label: "Suggested", cls: "bg-amber-900/40 text-amber-400 border border-amber-700/40" },
  none:  { label: "New", cls: "bg-blue-900/40 text-blue-400 border border-blue-700/40" },
  skip:  { label: "Skip", cls: "bg-zinc-800 text-zinc-500 border border-zinc-700" },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Summary({ rows }: { rows: ReviewEntry[] }) {
  const included = rows.filter((r) => r.included)
  const exact = included.filter((r) => !r.overridden && r.match.type === "exact").length
  const fuzzy = included.filter((r) => !r.overridden && r.match.type === "fuzzy").length
  const newPeople = included.filter(
    (r) => (r.overridden ? !r.resolved_person_id : r.match.type === "none")
  ).length
  const skipped = rows.filter((r) => !r.included).length

  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <span className="px-2.5 py-1 rounded-full bg-green-900/40 text-green-400 border border-green-700/40">
        {exact} exact match{exact !== 1 ? "es" : ""}
      </span>
      <span className="px-2.5 py-1 rounded-full bg-amber-900/40 text-amber-400 border border-amber-700/40">
        {fuzzy} suggested
      </span>
      <span className="px-2.5 py-1 rounded-full bg-blue-900/40 text-blue-400 border border-blue-700/40">
        {newPeople} new
      </span>
      {skipped > 0 && (
        <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
          {skipped} skipped
        </span>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ResultsScannerPage() {
  const router = useRouter()
  const { catalog, membership, authReady, activePersonId, activeCommunitySlug } = useLineageStore()

  // Auth gate
  const [pwInput, setPwInput] = useState("")
  const [pwError, setPwError] = useState(false)
  const [sessionUnlocked, setSessionUnlocked] = useState(false)

  const isEditor = membership.is_editor || sessionUnlocked
  const showGate = authReady && !isEditor

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pwInput === EDITOR_PASSWORD) {
      setSessionUnlocked(true)
      setPwError(false)
    } else {
      setPwError(true)
      setPwInput("")
    }
  }

  // ── Step state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("input")

  // Input step
  const [inputText, setInputText] = useState("")
  const [selectedEventId, setSelectedEventId] = useState("")
  const [createClaims, setCreateClaims] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  // Review step
  const [rows, setRows] = useState<ReviewEntry[]>([])
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [overrideSearchIdx, setOverrideSearchIdx] = useState<number | null>(null)
  const [overrideQuery, setOverrideQuery] = useState("")

  // Done step
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState("")
  const [doneResult, setDoneResult] = useState<DoneResult | null>(null)

  // ── File upload handling ──────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setInputText(text)
    }
    reader.readAsText(file)
  }, [])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // ── Parse ─────────────────────────────────────────────────────────────────
  async function handleParse() {
    if (!inputText.trim()) {
      setParseError("Paste or upload some text first.")
      return
    }
    setParsing(true)
    setParseError("")
    try {
      const res = await fetch("/api/admin/scan-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, event_id: selectedEventId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Parse failed")

      const extracted: ExtractedRow[] = data.rows
      if (extracted.length === 0) {
        setParseError("No names found. Try a different format or paste more text.")
        return
      }

      setRows(
        extracted.map((r) => ({
          ...r,
          edited_name: r.name,
          included: true,
          resolved_person_id: r.match.person?.id,
        }))
      )
      setStep("review")
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setParsing(false)
    }
  }

  // ── Row editing ───────────────────────────────────────────────────────────
  function toggleRow(idx: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, included: !r.included } : r)))
  }

  function updateName(idx: number, name: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, edited_name: name } : r)))
  }

  function overrideMatch(idx: number, person: { id: string; display_name: string } | null) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              overridden: true,
              resolved_person_id: person?.id,
              edited_name: person?.display_name ?? r.edited_name,
            }
          : r
      )
    )
    setOverrideSearchIdx(null)
    setOverrideQuery("")
  }

  function clearOverride(idx: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, overridden: false, resolved_person_id: r.match.person?.id }
          : r
      )
    )
  }

  // Catalog people for override search
  const catalogPeople = catalog.people ?? []
  const overrideResults =
    overrideQuery.length >= 2
      ? catalogPeople
          .filter((p) =>
            p.display_name.toLowerCase().includes(overrideQuery.toLowerCase())
          )
          .slice(0, 8)
      : []

  // ── Confirm ───────────────────────────────────────────────────────────────
  async function handleConfirm() {
    setConfirming(true)
    setConfirmError("")

    const entries = rows
      .filter((r) => r.included)
      .map((r) => ({
        name: r.edited_name,
        person_id: r.resolved_person_id,
        placement: r.placement,
        division: r.division,
        skip: false,
      }))

    try {
      const res = await fetch("/api/admin/scan-results/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries,
          event_id: selectedEventId || undefined,
          create_claims: createClaims && Boolean(selectedEventId),
          added_by: activePersonId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Confirm failed")
      setDoneResult(data)
      setStep("done")
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setConfirming(false)
    }
  }

  // ── Password gate ─────────────────────────────────────────────────────────
  if (showGate) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Nav />
        <div className="flex items-center justify-center min-h-[calc(100vh-6rem)]">
          <div className="w-full max-w-sm mx-auto px-6">
            <div className="text-center mb-6">
              <div className="text-2xl mb-2">🔒</div>
              <h1 className="text-sm font-semibold text-foreground">Editor access required</h1>
              <p className="text-xs text-muted mt-1">Enter the editor password to continue</p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <input
                type="password"
                value={pwInput}
                onChange={(e) => { setPwInput(e.target.value); setPwError(false) }}
                placeholder="Password"
                autoFocus
                className="w-full bg-surface border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              />
              {pwError && <p className="text-xs text-red-400">Incorrect password</p>}
              <button
                type="submit"
                className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              >
                Unlock
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === "done" && doneResult) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Nav />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-2">Import complete</h1>
          <p className="text-muted text-sm mb-8">
            Results processed and added to the Lineage database.
          </p>
          <div className="flex justify-center gap-6 mb-10">
            <Stat n={doneResult.matched} label="existing people linked" color="green" />
            <Stat n={doneResult.created} label="new people created" color="blue" />
            {doneResult.claims > 0 && (
              <Stat n={doneResult.claims} label="competed_at claims added" color="amber" />
            )}
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => { setStep("input"); setInputText(""); setRows([]); setDoneResult(null) }}
              className="px-5 py-2.5 rounded-lg bg-surface border border-border-default text-sm text-foreground hover:bg-surface-hover transition-colors"
            >
              Scan another document
            </button>
            {selectedEventId && (
              <button
                onClick={() => router.push(`/${activeCommunitySlug}/events/${selectedEventId}`)}
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              >
                View event
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const includedCount = rows.filter((r) => r.included).length
  const newCount = rows.filter(
    (r) => r.included && (r.overridden ? !r.resolved_person_id : r.match.type === "none")
  ).length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => router.push("/admin")}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              ← Data Editor
            </button>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-widest">Admin Tool</span>
            <span className="text-xs px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-400 rounded-full">
              Trusted contributors only
            </span>
          </div>
          <h1 className="text-2xl font-bold">Results Scanner</h1>
          <p className="text-sm text-muted mt-1">
            Paste or upload an event results list to bulk-import riders and wire up competed_at claims.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {(["input", "review"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-border-default" />}
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium",
                  step === s ? "text-blue-400" : step === "done" || (s === "input" && step === "review") ? "text-muted" : "text-muted/40"
                )}
              >
                <span
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    step === s
                      ? "bg-blue-600 text-white"
                      : (s === "input" && step !== "input") || step === "done"
                      ? "bg-green-700 text-white"
                      : "bg-surface border border-border-default text-muted"
                  )}
                >
                  {(s === "input" && step !== "input") || step === "done" ? "✓" : i + 1}
                </span>
                {s === "input" ? "Input" : "Review"}
              </div>
            </div>
          ))}
        </div>

        {/* ── Step 1: Input ──────────────────────────────────────────────── */}
        {step === "input" && (
          <div className="space-y-6">
            {/* Event picker */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-widest mb-2">
                Event (optional)
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full max-w-sm bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
              >
                <option value="">— No event selected —</option>
                {[...catalog.events]
                  .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
                  .map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}{ev.year ? ` (${ev.year})` : ""}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-muted mt-1.5">
                When set, competed_at claims will be created linking riders to this event.
              </p>
            </div>

            {/* Create claims toggle */}
            {selectedEventId && (
              <label className="flex items-center gap-2.5 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={createClaims}
                  onChange={(e) => setCreateClaims(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <span className="text-sm text-foreground">
                  Create <code className="text-xs bg-surface px-1 py-0.5 rounded">competed_at</code> claims for each rider
                </span>
              </label>
            )}

            {/* Text input */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-widest mb-2">
                Results document
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Paste results here. Supported formats:\n\n1. Kelly Clark\n2. Torah Bright\n3. Gretchen Bleiler\n\nor CSV:\nplace,name,country\n1,Shaun White,USA\n2,Iouri Podladtchikov,SUI`}
                rows={14}
                className="w-full bg-surface border border-border-default rounded-lg px-4 py-3 text-sm text-foreground font-mono placeholder-zinc-600 focus:outline-none focus:border-blue-500 resize-y"
              />
            </div>

            {/* File upload */}
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-border-default rounded-lg px-6 py-4 flex items-center justify-between hover:border-blue-500/50 transition-colors"
            >
              <div className="text-sm text-muted">
                Drop a <strong>.txt</strong> or <strong>.csv</strong> file here
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-surface border border-border-default text-xs text-foreground hover:bg-surface-hover transition-colors"
              >
                Choose file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                onChange={onFileChange}
                className="hidden"
              />
            </div>

            {parseError && (
              <p className="text-sm text-red-400">{parseError}</p>
            )}

            <button
              onClick={handleParse}
              disabled={parsing || !inputText.trim()}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {parsing ? "Parsing…" : "Parse document →"}
            </button>
          </div>
        )}

        {/* ── Step 2: Review ─────────────────────────────────────────────── */}
        {step === "review" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <Summary rows={rows} />
              <button
                onClick={() => setStep("input")}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                ← Re-parse
              </button>
            </div>

            {/* Table */}
            <div className="border border-border-default rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface">
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-widest w-10">#</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-widest">Name</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-widest">Division</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-widest">Match</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-widest">Action</th>
                    <th className="px-3 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const isEditing = editingIdx === idx
                    const isSearching = overrideSearchIdx === idx
                    const matchType = !row.included
                      ? "skip"
                      : row.overridden && !row.resolved_person_id
                      ? "none"
                      : row.overridden
                      ? "exact"
                      : row.match.type
                    const badge = MATCH_BADGE[matchType]

                    return (
                      <tr
                        key={idx}
                        className={cn(
                          "border-b border-border-default last:border-0 transition-colors",
                          row.included ? "hover:bg-surface/50" : "opacity-40"
                        )}
                      >
                        {/* Placement */}
                        <td className="px-3 py-2 text-muted tabular-nums text-xs">
                          {row.placement ?? "—"}
                        </td>

                        {/* Name */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input
                              autoFocus
                              value={row.edited_name}
                              onChange={(e) => updateName(idx, e.target.value)}
                              onBlur={() => setEditingIdx(null)}
                              onKeyDown={(e) => e.key === "Enter" && setEditingIdx(null)}
                              className="w-full bg-surface border border-blue-500 rounded px-2 py-1 text-sm text-foreground focus:outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => setEditingIdx(idx)}
                              className="text-left text-foreground hover:text-blue-400 transition-colors"
                              title="Click to edit name"
                            >
                              {row.edited_name}
                            </button>
                          )}
                          {row.country && (
                            <span className="ml-2 text-xs text-muted">{row.country}</span>
                          )}
                        </td>

                        {/* Division */}
                        <td className="px-3 py-2 text-xs text-muted">
                          {row.division ?? "—"}
                        </td>

                        {/* Match status */}
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <span className={cn("inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit", badge.cls)}>
                              {badge.label}
                            </span>
                            {(row.overridden ? row.resolved_person_id : row.match.person) && (
                              <span className="text-xs text-muted">
                                → {row.overridden
                                  ? catalogPeople.find((p) => p.id === row.resolved_person_id)?.display_name ?? row.edited_name
                                  : row.match.person?.display_name}
                              </span>
                            )}
                            {!row.overridden && row.match.type === "fuzzy" && row.match.candidates && (
                              <span className="text-[10px] text-amber-500/70">
                                {row.match.candidates.length} candidate{row.match.candidates.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2">
                          {isSearching ? (
                            <div className="relative">
                              <input
                                autoFocus
                                value={overrideQuery}
                                onChange={(e) => setOverrideQuery(e.target.value)}
                                placeholder="Search existing person…"
                                className="w-48 bg-surface border border-blue-500 rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                              />
                              {overrideResults.length > 0 && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-surface border border-border-default rounded-lg shadow-lg z-10 overflow-hidden">
                                  <button
                                    onClick={() => overrideMatch(idx, null)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-blue-400 hover:bg-surface-hover border-b border-border-default"
                                  >
                                    + Create as new person
                                  </button>
                                  {overrideResults.map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => overrideMatch(idx, p)}
                                      className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-surface-hover"
                                    >
                                      {p.display_name}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <button
                                onClick={() => { setOverrideSearchIdx(null); setOverrideQuery("") }}
                                className="ml-1 text-xs text-muted hover:text-foreground"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => { setOverrideSearchIdx(idx); setOverrideQuery("") }}
                                className="text-xs text-muted hover:text-foreground transition-colors"
                              >
                                Override
                              </button>
                              {row.overridden && (
                                <button
                                  onClick={() => clearOverride(idx)}
                                  className="text-xs text-muted hover:text-foreground transition-colors"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Include toggle */}
                        <td className="px-3 py-2">
                          <button
                            onClick={() => toggleRow(idx)}
                            title={row.included ? "Exclude this row" : "Include this row"}
                            className={cn(
                              "text-xs w-5 h-5 rounded flex items-center justify-center transition-colors",
                              row.included
                                ? "text-muted hover:text-red-400"
                                : "text-muted/40 hover:text-green-400"
                            )}
                          >
                            {row.included ? "✕" : "↩"}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Confirm bar */}
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border-default">
              <div className="text-sm text-muted">
                {includedCount} rider{includedCount !== 1 ? "s" : ""} · {newCount} new{" "}
                {selectedEventId && createClaims && (
                  <span>· competed_at claims will be created</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {confirmError && (
                  <p className="text-xs text-red-400">{confirmError}</p>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={confirming || includedCount === 0}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {confirming ? "Saving…" : `Confirm import (${includedCount})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ n, label, color }: { n: number; label: string; color: "green" | "blue" | "amber" }) {
  const cls = {
    green: "text-green-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
  }[color]
  return (
    <div className="text-center">
      <div className={cn("text-3xl font-bold tabular-nums", cls)}>{n}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  )
}
