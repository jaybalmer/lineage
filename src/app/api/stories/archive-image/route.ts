import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
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

// POST /api/stories/archive-image
// Body: { url: string, story_id: string }
// Downloads the image and re-hosts it in Supabase Storage to prevent link rot.
export async function POST(req: NextRequest) {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  try {
    const { url, story_id } = await req.json()
    if (!url || !story_id) {
      return NextResponse.json({ error: "url and story_id required" }, { status: 400 })
    }

    // Validate URL -- block private IPs, non-https, etc.
    const urlCheck = validateFetchUrl(url)
    if (!urlCheck.valid) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 })
    }

    const fetchRes = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Lineage/1.0)",
        "Accept": "image/*,*/*;q=0.8",
      },
    })

    if (!fetchRes.ok) {
      return NextResponse.json({ error: `Fetch failed: ${fetchRes.status}` }, { status: 422 })
    }

    // Enforce content-type is an image
    const ct = fetchRes.headers.get("content-type") ?? ""
    let mimeType = ct.split(";")[0].trim().toLowerCase()
    if (!MIME_EXT[mimeType]) {
      const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? ""
      const extMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }
      const guessed = extMap[ext] ?? ""
      if (!guessed) return NextResponse.json({ error: "URL does not point to a supported image" }, { status: 422 })
      mimeType = guessed
    }

    // Enforce size limit
    const contentLength = parseInt(fetchRes.headers.get("content-length") ?? "0")
    if (contentLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 413 })
    }

    const imageBuffer = await fetchRes.arrayBuffer()
    if (imageBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 413 })
    }

    const ext = MIME_EXT[mimeType] ?? "jpg"
    const path = `${user.id}/${Date.now()}.${ext}`

    const supabase = getServiceClient()
    const { data, error } = await supabase.storage
      .from("story-images")
      .upload(path, imageBuffer, { contentType: mimeType, upsert: false })

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from("story-images")
      .getPublicUrl(data.path)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
