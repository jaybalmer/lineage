import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { requireAuth } from "@/lib/auth"
import { captureServerEvent } from "@/lib/analytics-server"

const PRICE_IDS: Record<string, string | undefined> = {
  annual:     process.env.STRIPE_PRICE_ANNUAL,
  lifetime:   process.env.STRIPE_PRICE_LIFETIME,
  founding:   process.env.STRIPE_PRICE_FOUNDING,
  gift_annual: process.env.STRIPE_PRICE_GIFT_ANNUAL,
}

export async function POST(req: NextRequest) {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Stripe is not yet configured. Add STRIPE_SECRET_KEY to your Vercel environment variables." },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { tier } = body as { tier?: string }

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

  const origin = req.headers.get("origin") ?? "https://linestry.com"

  try {
    const isRecurring = tier === "annual"

    const session = await stripe.checkout.sessions.create({
      mode: isRecurring ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        tier,
        userId: user.id,
        isGift: tier === "gift_annual" ? "true" : "false",
      },
      // For founding tier: enforce 500-unit cap at app layer (Stripe inventory is backup)
      success_url: `${origin}/welcome?tier=${tier}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/membership`,
      client_reference_id: user.id,
    })

    // Commerce events ride the existing 'content' category with a domain prop
    // (D4); a real 'commerce' category is a follow-up migration. Awaited: the
    // handler ends in a JSON return.
    await captureServerEvent({
      category: "content",
      event: "checkout_started",
      actorId: user.id,
      props: { domain: "commerce", tier, is_gift: tier === "gift_annual" },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
