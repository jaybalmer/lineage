"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import type { EventType, PlaceType, OrgType, BrandCategory } from "@/types"

const generateId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

type Tab = "brands" | "boards" | "events" | "places" | "orgs" | "series" | "members"

const TABS: { id: Tab; label: string }[] = [
  { id: "brands",  label: "Brands" },
  { id: "boards",  label: "Boards" },
  { id: "events",  label: "Events" },
  { id: "places",  label: "Places" },
  { id: "orgs",    label: "Orgs" },
  { id: "series",  label: "Series" },
  { id: "members", label: "Members" },
]

const BRAND_CAT_OPTIONS: BrandCategory[] = [
  "board_brand", "outerwear", "bindings", "boots", "retailer", "media", "other",
]

const BRAND_CAT_LABEL: Record<BrandCategory, string> = {
  board_brand: "Board brand",
  outerwear: "Outerwear",
  bindings: "Bindings",
  boots: "Boots",
  retailer: "Retailer",
  media: "Media",
  other: "Other",
}

// Shared styles
const inputCls =
  "w-full bg-transparent border-0 border-b border-border-default px-1.5 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-colors"
const cellCls = "px-3 py-2 text-sm"
const thCls =
  "px-3 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-widest"

type SortState = { col: string; dir: "asc" | "desc" }

// Year-like columns default to descending (newest first)
const YEAR_COLS = new Set(["year", "founded", "startYear"])

function sortRows<T>(
  rows: T[],
  state: SortState,
  getVal: (row: T, col: string) => string | number | undefined
): T[] {
  return [...rows].sort((a, b) => {
    const va = getVal(a, state.col)
    const vb = getVal(b, state.col)
    if (va == null && vb == null) return 0
    if (va == null) return state.dir === "asc" ? 1 : -1
    if (vb == null) return state.dir === "asc" ? -1 : 1
    const cmp =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb))
    return state.dir === "asc" ? cmp : -cmp
  })
}

