"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

// Shared search-and-pick list, used by AddStoryModal's Links tab and the
// story card's Add Connections popover. Extracted unchanged from
// add-story-modal.tsx for Story Connections.

const inputCls =
  "w-full bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"

export function SearchPicker<T extends { id: string }>({
  items,
  selected,
  onToggle,
  getLabel,
  placeholder,
  single = false,
  onAddNew,
  addNewLabel,
}: {
  items: T[]
  selected: string[]
  onToggle: (id: string) => void
  getLabel: (item: T) => string
  placeholder: string
  single?: boolean
  onAddNew?: () => void
  addNewLabel?: string
}) {
  const [query, setQuery] = useState("")
  const filtered = items
    .filter((i) => getLabel(i).toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)
  const noResults = filtered.length === 0

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className={cn(inputCls, "mb-1.5")}
      />
      <div className="max-h-36 overflow-y-auto rounded-lg border border-border-default divide-y divide-border-default">
        {filtered.map((item) => {
          const isSelected = selected.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs transition-colors",
                isSelected
                  ? "bg-blue-500/10 text-blue-400"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              )}
            >
              {isSelected ? "✓ " : ""}{getLabel(item)}
            </button>
          )
        })}
        {noResults && (
          <div className="px-3 py-2 text-xs text-muted italic">
            {query ? "No matches" : "None yet"}
          </div>
        )}
        {onAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            className={cn(
              "w-full text-left px-3 py-2 text-xs transition-colors font-medium",
              noResults && query
                ? "text-blue-400 hover:bg-[#292524]/10"
                : "text-muted hover:text-blue-400 hover:bg-surface-hover"
            )}
          >
            + {addNewLabel ?? "Add new…"}
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map((id) => {
            const item = items.find((i) => i.id === id)
            if (!item) return null
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400"
              >
                {getLabel(item)}
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  className="hover:text-red-400 transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
