import { NextRequest, NextResponse } from "next/server"
import { readEpisodeCards } from "@/lib/episode-cards-server"

// GET /api/episodes?show=<orgId>   live episode cards for a show (brand page)
// GET /api/episodes?guest=<personId> live episode cards a person guested on
//
// Public read. Only live episodes with a published page are returned (see
// readEpisodeCards), so nothing here is more visible than /t/{episode} itself.

export async function GET(req: NextRequest) {
  const show = req.nextUrl.searchParams.get("show")
  const guest = req.nextUrl.searchParams.get("guest")
  if (!show && !guest) {
    return NextResponse.json({ error: "show or guest is required" }, { status: 400 })
  }
  const cards = await readEpisodeCards(show ? { showOrgId: show } : { guestId: guest! })
  return NextResponse.json(cards)
}