function SortTh({
  col, label, sortState, onSort, className,
}: {
  col: string
  label: string
  sortState: SortState
  onSort: (col: string) => void
  className?: string
}) {
  const active = sortState.col === col
  return (
    <th
      className={cn(thCls, "cursor-pointer select-none hover:text-foreground transition-colors group", className)}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className={cn("text-[10px] transition-opacity", active ? "opacity-100 text-blue-400" : "opacity-0 group-hover:opacity-40")}>
          {active ? (sortState.dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  )
}

function makeHandleSort(setSortState: React.Dispatch<React.SetStateAction<SortState>>) {
  return (col: string) => {
    setSortState((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: YEAR_COLS.has(col) ? "desc" : "asc" }
    )
  }
}

function SearchAndPasteBar({
  search,
  setSearch,
  count,
  searchPlaceholder,
  showPaste,
  setShowPaste,
}: {
  search: string
  setSearch: (v: string) => void
  count: number
  searchPlaceholder: string
  showPaste: boolean
  setShowPaste: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={searchPlaceholder}
        className="bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500 w-56"
      />
      <span className="text-xs text-muted tabular-nums">{count} rows</span>
      <div className="flex-1" />
      <button
        onClick={() => setShowPaste(!showPaste)}
        className={cn(
          "text-xs px-3 py-1.5 border rounded-lg transition-colors",
          showPaste
            ? "border-blue-500 text-blue-400 bg-blue-950/20"
            : "border-border-default text-muted hover:text-foreground hover:border-blue-500"
        )}
      >
        📋 Paste rows
      </button>
    </div>
  )
}

function PasteArea({
  format,
  example,
  onImport,
  onCancel,
}: {
  format: string
  example: string
  onImport: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState("")
  const rowCount = text.trim() ? text.trim().split("\n").filter(Boolean).length : 0
  return (
    <div className="mb-4 border border-blue-800/40 rounded-xl p-4 bg-blue-950/10">
      <div className="text-xs text-blue-300 font-semibold mb-1">Paste from Google Sheets / spreadsheet</div>
      <div className="text-xs text-muted mb-3 font-mono">
        Format: <span className="text-zinc-400">{format}</span>
        <span className="ml-3 text-zinc-600">e.g. {example}</span>
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder-zinc-700 focus:outline-none focus:border-blue-500 resize-none mb-3"
        placeholder={`Paste tab-separated rows here…`}
      />
      <div className="flex gap-2 items-center">
        <button
          onClick={() => { onImport(text); setText("") }}
          disabled={!text.trim()}
          className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-colors font-medium"
        >
          Import {rowCount > 0 ? rowCount : ""} row{rowCount !== 1 ? "s" : ""}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Brands Table ─────────────────────────────────────────────────────────────

function BrandsTable() {
  const { catalog, addUserOrg, updateCatalogEntity, removeCatalogEntity, activePersonId } = useLineageStore()
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState<BrandCategory | "all">("all")
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [newRow, setNewRow] = useState({ name: "", cat: "board_brand" as BrandCategory, founded: "", country: "" })
  const [showPaste, setShowPaste] = useState(false)
  const [sortState, setSortState] = useState<SortState>({ col: "founded", dir: "asc" })
  const handleSort = makeHandleSort(setSortState)
  const firstNewRef = useRef<HTMLInputElement>(null)

  const brands = sortRows(
    catalog.orgs
      .filter((o) => o.org_type === "brand")
      .filter((o) => !search || o.name.toLowerCase().includes(search.toLowerCase()))
      .filter((o) => catFilter === "all" || o.brand_category === catFilter),
    sortState,
    (o, col) => {
      if (col === "name") return o.name
      if (col === "cat") return o.brand_category ?? ""
      if (col === "founded") return o.founded_year ?? 0
      if (col === "country") return o.country ?? ""
      return ""
    }
  )

  const startEdit = (id: string) => {
    const o = catalog.orgs.find((o) => o.id === id)
    if (!o) return
    setEditId(id)
    setDraft({
      name: o.name,
      cat: o.brand_category ?? "board_brand",
      founded: String(o.founded_year ?? ""),
      country: o.country ?? "",
      website: o.website ?? "",
    })
  }

  const saveEdit = () => {
    if (!editId) return
    updateCatalogEntity("orgs", editId, {
      name: draft.name.trim(),
      brand_category: draft.cat as BrandCategory,
      founded_year: draft.founded ? parseInt(draft.founded) : undefined,
      country: draft.country.trim() || undefined,
      website: draft.website.trim() || undefined,
    })
    setEditId(null)
  }

  const addRow = () => {
    if (!newRow.name.trim()) return
    addUserOrg({
      id: generateId("org"),
      name: newRow.name.trim(),
      org_type: "brand",
      brand_category: newRow.cat,
      founded_year: newRow.founded ? parseInt(newRow.founded) : undefined,
      country: newRow.country.trim() || undefined,
      community_status: "unverified",
      added_by: activePersonId,
    })
    setNewRow({ name: "", cat: "board_brand", founded: "", country: "" })
    setTimeout(() => firstNewRef.current?.focus(), 0)
  }

  const importPaste = (text: string) => {
    text.trim().split("\n").filter(Boolean).forEach((row) => {
      const [name, cat, founded, country, website] = row.split("\t").map((s) => s.trim())
      if (!name) return
      addUserOrg({
        id: generateId("org"),
        name,
        org_type: "brand",
        brand_category: (BRAND_CAT_OPTIONS.includes(cat as BrandCategory) ? cat : "board_brand") as BrandCategory,
        founded_year: founded ? parseInt(founded) : undefined,
        country: country || undefined,
        website: website || undefined,
        community_status: "unverified",
        added_by: activePersonId,
      })
    })
    setShowPaste(false)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands…"
          className="bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500 w-52"
        />
        {/* Category filter chips */}
        <div className="flex items-center gap-1 flex-wrap">
          {(["all", ...BRAND_CAT_OPTIONS] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                catFilter === cat
                  ? "bg-blue-600/20 border-blue-500 text-blue-300"
                  : "border-border-default text-muted hover:text-foreground hover:border-blue-500/40"
              )}
            >
              {cat === "all" ? "All" : BRAND_CAT_LABEL[cat as BrandCategory]}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted tabular-nums ml-1">{brands.length} rows</span>
        <div className="flex-1" />
        <button
          onClick={() => setShowPaste(!showPaste)}
          className={cn(
            "text-xs px-3 py-1.5 border rounded-lg transition-colors",
            showPaste ? "border-blue-500 text-blue-400 bg-blue-950/20" : "border-border-default text-muted hover:text-foreground hover:border-blue-500"
          )}
        >
          📋 Paste rows
        </button>
      </div>

      {showPaste && (
        <PasteArea
          format="Name [tab] Category [tab] Founded [tab] Country [tab] Website"
          example="Nitro Snowboards  board_brand  1990  DE  https://nitrosnowboards.com"
          onImport={importPaste}
          onCancel={() => setShowPaste(false)}
        />
      )}

      <div className="border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface border-b border-border-default">
              <SortTh col="name" label="Name" sortState={sortState} onSort={handleSort} className="w-[32%]" />
              <SortTh col="cat" label="Category" sortState={sortState} onSort={handleSort} className="w-[16%]" />
              <SortTh col="founded" label="Founded" sortState={sortState} onSort={handleSort} className="w-[10%]" />
              <SortTh col="country" label="Country" sortState={sortState} onSort={handleSort} className="w-[10%]" />
              <th className={cn(thCls, "w-[22%]")}>Website</th>
              <th className="w-[10%]" />
            </tr>
          </thead>
          <tbody>
            {brands.map((o, i) => (
              <tr
                key={o.id}
                className={cn(
                  "border-b border-border-default last:border-0 transition-colors",
                  editId === o.id
                    ? "bg-blue-950/20"
                    : i % 2 === 0
                    ? "bg-background hover:bg-surface cursor-pointer"
                    : "bg-surface/40 hover:bg-surface cursor-pointer"
                )}
                onClick={() => editId !== o.id && startEdit(o.id)}
              >
                {editId === o.id ? (
                  <>
                    <td className="py-1 px-1">
                      <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
                    </td>
                    <td className="py-1 px-1">
                      <select value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                        {BRAND_CAT_OPTIONS.map((c) => <option key={c} value={c}>{BRAND_CAT_LABEL[c]}</option>)}
                      </select>
                    </td>
                    <td className="py-1 px-1">
                      <input type="number" value={draft.founded} onChange={(e) => setDraft({ ...draft, founded: e.target.value })} placeholder="year" className={inputCls} />
                    </td>
                    <td className="py-1 px-1">
                      <input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} placeholder="US" className={inputCls} />
                    </td>
                    <td className="py-1 px-1">
                      <input value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} placeholder="https://…" className={inputCls} onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                    </td>
                    <td className="py-1 px-2">
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 transition-colors">Save</button>
                        <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors">×</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className={cn(cellCls, "text-foreground font-medium")}>{o.name}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>
                      <span className="px-1.5 py-0.5 rounded bg-surface-active text-muted text-[10px]">
                        {o.brand_category ? BRAND_CAT_LABEL[o.brand_category] : "—"}
                      </span>
                    </td>
                    <td className={cn(cellCls, "text-muted")}>{o.founded_year ?? "—"}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>{o.country ?? "—"}</td>
                    <td className={cn(cellCls, "text-muted text-xs truncate max-w-0")}>
                      {o.website ? (
                        <a href={o.website} target="_blank" rel="noopener" className="hover:text-blue-400 transition-colors truncate" onClick={(e) => e.stopPropagation()}>
                          {o.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); removeCatalogEntity("orgs", o.id) }}
                        className="text-muted/30 hover:text-red-400 transition-colors text-sm"
                        title="Delete"
                      >✕</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {/* Add row */}
            <tr className="border-t-2 border-blue-900/40 bg-surface/60">
              <td className="py-1.5 px-1">
                <input ref={firstNewRef} value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} placeholder="Brand name…" className={inputCls} />
              </td>
              <td className="py-1.5 px-1">
                <select value={newRow.cat} onChange={(e) => setNewRow({ ...newRow, cat: e.target.value as BrandCategory })} className={cn(inputCls, "cursor-pointer")}>
                  {BRAND_CAT_OPTIONS.map((c) => <option key={c} value={c}>{BRAND_CAT_LABEL[c]}</option>)}
                </select>
              </td>
              <td className="py-1.5 px-1">
                <input type="number" value={newRow.founded} onChange={(e) => setNewRow({ ...newRow, founded: e.target.value })} placeholder="Year…" className={inputCls} />
              </td>
              <td className="py-1.5 px-1">
                <input value={newRow.country} onChange={(e) => setNewRow({ ...newRow, country: e.target.value })} placeholder="US" className={inputCls} onKeyDown={(e) => e.key === "Enter" && addRow()} />
              </td>
              <td className="py-1.5 px-1" />
              <td className="px-2 py-1.5">
                <button onClick={addRow} disabled={!newRow.name.trim()} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 disabled:opacity-30 transition-colors">+ Add</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Boards Table ─────────────────────────────────────────────────────────────

function BoardsTable() {
  const { catalog, addUserBoard, updateCatalogEntity, removeCatalogEntity, activePersonId } = useLineageStore()
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [newRow, setNewRow] = useState({ brand: "", model: "", year: String(new Date().getFullYear()), shape: "" })
  const [showPaste, setShowPaste] = useState(false)
  const [sortState, setSortState] = useState<SortState>({ col: "year", dir: "asc" })
  const handleSort = makeHandleSort(setSortState)
  const firstNewRef = useRef<HTMLInputElement>(null)

  const boards = sortRows(
    catalog.boards.filter(
      (b) => !search || `${b.brand} ${b.model}`.toLowerCase().includes(search.toLowerCase())
    ),
    sortState,
    (b, col) => {
      if (col === "brand") return b.brand
      if (col === "model") return b.model
      if (col === "year") return b.model_year
      if (col === "shape") return b.shape ?? ""
      return ""
    }
  )

  const startEdit = (id: string) => {
    const b = catalog.boards.find((b) => b.id === id)
    if (!b) return
    setEditId(id)
    setDraft({ brand: b.brand, model: b.model, year: String(b.model_year), shape: b.shape ?? "" })
  }

  const saveEdit = () => {
    if (!editId) return
    updateCatalogEntity("boards", editId, {
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      model_year: parseInt(draft.year) || new Date().getFullYear(),
      shape: draft.shape.trim() || undefined,
    })
    setEditId(null)
  }

  const addRow = () => {
    if (!newRow.brand.trim() || !newRow.model.trim()) return
    addUserBoard({
      id: generateId("board"),
      brand: newRow.brand.trim(),
      model: newRow.model.trim(),
      model_year: parseInt(newRow.year) || new Date().getFullYear(),
      shape: newRow.shape.trim() || undefined,
      community_status: "unverified",
      added_by: activePersonId,
    })
    setNewRow({ brand: "", model: "", year: String(new Date().getFullYear()), shape: "" })
    setTimeout(() => firstNewRef.current?.focus(), 0)
  }

  const importPaste = (text: string) => {
    text.trim().split("\n").filter(Boolean).forEach((row) => {
      const [brand, model, year, shape] = row.split("\t").map((s) => s.trim())
      if (!brand || !model) return
      addUserBoard({
        id: generateId("board"),
        brand,
        model,
        model_year: parseInt(year) || new Date().getFullYear(),
        shape: shape || undefined,
        community_status: "unverified",
        added_by: activePersonId,
      })
    })
    setShowPaste(false)
  }

  return (
    <div>
      <SearchAndPasteBar
        search={search}
        setSearch={setSearch}
        count={boards.length}
        searchPlaceholder="Search boards…"
        showPaste={showPaste}
        setShowPaste={setShowPaste}
      />
      {showPaste && (
        <PasteArea
          format="Brand [tab] Model [tab] Year [tab] Shape"
          example="Burton  Custom  2003  twin"
          onImport={importPaste}
          onCancel={() => setShowPaste(false)}
        />
      )}
      <div className="border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface border-b border-border-default">
              <SortTh col="brand" label="Brand" sortState={sortState} onSort={handleSort} className="w-[26%]" />
              <SortTh col="model" label="Model" sortState={sortState} onSort={handleSort} className="w-[26%]" />
              <SortTh col="year" label="Year" sortState={sortState} onSort={handleSort} className="w-[12%]" />
              <SortTh col="shape" label="Shape" sortState={sortState} onSort={handleSort} className="w-[24%]" />
              <th className="w-[12%]" />
            </tr>
          </thead>
          <tbody>
            {boards.map((b, i) => (
              <tr
                key={b.id}
                className={cn(
                  "border-b border-border-default last:border-0 transition-colors",
                  editId === b.id
                    ? "bg-blue-950/20"
                    : i % 2 === 0
                    ? "bg-background hover:bg-surface cursor-pointer"
                    : "bg-surface/40 hover:bg-surface cursor-pointer"
                )}
                onClick={() => editId !== b.id && startEdit(b.id)}
              >
                {editId === b.id ? (
                  <>
                    <td className="py-1 px-1">
                      <input autoFocus value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} className={inputCls} />
                    </td>
                    <td className="py-1 px-1">
                      <input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} className={inputCls} />
                    </td>
                    <td className="py-1 px-1">
                      <input type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} className={inputCls} />
                    </td>
                    <td className="py-1 px-1">
                      <input value={draft.shape} onChange={(e) => setDraft({ ...draft, shape: e.target.value })} placeholder="twin / directional…" className={inputCls} onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                    </td>
                    <td className="py-1 px-2">
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 transition-colors">Save</button>
                        <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors">×</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className={cn(cellCls, "text-foreground")}>{b.brand}</td>
                    <td className={cn(cellCls, "text-foreground")}>{b.model}</td>
                    <td className={cn(cellCls, "text-muted")}>{b.model_year}</td>
                    <td className={cn(cellCls, "text-muted")}>{b.shape ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); removeCatalogEntity("boards", b.id) }}
                        className="text-muted/30 hover:text-red-400 transition-colors text-sm"
                        title="Delete"
                      >✕</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {/* Add row */}
            <tr className="border-t-2 border-blue-900/40 bg-surface/60">
              <td className="py-1.5 px-1">
                <input ref={firstNewRef} value={newRow.brand} onChange={(e) => setNewRow({ ...newRow, brand: e.target.value })} placeholder="Brand…" className={inputCls} />
              </td>
              <td className="py-1.5 px-1">
                <input value={newRow.model} onChange={(e) => setNewRow({ ...newRow, model: e.target.value })} placeholder="Model…" className={inputCls} />
              </td>
              <td className="py-1.5 px-1">
                <input type="number" value={newRow.year} onChange={(e) => setNewRow({ ...newRow, year: e.target.value })} className={inputCls} />
              </td>
              <td className="py-1.5 px-1">
                <input value={newRow.shape} onChange={(e) => setNewRow({ ...newRow, shape: e.target.value })} placeholder="twin / dir…" className={inputCls} onKeyDown={(e) => e.key === "Enter" && addRow()} />
              </td>
              <td className="px-2 py-1.5">
                <button
                  onClick={addRow}
                  disabled={!newRow.brand.trim() || !newRow.model.trim()}
                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 disabled:opacity-30 transition-colors"
                >
                  + Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Events Table ──────────────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS: EventType[] = ["contest", "film-shoot", "trip", "camp", "gathering"]

function EventsTable() {
  const { catalog, addUserEvent, updateCatalogEntity, removeCatalogEntity, activePersonId } = useLineageStore()
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [newRow, setNewRow] = useState({ name: "", type: "contest", year: String(new Date().getFullYear()), seriesId: "", placeId: "" })
  const [showPaste, setShowPaste] = useState(false)
  const [sortState, setSortState] = useState<SortState>({ col: "year", dir: "desc" })
  const handleSort = makeHandleSort(setSortState)
  const firstNewRef = useRef<HTMLInputElement>(null)

  const resolveSeries = (id?: string) => id ? catalog.eventSeries.find((s) => s.id === id)?.name ?? id : "—"
  const resolvePlace = (id?: string) => id ? catalog.places.find((p) => p.id === id)?.name ?? id : "—"

  const events = sortRows(
    catalog.events.filter(
      (e) => !search || e.name.toLowerCase().includes(search.toLowerCase())
    ),
    sortState,
    (e, col) => {
      if (col === "name") return e.name
      if (col === "type") return e.event_type
      if (col === "year") return e.year ?? parseInt(e.start_date?.slice(0, 4) ?? "0")
      if (col === "series") return resolveSeries(e.series_id)
      if (col === "place") return resolvePlace(e.place_id)
      return ""
    }
  )

  const startEdit = (id: string) => {
    const e = catalog.events.find((e) => e.id === id)
    if (!e) return
    setEditId(id)
    setDraft({
      name: e.name,
      type: e.event_type,
      year: String(e.year ?? e.start_date?.slice(0, 4) ?? ""),
      seriesId: e.series_id ?? "",
      placeId: e.place_id ?? "",
    })
  }

  const saveEdit = () => {
    if (!editId) return
    const year = parseInt(draft.year)
    updateCatalogEntity("events", editId, {
      name: draft.name.trim(),
      event_type: draft.type as EventType,
      year: isNaN(year) ? undefined : year,
      start_date: draft.year,
      series_id: draft.seriesId || undefined,
      place_id: draft.placeId || undefined,
    })
    setEditId(null)
  }

  const addRow = () => {
    if (!newRow.name.trim()) return
    const year = parseInt(newRow.year)
    addUserEvent({
      id: generateId("event"),
      name: newRow.name.trim(),
      event_type: newRow.type as EventType,
      year: isNaN(year) ? undefined : year,
      start_date: newRow.year,
      series_id: newRow.seriesId || undefined,
      place_id: newRow.placeId || undefined,
      community_status: "unverified",
      added_by: activePersonId,
    })
    setNewRow({ name: "", type: "contest", year: String(new Date().getFullYear()), seriesId: "", placeId: "" })
    setTimeout(() => firstNewRef.current?.focus(), 0)
  }

  const importPaste = (text: string) => {
    text.trim().split("\n").filter(Boolean).forEach((row) => {
      const [name, type, year, seriesName, placeName] = row.split("\t").map((s) => s.trim())
      if (!name) return
      const seriesId = seriesName ? catalog.eventSeries.find((s) => s.name.toLowerCase() === seriesName.toLowerCase())?.id : undefined
      const placeId = placeName ? catalog.places.find((p) => p.name.toLowerCase() === placeName.toLowerCase())?.id : undefined
      addUserEvent({
        id: generateId("event"),
        name,
        event_type: (EVENT_TYPE_OPTIONS.includes(type as EventType) ? type : "contest") as EventType,
        year: parseInt(year) || undefined,
        start_date: year || String(new Date().getFullYear()),
        series_id: seriesId,
        place_id: placeId,
        community_status: "unverified",
        added_by: activePersonId,
      })
    })
    setShowPaste(false)
  }

  return (
    <div>
      <SearchAndPasteBar
        search={search}
        setSearch={setSearch}
        count={events.length}
        searchPlaceholder="Search events…"
        showPaste={showPaste}
        setShowPaste={setShowPaste}
      />
      {showPaste && (
        <PasteArea
          format="Name [tab] Type [tab] Year [tab] Series name [tab] Place name"
          example="37th Legendary Banked Slalom  contest  2024  Mt. Baker Banked Slalom  Mt. Baker"
          onImport={importPaste}
          onCancel={() => setShowPaste(false)}
        />
      )}
      <div className="border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface border-b border-border-default">
              <SortTh col="name" label="Name" sortState={sortState} onSort={handleSort} className="w-[30%]" />
              <SortTh col="type" label="Type" sortState={sortState} onSort={handleSort} className="w-[11%]" />
              <SortTh col="year" label="Year" sortState={sortState} onSort={handleSort} className="w-[8%]" />
              <SortTh col="series" label="Series" sortState={sortState} onSort={handleSort} className="w-[22%]" />
              <SortTh col="place" label="Place" sortState={sortState} onSort={handleSort} className="w-[20%]" />
              <th className="w-[9%]" />
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr
                key={e.id}
                className={cn(
                  "border-b border-border-default last:border-0 transition-colors",
                  editId === e.id
                    ? "bg-blue-950/20"
                    : i % 2 === 0
                    ? "bg-background hover:bg-surface cursor-pointer"
                    : "bg-surface/40 hover:bg-surface cursor-pointer"
                )}
                onClick={() => editId !== e.id && startEdit(e.id)}
              >
                {editId === e.id ? (
                  <>
                    <td className="py-1 px-1">
                      <input autoFocus value={draft.name} onChange={(ev) => setDraft({ ...draft, name: ev.target.value })} className={inputCls} />
                    </td>
                    <td className="py-1 px-1">
                      <select value={draft.type} onChange={(ev) => setDraft({ ...draft, type: ev.target.value })} className={cn(inputCls, "cursor-pointer")}>
                        {EVENT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1 px-1">
                      <input type="number" value={draft.year} onChange={(ev) => setDraft({ ...draft, year: ev.target.value })} className={inputCls} />
                    </td>
                    <td className="py-1 px-1">
                      <select value={draft.seriesId} onChange={(ev) => setDraft({ ...draft, seriesId: ev.target.value })} className={cn(inputCls, "cursor-pointer")}>
                        <option value="">— none —</option>
                        {catalog.eventSeries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="py-1 px-1">
                      <select value={draft.placeId} onChange={(ev) => setDraft({ ...draft, placeId: ev.target.value })} className={cn(inputCls, "cursor-pointer")}>
                        <option value="">— none —</option>
                        {catalog.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="py-1 px-2">
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 transition-colors">Save</button>
                        <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors">×</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className={cn(cellCls, "text-foreground")}>{e.name}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>{e.event_type}</td>
                    <td className={cn(cellCls, "text-muted")}>{e.year ?? e.start_date?.slice(0, 4)}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>{resolveSeries(e.series_id)}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>{resolvePlace(e.place_id)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={(ev) => { ev.stopPropagation(); removeCatalogEntity("events", e.id) }} className="text-muted/30 hover:text-red-400 transition-colors text-sm" title="Delete">✕</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {/* Add row */}
            <tr className="border-t-2 border-blue-900/40 bg-surface/60">
              <td className="py-1.5 px-1">
                <input ref={firstNewRef} value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} placeholder="Event name…" className={inputCls} />
              </td>
              <td className="py-1.5 px-1">
                <select value={newRow.type} onChange={(e) => setNewRow({ ...newRow, type: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                  {EVENT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td className="py-1.5 px-1">
                <input type="number" value={newRow.year} onChange={(e) => setNewRow({ ...newRow, year: e.target.value })} className={inputCls} />
              </td>
              <td className="py-1.5 px-1">
                <select value={newRow.seriesId} onChange={(e) => setNewRow({ ...newRow, seriesId: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                  <option value="">— none —</option>
                  {catalog.eventSeries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </td>
              <td className="py-1.5 px-1">
                <select value={newRow.placeId} onChange={(e) => setNewRow({ ...newRow, placeId: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                  <option value="">— none —</option>
                  {catalog.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </td>
              <td className="px-2 py-1.5">
                <button onClick={addRow} disabled={!newRow.name.trim()} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 disabled:opacity-30 transition-colors">
                  + Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Places Table ──────────────────────────────────────────────────────────────

const PLACE_TYPE_OPTIONS: PlaceType[] = ["resort", "shop", "zone", "city", "venue"]

function PlacesTable() {
  const { catalog, addUserPlace, updateCatalogEntity, removeCatalogEntity, activePersonId } = useLineageStore()
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [newRow, setNewRow] = useState({ name: "", type: "resort", region: "", country: "" })
  const [showPaste, setShowPaste] = useState(false)
  const [sortState, setSortState] = useState<SortState>({ col: "name", dir: "asc" })
  const handleSort = makeHandleSort(setSortState)
  const firstNewRef = useRef<HTMLInputElement>(null)

  const places = sortRows(
    catalog.places.filter(
      (p) => !search || p.name.toLowerCase().includes(search.toLowerCase())
    ),
    sortState,
    (p, col) => {
      if (col === "name") return p.name
      if (col === "type") return p.place_type
      if (col === "region") return p.region ?? ""
      if (col === "country") return p.country ?? ""
      return ""
    }
  )

  const startEdit = (id: string) => {
    const p = catalog.places.find((p) => p.id === id)
    if (!p) return
    setEditId(id)
    setDraft({ name: p.name, type: p.place_type, region: p.region ?? "", country: p.country ?? "" })
  }

  const saveEdit = () => {
    if (!editId) return
    updateCatalogEntity("places", editId, {
      name: draft.name.trim(),
      place_type: draft.type as PlaceType,
      region: draft.region.trim() || undefined,
      country: draft.country.trim() || undefined,
    })
    setEditId(null)
  }

  const addRow = () => {
    if (!newRow.name.trim()) return
    addUserPlace({
      id: generateId("place"),
      name: newRow.name.trim(),
      place_type: newRow.type as PlaceType,
      region: newRow.region.trim() || undefined,
      country: newRow.country.trim() || undefined,
      community_status: "unverified",
      added_by: activePersonId,
    })
    setNewRow({ name: "", type: "resort", region: "", country: "" })
    setTimeout(() => firstNewRef.current?.focus(), 0)
  }

  const importPaste = (text: string) => {
    text.trim().split("\n").filter(Boolean).forEach((row) => {
      const [name, type, region, country] = row.split("\t").map((s) => s.trim())
      if (!name) return
      addUserPlace({
        id: generateId("place"),
        name,
        place_type: (PLACE_TYPE_OPTIONS.includes(type as PlaceType) ? type : "resort") as PlaceType,
        region: region || undefined,
        country: country || undefined,
        community_status: "unverified",
        added_by: activePersonId,
      })
    })
    setShowPaste(false)
  }

  return (
    <div>
      <SearchAndPasteBar search={search} setSearch={setSearch} count={places.length} searchPlaceholder="Search places…" showPaste={showPaste} setShowPaste={setShowPaste} />
      {showPaste && (
        <PasteArea
          format="Name [tab] Type [tab] Region [tab] Country"
          example="Mt. Baker  resort  Washington  USA"
          onImport={importPaste}
          onCancel={() => setShowPaste(false)}
        />
      )}
      <div className="border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface border-b border-border-default">
              <SortTh col="name" label="Name" sortState={sortState} onSort={handleSort} className="w-[36%]" />
              <SortTh col="type" label="Type" sortState={sortState} onSort={handleSort} className="w-[14%]" />
              <SortTh col="region" label="Region" sortState={sortState} onSort={handleSort} className="w-[18%]" />
              <SortTh col="country" label="Country" sortState={sortState} onSort={handleSort} className="w-[18%]" />
              <th className="w-[14%]" />
            </tr>
          </thead>
          <tbody>
            {places.map((p, i) => (
              <tr
                key={p.id}
                className={cn(
                  "border-b border-border-default last:border-0 transition-colors",
                  editId === p.id ? "bg-blue-950/20" : i % 2 === 0 ? "bg-background hover:bg-surface cursor-pointer" : "bg-surface/40 hover:bg-surface cursor-pointer"
                )}
                onClick={() => editId !== p.id && startEdit(p.id)}
              >
                {editId === p.id ? (
                  <>
                    <td className="py-1 px-1"><input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} /></td>
                    <td className="py-1 px-1">
                      <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                        {PLACE_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1 px-1"><input value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} placeholder="e.g. Washington" className={inputCls} /></td>
                    <td className="py-1 px-1"><input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} placeholder="e.g. USA" className={inputCls} onKeyDown={(e) => e.key === "Enter" && saveEdit()} /></td>
                    <td className="py-1 px-2">
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 transition-colors">Save</button>
                        <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors">×</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className={cn(cellCls, "text-foreground")}>{p.name}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>{p.place_type}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>{p.region ?? "—"}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>{p.country ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={(e) => { e.stopPropagation(); removeCatalogEntity("places", p.id) }} className="text-muted/30 hover:text-red-400 transition-colors text-sm" title="Delete">✕</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            <tr className="border-t-2 border-blue-900/40 bg-surface/60">
              <td className="py-1.5 px-1"><input ref={firstNewRef} value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} placeholder="Place name…" className={inputCls} /></td>
              <td className="py-1.5 px-1">
                <select value={newRow.type} onChange={(e) => setNewRow({ ...newRow, type: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                  {PLACE_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td className="py-1.5 px-1"><input value={newRow.region} onChange={(e) => setNewRow({ ...newRow, region: e.target.value })} placeholder="Region…" className={inputCls} /></td>
              <td className="py-1.5 px-1"><input value={newRow.country} onChange={(e) => setNewRow({ ...newRow, country: e.target.value })} placeholder="Country…" className={inputCls} onKeyDown={(e) => e.key === "Enter" && addRow()} /></td>
              <td className="px-2 py-1.5">
                <button onClick={addRow} disabled={!newRow.name.trim()} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 disabled:opacity-30 transition-colors">+ Add</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Orgs Table ────────────────────────────────────────────────────────────────

const ORG_TYPE_OPTIONS: OrgType[] = ["brand", "shop", "team", "magazine", "event-series"]

function OrgsTable() {
  const { catalog, addUserOrg, updateCatalogEntity, removeCatalogEntity, activePersonId } = useLineageStore()
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [newRow, setNewRow] = useState({ name: "", type: "brand", founded: "", country: "" })
  const [showPaste, setShowPaste] = useState(false)
  const [sortState, setSortState] = useState<SortState>({ col: "founded", dir: "asc" })
  const handleSort = makeHandleSort(setSortState)
  const firstNewRef = useRef<HTMLInputElement>(null)

  const orgs = sortRows(
    catalog.orgs.filter(
      (o) => !search || o.name.toLowerCase().includes(search.toLowerCase())
    ),
    sortState,
    (o, col) => {
      if (col === "name") return o.name
      if (col === "type") return o.org_type
      if (col === "founded") return o.founded_year ?? 0
      if (col === "country") return o.country ?? ""
      return ""
    }
  )

  const startEdit = (id: string) => {
    const o = catalog.orgs.find((o) => o.id === id)
    if (!o) return
    setEditId(id)
    setDraft({ name: o.name, type: o.org_type, founded: String(o.founded_year ?? ""), country: o.country ?? "" })
  }

  const saveEdit = () => {
    if (!editId) return
    updateCatalogEntity("orgs", editId, {
      name: draft.name.trim(),
      org_type: draft.type as OrgType,
      founded_year: draft.founded ? parseInt(draft.founded) : undefined,
      country: draft.country.trim() || undefined,
    })
    setEditId(null)
  }

  const addRow = () => {
    if (!newRow.name.trim()) return
    addUserOrg({
      id: generateId("org"),
      name: newRow.name.trim(),
      org_type: newRow.type as OrgType,
      founded_year: newRow.founded ? parseInt(newRow.founded) : undefined,
      country: newRow.country.trim() || undefined,
      community_status: "unverified",
      added_by: activePersonId,
    })
    setNewRow({ name: "", type: "brand", founded: "", country: "" })
    setTimeout(() => firstNewRef.current?.focus(), 0)
  }

  const importPaste = (text: string) => {
    text.trim().split("\n").filter(Boolean).forEach((row) => {
      const [name, type, founded, country] = row.split("\t").map((s) => s.trim())
      if (!name) return
      addUserOrg({
        id: generateId("org"),
        name,
        org_type: (ORG_TYPE_OPTIONS.includes(type as OrgType) ? type : "brand") as OrgType,
        founded_year: founded ? parseInt(founded) : undefined,
        country: country || undefined,
        community_status: "unverified",
        added_by: activePersonId,
      })
    })
    setShowPaste(false)
  }

  return (
    <div>
      <SearchAndPasteBar search={search} setSearch={setSearch} count={orgs.length} searchPlaceholder="Search orgs…" showPaste={showPaste} setShowPaste={setShowPaste} />
      {showPaste && (
        <PasteArea
          format="Name [tab] Type [tab] Founded [tab] Country"
          example="Lib Technologies  brand  1989  USA"
          onImport={importPaste}
          onCancel={() => setShowPaste(false)}
        />
      )}
      <div className="border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface border-b border-border-default">
              <SortTh col="name" label="Name" sortState={sortState} onSort={handleSort} className="w-[36%]" />
              <SortTh col="type" label="Type" sortState={sortState} onSort={handleSort} className="w-[16%]" />
              <SortTh col="founded" label="Founded" sortState={sortState} onSort={handleSort} className="w-[14%]" />
              <SortTh col="country" label="Country" sortState={sortState} onSort={handleSort} className="w-[20%]" />
              <th className="w-[14%]" />
            </tr>
          </thead>
          <tbody>
            {orgs.map((o, i) => (
              <tr
                key={o.id}
                className={cn(
                  "border-b border-border-default last:border-0 transition-colors",
                  editId === o.id ? "bg-blue-950/20" : i % 2 === 0 ? "bg-background hover:bg-surface cursor-pointer" : "bg-surface/40 hover:bg-surface cursor-pointer"
                )}
                onClick={() => editId !== o.id && startEdit(o.id)}
              >
                {editId === o.id ? (
                  <>
                    <td className="py-1 px-1"><input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} /></td>
                    <td className="py-1 px-1">
                      <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                        {ORG_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1 px-1"><input type="number" value={draft.founded} onChange={(e) => setDraft({ ...draft, founded: e.target.value })} placeholder="year…" className={inputCls} /></td>
                    <td className="py-1 px-1"><input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} placeholder="e.g. USA" className={inputCls} onKeyDown={(e) => e.key === "Enter" && saveEdit()} /></td>
                    <td className="py-1 px-2">
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 transition-colors">Save</button>
                        <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors">×</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className={cn(cellCls, "text-foreground")}>{o.name}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>{o.org_type}</td>
                    <td className={cn(cellCls, "text-muted")}>{o.founded_year ?? "—"}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>{o.country ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={(e) => { e.stopPropagation(); removeCatalogEntity("orgs", o.id) }} className="text-muted/30 hover:text-red-400 transition-colors text-sm" title="Delete">✕</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            <tr className="border-t-2 border-blue-900/40 bg-surface/60">
              <td className="py-1.5 px-1"><input ref={firstNewRef} value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} placeholder="Org name…" className={inputCls} /></td>
              <td className="py-1.5 px-1">
                <select value={newRow.type} onChange={(e) => setNewRow({ ...newRow, type: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                  {ORG_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td className="py-1.5 px-1"><input type="number" value={newRow.founded} onChange={(e) => setNewRow({ ...newRow, founded: e.target.value })} placeholder="Year…" className={inputCls} /></td>
              <td className="py-1.5 px-1"><input value={newRow.country} onChange={(e) => setNewRow({ ...newRow, country: e.target.value })} placeholder="Country…" className={inputCls} onKeyDown={(e) => e.key === "Enter" && addRow()} /></td>
              <td className="px-2 py-1.5">
                <button onClick={addRow} disabled={!newRow.name.trim()} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 disabled:opacity-30 transition-colors">+ Add</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Series Table ──────────────────────────────────────────────────────────────

function SeriesTable() {
  const { catalog, addUserSeries, updateCatalogEntity, removeCatalogEntity } = useLineageStore()
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [newRow, setNewRow] = useState({ name: "", freq: "annual", startYear: "", placeId: "" })
  const [showPaste, setShowPaste] = useState(false)
  const [sortState, setSortState] = useState<SortState>({ col: "startYear", dir: "asc" })
  const handleSort = makeHandleSort(setSortState)
  const firstNewRef = useRef<HTMLInputElement>(null)

  const resolvePlace = (id?: string) => id ? catalog.places.find((p) => p.id === id)?.name ?? id : "—"

  const series = sortRows(
    catalog.eventSeries.filter(
      (s) => !search || s.name.toLowerCase().includes(search.toLowerCase())
    ),
    sortState,
    (s, col) => {
      if (col === "name") return s.name
      if (col === "freq") return s.frequency
      if (col === "startYear") return s.start_year ?? 0
      if (col === "place") return resolvePlace(s.place_id)
      return ""
    }
  )

  const startEdit = (id: string) => {
    const s = catalog.eventSeries.find((s) => s.id === id)
    if (!s) return
    setEditId(id)
    setDraft({ name: s.name, freq: s.frequency, startYear: String(s.start_year ?? ""), placeId: s.place_id ?? "" })
  }

  const saveEdit = () => {
    if (!editId) return
    updateCatalogEntity("eventSeries", editId, {
      name: draft.name.trim(),
      frequency: draft.freq as "annual" | "tour" | "irregular",
      start_year: draft.startYear ? parseInt(draft.startYear) : undefined,
      place_id: draft.placeId || undefined,
    })
    setEditId(null)
  }

  const addRow = () => {
    if (!newRow.name.trim()) return
    addUserSeries({
      id: generateId("series"),
      name: newRow.name.trim(),
      frequency: newRow.freq as "annual" | "tour" | "irregular",
      start_year: newRow.startYear ? parseInt(newRow.startYear) : undefined,
      place_id: newRow.placeId || undefined,
    })
    setNewRow({ name: "", freq: "annual", startYear: "", placeId: "" })
    setTimeout(() => firstNewRef.current?.focus(), 0)
  }

  const importPaste = (text: string) => {
    text.trim().split("\n").filter(Boolean).forEach((row) => {
      const [name, freq, startYear, placeName] = row.split("\t").map((s) => s.trim())
      if (!name) return
      const placeId = placeName ? catalog.places.find((p) => p.name.toLowerCase() === placeName.toLowerCase())?.id : undefined
      addUserSeries({
        id: generateId("series"),
        name,
        frequency: (["annual", "tour", "irregular"].includes(freq) ? freq : "annual") as "annual" | "tour" | "irregular",
        start_year: startYear ? parseInt(startYear) : undefined,
        place_id: placeId,
      })
    })
    setShowPaste(false)
  }

  return (
    <div>
      <SearchAndPasteBar search={search} setSearch={setSearch} count={series.length} searchPlaceholder="Search series…" showPaste={showPaste} setShowPaste={setShowPaste} />
      {showPaste && (
        <PasteArea
          format="Name [tab] Frequency [tab] Start Year [tab] Place name"
          example="Mt. Baker Banked Slalom  annual  1985  Mt. Baker"
          onImport={importPaste}
          onCancel={() => setShowPaste(false)}
        />
      )}
      <div className="border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface border-b border-border-default">
              <SortTh col="name" label="Name" sortState={sortState} onSort={handleSort} className="w-[32%]" />
              <SortTh col="freq" label="Frequency" sortState={sortState} onSort={handleSort} className="w-[14%]" />
              <SortTh col="startYear" label="Since" sortState={sortState} onSort={handleSort} className="w-[12%]" />
              <SortTh col="place" label="Place" sortState={sortState} onSort={handleSort} className="w-[28%]" />
              <th className="w-[14%]" />
            </tr>
          </thead>
          <tbody>
            {series.map((s, i) => (
              <tr
                key={s.id}
                className={cn(
                  "border-b border-border-default last:border-0 transition-colors",
                  editId === s.id ? "bg-blue-950/20" : i % 2 === 0 ? "bg-background hover:bg-surface cursor-pointer" : "bg-surface/40 hover:bg-surface cursor-pointer"
                )}
                onClick={() => editId !== s.id && startEdit(s.id)}
              >
                {editId === s.id ? (
                  <>
                    <td className="py-1 px-1"><input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} /></td>
                    <td className="py-1 px-1">
                      <select value={draft.freq} onChange={(e) => setDraft({ ...draft, freq: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                        <option value="annual">Annual</option>
                        <option value="tour">Tour</option>
                        <option value="irregular">Irregular</option>
                      </select>
                    </td>
                    <td className="py-1 px-1"><input type="number" value={draft.startYear} onChange={(e) => setDraft({ ...draft, startYear: e.target.value })} placeholder="year" className={inputCls} /></td>
                    <td className="py-1 px-1">
                      <select value={draft.placeId} onChange={(e) => setDraft({ ...draft, placeId: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                        <option value="">— none —</option>
                        {catalog.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="py-1 px-2">
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 transition-colors">Save</button>
                        <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors">×</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className={cn(cellCls, "text-foreground")}>{s.name}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>{s.frequency}</td>
                    <td className={cn(cellCls, "text-muted")}>{s.start_year ?? "—"}</td>
                    <td className={cn(cellCls, "text-muted text-xs")}>{resolvePlace(s.place_id)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={(e) => { e.stopPropagation(); removeCatalogEntity("eventSeries", s.id) }} className="text-muted/30 hover:text-red-400 transition-colors text-sm" title="Delete">✕</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            <tr className="border-t-2 border-blue-900/40 bg-surface/60">
              <td className="py-1.5 px-1"><input ref={firstNewRef} value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} placeholder="Series name…" className={inputCls} /></td>
              <td className="py-1.5 px-1">
                <select value={newRow.freq} onChange={(e) => setNewRow({ ...newRow, freq: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                  <option value="annual">Annual</option>
                  <option value="tour">Tour</option>
                  <option value="irregular">Irregular</option>
                </select>
              </td>
              <td className="py-1.5 px-1"><input type="number" value={newRow.startYear} onChange={(e) => setNewRow({ ...newRow, startYear: e.target.value })} placeholder="Year…" className={inputCls} /></td>
              <td className="py-1.5 px-1">
                <select value={newRow.placeId} onChange={(e) => setNewRow({ ...newRow, placeId: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                  <option value="">— none —</option>
                  {catalog.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </td>
              <td className="px-2 py-1.5">
                <button onClick={addRow} disabled={!newRow.name.trim()} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 disabled:opacity-30 transition-colors">+ Add</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Members Table ─────────────────────────────────────────────────────────────

type MemberRow = {
  id: string
  display_name: string | null
  email: string | null
  membership_tier: string | null
  membership_status: string | null
  founding_badge: boolean | null
  founding_member_number: number | null
  token_founder: number | null
  token_member: number | null
  token_contribution: number | null
  stripe_customer_id: string | null
  membership_expires_at: string | null
  created_at: string | null
}

const TIER_COLOR: Record<string, string> = {
  free: "#888", annual: "#3b82f6", lifetime: "#8b5cf6", founding: "#f59e0b",
}
const TIER_SYMBOL: Record<string, string> = {
  free: "●", annual: "◈", lifetime: "◆", founding: "✦",
}

function MembersTable() {
  const { activePersonId } = useLineageStore()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const [draft, setDraft] = useState<{
    tier: string; tokenFounder: string; tokenMember: string; memberNumber: string; status: string
  }>({ tier: "free", tokenFounder: "0", tokenMember: "0", memberNumber: "", status: "active" })

  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const res = await fetch("/api/admin/memberships")
    const data = await res.json()
    if (data.error) {
      setLoadError(data.error)
      setLoading(false)
      return
    }
    setMembers(data.members ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(m: MemberRow) {
    setEditId(m.id)
    setDraft({
      tier:        m.membership_tier   ?? "free",
      tokenFounder: String(m.token_founder  ?? 0),
      tokenMember:  String(m.token_member   ?? 0),
      memberNumber: String(m.founding_member_number ?? ""),
      status:      m.membership_status ?? "active",
    })
  }

  async function save(userId: string) {
    setSaving(true)
    const res = await fetch("/api/admin/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id:               userId,
        tier:                  draft.tier,
        token_founder:         parseInt(draft.tokenFounder) || 0,
        token_member:          parseInt(draft.tokenMember)  || 0,
        founding_member_number: draft.memberNumber ? parseInt(draft.memberNumber) : null,
        founding_badge:        draft.tier === "founding",
        membership_status:     draft.status,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.ok) {
      setMsg({ id: userId, text: "✓ Saved", ok: true })
      setEditId(null)
      await load()
    } else {
      setMsg({ id: userId, text: data.error ?? "Error", ok: false })
    }
    setTimeout(() => setMsg(null), 3000)
  }

  async function quickGrant(m: MemberRow, tier: string) {
    // Count existing founding members for number assignment
    let memberNumber: number | null = null
    if (tier === "founding") {
      const existing = members.filter((x) => x.membership_tier === "founding" && x.id !== m.id).length
      memberNumber = existing + 1
    }
    const tokenMap: Record<string, { founder: number; member: number }> = {
      annual: { founder: 0, member: 10 }, lifetime: { founder: 0, member: 30 }, founding: { founder: 100, member: 0 },
    }
    const tokens = tokenMap[tier] ?? { founder: 0, member: 0 }
    setSaving(true)
    const res = await fetch("/api/admin/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id:               m.id,
        tier,
        token_founder:         tokens.founder,
        token_member:          tokens.member,
        founding_member_number: memberNumber,
        founding_badge:        tier === "founding",
        membership_status:     "active",
      }),
    })
    const data = await res.json()
    setSaving(false)
    setMsg({ id: m.id, text: data.ok ? `✓ Granted ${tier}` : (data.error ?? "Error"), ok: !!data.ok })
    setTimeout(() => setMsg(null), 3000)
    if (data.ok) load()
  }

  if (loading) {
    return <div className="py-12 text-center text-muted text-sm">Loading members…</div>
  }

  if (loadError) {
    return (
      <div className="py-12 text-center space-y-2">
        <p className="text-red-400 text-sm font-mono">Error loading members</p>
        <p className="text-muted text-xs">{loadError}</p>
        <button onClick={load} className="text-blue-400 text-xs underline mt-2">Retry</button>
      </div>
    )
  }

  const foundingCount = members.filter((m) => m.membership_tier === "founding").length
  const paidCount = members.filter((m) => m.membership_tier && m.membership_tier !== "free").length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4 text-xs text-muted">
        <span>{members.length} total users</span>
        <span>·</span>
        <span className="text-amber-400 font-semibold">{foundingCount} founding</span>
        <span>·</span>
        <span className="text-blue-400">{paidCount} paid members</span>
      </div>

      <div className="rounded-xl border border-border-default overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface border-b border-border-default">
            <tr>
              <th className={thCls}>User</th>
              <th className={thCls}>Tier</th>
              <th className={thCls}>#</th>
              <th className={thCls}>Tokens</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const isMe = m.id === activePersonId
              const tier = m.membership_tier ?? "free"
              const color = TIER_COLOR[tier] ?? "#888"
              const symbol = TIER_SYMBOL[tier] ?? "●"
              const rowMsg = msg?.id === m.id ? msg : null

              return (
                <tr
                  key={m.id}
                  className={cn(
                    "border-b border-border-default last:border-0 transition-colors",
                    isMe && "ring-1 ring-inset ring-blue-500/30",
                    editId === m.id ? "bg-blue-950/20" : i % 2 === 0 ? "bg-background" : "bg-surface/40"
                  )}
                >
                  {editId === m.id ? (
                    <>
                      {/* Edit row */}
                      <td className={cn(cellCls, "text-foreground")}>
                        <div className="font-medium">{m.display_name ?? "—"}</div>
                        <div className="text-[10px] text-muted">{m.id.slice(0, 12)}…</div>
                      </td>
                      <td className="py-1 px-1">
                        <select value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
                          className={cn(inputCls, "cursor-pointer")}>
                          <option value="free">Free</option>
                          <option value="annual">Annual</option>
                          <option value="lifetime">Lifetime</option>
                          <option value="founding">Founding</option>
                        </select>
                      </td>
                      <td className="py-1 px-1">
                        <input type="number" value={draft.memberNumber}
                          onChange={(e) => setDraft({ ...draft, memberNumber: e.target.value })}
                          placeholder="001" className={cn(inputCls, "w-16")} />
                      </td>
                      <td className="py-1 px-1">
                        <div className="flex gap-1 items-center">
                          <input type="number" value={draft.tokenFounder}
                            onChange={(e) => setDraft({ ...draft, tokenFounder: e.target.value })}
                            placeholder="F" className={cn(inputCls, "w-14")} title="Founder tokens" />
                          <span className="text-muted text-xs">F</span>
                          <input type="number" value={draft.tokenMember}
                            onChange={(e) => setDraft({ ...draft, tokenMember: e.target.value })}
                            placeholder="M" className={cn(inputCls, "w-14")} title="Member tokens" />
                          <span className="text-muted text-xs">M</span>
                        </div>
                      </td>
                      <td className="py-1 px-1">
                        <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                          className={cn(inputCls, "cursor-pointer")}>
                          <option value="active">Active</option>
                          <option value="expired">Expired</option>
                          <option value="gifted">Gifted</option>
                        </select>
                      </td>
                      <td className="py-1 px-2">
                        <div className="flex gap-1">
                          <button onClick={() => save(m.id)} disabled={saving}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 disabled:opacity-50 transition-colors">
                            {saving ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors">×</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Read row */}
                      <td className={cn(cellCls)}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{m.display_name ?? "—"}</span>
                          {isMe && <span className="text-[9px] text-blue-400 font-semibold">(you)</span>}
                        </div>
                        <div className="text-[10px] text-muted">{m.id.slice(0, 12)}…</div>
                      </td>
                      <td className={cellCls}>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold"
                          style={{ color }}>
                          {symbol} {tier}
                        </span>
                      </td>
                      <td className={cn(cellCls, "text-muted text-xs")}>
                        {m.founding_member_number ? `#${String(m.founding_member_number).padStart(3, "0")}` : "—"}
                      </td>
                      <td className={cn(cellCls, "text-xs")}>
                        {m.token_founder || m.token_member ? (
                          <span className="text-foreground">
                            {m.token_founder ? <span className="text-amber-400">{m.token_founder}F</span> : null}
                            {m.token_founder && m.token_member ? " · " : ""}
                            {m.token_member ? <span className="text-blue-400">{m.token_member}M</span> : null}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className={cn(cellCls, "text-xs")}>
                        <span style={{ color: m.membership_status === "expired" ? "#ef4444" : m.membership_tier !== "free" ? "#10b981" : "#52525b" }}>
                          {m.membership_status ?? "free"}
                        </span>
                      </td>
                      <td className={cn(cellCls, "text-right")}>
                        {rowMsg ? (
                          <span className={cn("text-xs", rowMsg.ok ? "text-green-400" : "text-red-400")}>{rowMsg.text}</span>
                        ) : (
                          <div className="flex items-center gap-1 justify-end">
                            {/* Quick grant buttons for non-members */}
                            {(!m.membership_tier || m.membership_tier === "free") && (
                              <>
                                <button
                                  onClick={() => quickGrant(m, "founding")}
                                  disabled={saving}
                                  className="px-2 py-0.5 text-[10px] rounded border border-amber-700/40 text-amber-400 hover:bg-amber-900/20 transition-colors disabled:opacity-40"
                                  title="Grant Founding membership with 100 founder tokens">
                                  ✦ Grant
                                </button>
                                <button
                                  onClick={() => quickGrant(m, "annual")}
                                  disabled={saving}
                                  className="px-2 py-0.5 text-[10px] rounded border border-blue-700/40 text-blue-400 hover:bg-blue-900/20 transition-colors disabled:opacity-40"
                                  title="Grant Annual membership with 10 member tokens">
                                  ◈ Grant
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => startEdit(m)}
                              className="px-2 py-0.5 text-[10px] rounded border border-border-default text-muted hover:text-foreground hover:border-foreground transition-colors">
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted">
        Changes take effect immediately in Supabase. The member will see their new tier on next page load.
        Use &quot;Edit&quot; for full control · &quot;✦ Grant&quot; / &quot;◈ Grant&quot; for quick one-click membership.
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("brands")
  const { catalog, membership, authReady } = useLineageStore()

  // Redirect non-editors once auth state is confirmed
  useEffect(() => {
    if (!authReady) return
    if (!membership.is_editor) router.replace("/")
  }, [authReady, membership.is_editor, router])

  const counts: Record<Tab, number> = {
    brands:  catalog.orgs.filter((o) => o.org_type === "brand").length,
    boards:  catalog.boards.length,
    events:  catalog.events.length,
    places:  catalog.places.length,
    orgs:    catalog.orgs.length,
    series:  catalog.eventSeries.length,
    members: 0, // loaded async in MembersTable
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-widest">Data Editor</span>
            <span className="text-xs px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-400 rounded-full">Trusted contributors only</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Dataset Editor</h1>
          <p className="text-sm text-muted mt-1">
            Add and edit snowboarding history data. Click any row to edit it. Use &ldquo;Paste rows&rdquo; to bulk import from Google Sheets.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border-default">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative -mb-px",
                tab === id
                  ? "text-foreground border-b-2 border-blue-500"
                  : "text-muted hover:text-foreground"
              )}
            >
              {label}
              {id !== "members" && (
                <span className={cn(
                  "ml-1.5 text-[10px] tabular-nums px-1.5 py-0.5 rounded-full",
                  tab === id ? "bg-blue-600/30 text-blue-300" : "bg-surface text-muted"
                )}>
                  {counts[id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table content */}
        <div>
          {tab === "brands"  && <BrandsTable />}
          {tab === "boards"  && <BoardsTable />}
          {tab === "events"  && <EventsTable />}
          {tab === "places"  && <PlacesTable />}
          {tab === "orgs"    && <OrgsTable />}
          {tab === "series"  && <SeriesTable />}
          {tab === "members" && <MembersTable />}
        </div>

        {/* Footer hint */}
        <div className="mt-8 text-xs text-muted/50 text-center">
          Changes are saved immediately · Auth users sync to database · Click a row to edit · ✕ to delete
        </div>
      </div>
    </div>
  )
}
