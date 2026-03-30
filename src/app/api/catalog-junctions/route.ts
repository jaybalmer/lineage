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
    return NextResponse.json({ eventBrands: [], seriesBrands: [] })
  }

  const [eb, esb] = await Promise.all([
    client.from("event_brands").select("event_id, org_id"),
    client.from("event_series_brands").select("series_id, org_id"),
  ])

  return NextResponse.json({
    eventBrands: eb.data ?? [],
    seriesBrands: esb.data ?? [],
  })
}
