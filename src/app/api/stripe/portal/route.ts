import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { requireAuth, getServiceClient } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Stripe is not yet configured." },
      { status: 503 }
    )
  }

  // Look up the user's Stripe customer ID from their profile
  const supabase = getServiceClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single()

  const customerId = profile?.stripe_customer_id
  if (!customerId) {
    return NextResponse.json({ error: "No billing account found." }, { status: 404 })
  }

  const stripe = new Stripe(stripeKey)
  const origin = req.headers.get("origin") ?? "https://lineage.wtf"

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${origin}/account/membership`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Portal error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
