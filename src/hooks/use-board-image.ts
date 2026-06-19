"use client"

import { useState, useEffect } from "react"

const CACHE_KEY = "lineage_board_images_v1"
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

// ─── localStorage helpers ──────────────────────────────────────────────────────

type CacheEntry = { url: string | null; ts: number }
type CacheMap   = Record<string, CacheEntry>

function readCache(): CacheMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as CacheMap) : {}
  } catch { return {} }
}

function getCached(key: string): string | null | undefined {
  const entry = readCache()[key]
  if (!entry) return undefined // not in cache
  if (Date.now() - entry.ts > CACHE_TTL) return undefined // expired
  return entry.url // may be null (confirmed "no image found")
}

function setCached(key: string, url: string | null) {
  try {
    const cache = readCache()
    cache[key] = { url, ts: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* storage full or SSR */ }
}

/**
 * Drop every cached entry for a board (all keys begin with `${boardId}|`). Call
 * after a community image is added or removed on the board page so other
 * surfaces (brand index, catalog tiles, board shelf) re-fetch the current image
 * on their next mount instead of serving the 7-day-cached old URL.
 */
export function clearBoardImageCache(boardId: string) {
  if (!boardId) return
  try {
    const cache = readCache()
    let changed = false
    for (const key of Object.keys(cache)) {
      if (key.startsWith(`${boardId}|`)) {
        delete cache[key]
        changed = true
      }
    }
    if (changed) localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* storage error or SSR */ }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches an auto-searched thumbnail for a snowboard.
 *
 * Priority: community-suggested image (board_image_votes) > Serper search
 *
 * Returns:
 *   undefined  — still loading / not a board
 *   null       — searched, nothing found (or API not configured)
 *   string     — image URL
 */
export function useBoardImage(
  brand:   string | undefined,
  model:   string | undefined,
  year:    number | undefined,
  boardId: string | undefined = undefined,
): string | null | undefined {
  const [imageUrl, setImageUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    // The effect only does async work: resolve the cover (cache hit or network)
    // and set state from the promise callback. Setting state synchronously in the
    // effect body would cascade-render (react-hooks/set-state-in-effect). The
    // localStorage read stays in the effect, not in render, so the first paint
    // matches the SSR output (the server has no localStorage).
    async function resolve(): Promise<string | null> {
      if (!brand || !model) return null

      // Include boardId in the cache key so community suggestions are fetched
      // separately from the generic brand/model/year guess.
      const cacheKey = boardId
        ? `${boardId}|${brand}|${model}|${year ?? ""}`
        : `${brand}|${model}|${year ?? ""}`

      // Serve from cache immediately if available
      const cached = getCached(cacheKey)
      if (cached !== undefined) return cached

      // Fetch from API route
      const params = new URLSearchParams({ brand, model, year: String(year ?? "") })
      if (boardId) params.set("board_id", boardId)
      const res = await fetch(`/api/board-image?${params}`)
      const { url, unconfigured } = await res.json()
      const result = (url as string | null) ?? null
      // Don't cache when API isn't configured — retry on next load once keys are set
      if (!unconfigured) setCached(cacheKey, result)
      return result
    }

    resolve()
      .then((result) => { if (!cancelled) setImageUrl(result) })
      .catch(() => { if (!cancelled) setImageUrl(null) })

    return () => { cancelled = true }
  }, [brand, model, year, boardId])

  return imageUrl
}
