import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { validateFetchUrl } from "@/lib/url-validation"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const FETCH_TIMEOUT_MS = 12_000

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
}

const EXPIRY_CDN_PATTERNS = [
  /fbcdn\.net/,
  /cdninstagram\.com/,
  /scontent\./,
  /pbs\.twimg\.com/,
  /[?&]oe=/,
  /[?&]Expires=/i,
  /[?&]X-Amz-Expires=/i,
]

function isTemporaryUrl(url: string): boolean {
  return EXPIRY_CDN_PATTERNS.some((p) => p.test(url))
}

/**
 * POST /api/places/archive-image
 *
 * Downloads a submitted image URL and re-hosts it in Supabase Storage
 * (place-images bucket) so the URL is permanent.
 *
 * Body: { url: string, place_id: string }
 * Returns: { url: string, archived: boolean }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const sourceUrl: string = body?.url ?? ""
  const placeId:   string = body?.place_id ?? ""

  if (!sourceUrl || !placeId) {
    return NextResponse.json({ error: "url and place_id are required" }, { status: 400 })
  }

  let parsed: URL
  try { parsed = new URL(sourceUrl) } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Only http/https URLs allowed" }, { status: 400 })
  }

  const urlCheck = validateFetchUrl(sourceUrl)
  if (!urlCheck.valid) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 })
  }

  let imageBuffer: ArrayBuffer
  let mimeType: string

  try {
    const fetchRes = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Lineage/1.0)",
        "Accept": "image/*,*/*;q=0.8",
      },
    })

    if (!fetchRes.ok) {
      return NextResponse.json({ error: `Fetch failed: ${fetchRes.status}` }, { status: 422 })
    }

    const ct = fetchRes.headers.get("content-type") ?? ""
    mimeType = ct.split(";")[0].trim().toLowerCase()
    if (!MIME_EXT[mimeType]) {
      const ext = sourceUrl.split("?")[0].split(".").pop()?.toLowerCase()
      const guessed = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[ext ?? ""] ?? ""
      if (!guessed) return NextResponse.json({ error: "URL does not point to a supported image" }, { status: 422 })
      mimeType = guessed
    }

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
    if (!isTemporaryUrl(sourceUrl)) {
      return NextResponse.json({ url: sourceUrl, archived: false })
    }
    return NextResponse.json({ error: `Could not fetch image: ${msg}` }, { status: 422 })
  }

  const ext      = MIME_EXT[mimeType] ?? "jpg"
  const filename = `places/${placeId}/${user.id}-${Date.now()}.${ext}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("place-images")
    .upload(filename, imageBuffer, { contentType: mimeType, upsert: false })

  if (uploadError || !uploadData) {
    console.error("Storage upload error:", uploadError)
    return NextResponse.json({ url: sourceUrl, archived: false })
  }

  const { data: { publicUrl } } = supabase.storage.from("place-images").getPublicUrl(uploadData.path)

  return NextResponse.json({ url: publicUrl, archived: true })
}
