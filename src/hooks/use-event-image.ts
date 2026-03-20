"use client"

import { useState, useEffect } from "react"

const CACHE_KEY = "lineage_event_images_v1"
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

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
  if (!entry) return undefined
  if (Date.now() - entry.ts > CACHE_TTL) return undefined
  return entry.url
}

function setCached(key: string, url: string | null) {
  try {
    const cache = readCache()
    cache[key] = { url, ts: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* storage full or SSR */ }
}

/**
 * Fetches the community-suggested photo for an event.
 *
 * Returns:
 *   undefined  — still loading
 *   null       — no community photo found
 *   string     — image URL
 */
export function useEventImage(eventId: string | undefined): string | null | undefined {
  const [imageUrl, setImageUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!eventId) {
      setImageUrl(null)
      return
    }

    const cached = getCached(eventId)
    if (cached !== undefined) {
      setImageUrl(cached)
      return
    }

    let cancelled = false

    fetch(`/api/event-image?event_id=${encodeURIComponent(eventId)}`)
      .then((r) => r.json())
      .then(({ url }) => {
        if (cancelled) return
        const result = (url as string | null) ?? null
        setCached(eventId, result)
        setImageUrl(result)
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null)
      })

    return () => { cancelled = true }
  }, [eventId])

  return imageUrl
}
