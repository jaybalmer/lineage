import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Stripe is not yet configured." },
      { status: 503 }
    )
  }

  const { customerId } = await req.json().catch(() => ({})) as { customerId?: string }
  if (!customerId) {
    return NextResponse.json({ error: "Missing customerId." }, { status: 400 })
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
