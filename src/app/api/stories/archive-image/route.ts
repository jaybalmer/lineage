import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/stories/archive-image
// Body: { url: string, story_id: string }
// Downloads the image and re-hosts it in Supabase Storage to prevent link rot.
export async function POST(req: NextRequest) {
  try {
    const { url, story_id } = await req.json()
    if (!url || !story_id) {
      return NextResponse.json({ error: "url and story_id required" }, { status: 400 })
    }

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)

    const contentType = res.headers.get("content-type") ?? "image/jpeg"
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg"
    const blob = await res.blob()
    const arrayBuffer = await blob.arrayBuffer()

    const path = `${story_id}/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from("story-images")
      .upload(path, arrayBuffer, { contentType, upsert: false })

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from("story-images")
      .getPublicUrl(data.path)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
