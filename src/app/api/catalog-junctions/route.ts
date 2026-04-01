import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  const client = getServiceClient()
  if (!client) {
    return NextResponse.json({
      eventBrands: [], seriesBrands: [],
      communities: [],
      communityPeople: [], communityPlaces: [], communityOrgs: [],
      communityBoards: [], communityEvents: [],
    })
  }

  const [eb, esb, comm, cp, cpl, co, cb, ce] = await Promise.all([
    client.from("event_brands").select("event_id, org_id"),
    client.from("event_series_brands").select("series_id, org_id"),
    // Community data
    client.from("communities").select("*").order("sort_order"),
    client.from("community_people").select("community_id, person_id"),
    client.from("community_places").select("community_id, place_id"),
    client.from("community_orgs").select("community_id, org_id"),
    client.from("community_boards").select("community_id, board_id"),
    client.from("community_events").select("community_id, event_id"),
  ])

  return NextResponse.json({
    eventBrands: eb.data ?? [],
    seriesBrands: esb.data ?? [],
    communities: comm.data ?? [],
    communityPeople: cp.data ?? [],
    communityPlaces: cpl.data ?? [],
    communityOrgs: co.data ?? [],
    communityBoards: cb.data ?? [],
    communityEvents: ce.data ?? [],
  })
}
