import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

const PRICE_IDS: Record<string, string | undefined> = {
  annual:     process.env.STRIPE_PRICE_ANNUAL,
  lifetime:   process.env.STRIPE_PRICE_LIFETIME,
  founding:   process.env.STRIPE_PRICE_FOUNDING,
  gift_annual: process.env.STRIPE_PRICE_GIFT_ANNUAL,
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Stripe is not yet configured. Add STRIPE_SECRET_KEY to your Vercel environment variables." },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { tier, userId } = body as { tier?: string; userId?: string }

  if (!tier || !PRICE_IDS[tier]) {
    return NextResponse.json({ error: "Invalid tier." }, { status: 400 })
  }

  const priceId = PRICE_IDS[tier]
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price ID for '${tier}' is not configured. Add STRIPE_PRICE_${tier.toUpperCase()} to your environment variables.` },
      { status: 503 }
    )
  }

  const stripe = new Stripe(stripeKey)

  const origin = req.headers.get("origin") ?? "https://lineage.wtf"

  try {
    const isRecurring = tier === "annual"

    const session = await stripe.checkout.sessions.create({
      mode: isRecurring ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        tier,
        userId: userId ?? "",
        isGift: tier === "gift_annual" ? "true" : "false",
      },
      // For founding tier: enforce 500-unit cap at app layer (Stripe inventory is backup)
      success_url: `${origin}/account/membership?success=true&tier=${tier}`,
      cancel_url:  `${origin}/membership`,
      ...(userId && { client_reference_id: userId }),
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
