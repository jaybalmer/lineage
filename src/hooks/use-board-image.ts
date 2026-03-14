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

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches an auto-searched thumbnail for a snowboard.
 *
 * Returns:
 *   undefined  — still loading / not a board
 *   null       — searched, nothing found (or API not configured)
 *   string     — image URL
 */
export function useBoardImage(
  brand: string | undefined,
  model: string | undefined,
  year:  number | undefined,
): string | null | undefined {
  const [imageUrl, setImageUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!brand || !model) {
      setImageUrl(null)
      return
    }

    const cacheKey = `${brand}|${model}|${year ?? ""}`

    // Serve from cache immediately if available
    const cached = getCached(cacheKey)
    if (cached !== undefined) {
      setImageUrl(cached)
      return
    }

    // Fetch from API route
    const params = new URLSearchParams({ brand, model, year: String(year ?? "") })
    let cancelled = false

    fetch(`/api/board-image?${params}`)
      .then((r) => r.json())
      .then(({ url, unconfigured }) => {
        if (cancelled) return
        const result = (url as string | null) ?? null
        // Don't cache when API isn't configured — retry on next load once keys are set
        if (!unconfigured) setCached(cacheKey, result)
        setImageUrl(result)
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null)
      })

    return () => { cancelled = true }
  }, [brand, model, year])

  return imageUrl
}
