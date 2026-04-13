import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { validateFetchUrl } from "@/lib/url-validation"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const FETCH_TIMEOUT_MS = 12_000

// MIME type → file extension
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
}

// Known CDN domains that use expiry tokens (Facebook, Instagram, Twitter, etc.)
// Images from these sources are always archived to permanent storage.
const EXPIRY_CDN_PATTERNS = [
  /fbcdn\.net/,
  /cdninstagram\.com/,
  /scontent\./,
  /pbs\.twimg\.com/,
  /[?&]oe=/,        // Facebook/Instagram "object expiry" query param
  /[?&]Expires=/i,  // AWS S3 signed URLs
  /[?&]X-Amz-Expires=/i,
]

function isTemporaryUrl(url: string): boolean {
  return EXPIRY_CDN_PATTERNS.some((p) => p.test(url))
}

/**
 * POST /api/boards/archive-image
 *
 * Downloads a submitted image URL and re-hosts it in Supabase Storage
 * so the image URL is permanent regardless of the original source.
 *
 * Body: { url: string, board_id: string }
 * Returns: { url: string, archived: boolean }
 *   url      — the permanent storage URL (or original URL if archival failed)
 *   archived — true if the image was uploaded to storage
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const sourceUrl: string = body?.url ?? ""
  const boardId:   string = body?.board_id ?? ""

  if (!sourceUrl || !boardId) {
    return NextResponse.json({ error: "url and board_id are required" }, { status: 400 })
  }

  // Validate URL format
  let parsed: URL
  try { parsed = new URL(sourceUrl) } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Only http/https URLs allowed" }, { status: 400 })
  }

  // Block private/reserved IPs (SSRF protection)
  const urlCheck = validateFetchUrl(sourceUrl)
  if (!urlCheck.valid) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 })
  }

  // ── Fetch the image ────────────────────────────────────────────────────────
  let imageBuffer: ArrayBuffer
  let mimeType: string

  try {
    const fetchRes = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Mimic a browser so CDNs don't block us
        "User-Agent": "Mozilla/5.0 (compatible; Lineage/1.0)",
        "Accept": "image/*,*/*;q=0.8",
      },
    })

    if (!fetchRes.ok) {
      return NextResponse.json({ error: `Fetch failed: ${fetchRes.status}` }, { status: 422 })
    }

    // Enforce content-type is an image
    const ct = fetchRes.headers.get("content-type") ?? ""
    mimeType = ct.split(";")[0].trim().toLowerCase()
    if (!MIME_EXT[mimeType]) {
      // Fallback: guess from URL extension
      const ext = sourceUrl.split("?")[0].split(".").pop()?.toLowerCase()
      const guessed = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[ext ?? ""] ?? ""
      if (!guessed) return NextResponse.json({ error: "URL does not point to a supported image" }, { status: 422 })
      mimeType = guessed
    }

    // Enforce size limit (stream check via Content-Length, then full read)
    const contentLength = parseInt(fetchRes.headers.get("content-length") ?? "0")
    if (contentLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 413 })
    }

    imageBuffer = await fetchRes.arrayBuffer()
    if (imageBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 413 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fetch error"
    // If fetch failed but URL isn't a known-expiry CDN, return original URL
    if (!isTemporaryUrl(sourceUrl)) {
      return NextResponse.json({ url: sourceUrl, archived: false })
    }
    return NextResponse.json({ error: `Could not fetch image: ${msg}` }, { status: 422 })
  }

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const ext      = MIME_EXT[mimeType] ?? "jpg"
  const filename = `boards/${boardId}/${user.id}-${Date.now()}.${ext}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("board-images")
    .upload(filename, imageBuffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError || !uploadData) {
    console.error("Storage upload error:", uploadError)
    // Archival failed — return original URL as fallback so the UX still works
    return NextResponse.json({ url: sourceUrl, archived: false })
  }

  const { data: { publicUrl } } = supabase.storage
    .from("board-images")
    .getPublicUrl(uploadData.path)

  return NextResponse.json({ url: publicUrl, archived: true })
}
