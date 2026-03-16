import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

// Supabase admin client (bypasses RLS)
function adminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

// Token grants per tier on purchase
const INITIAL_TOKENS: Record<string, { founder: number; member: number }> = {
  annual:   { founder: 0, member: 10 },
  lifetime: { founder: 0, member: 30 },
  founding: { founder: 100, member: 0 },
}

function tierFromMetadata(meta: Record<string, string>): string {
  return meta.tier ?? "annual"
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }

  const stripe = new Stripe(stripeKey)
  const body = await req.text()
  const sig  = req.headers.get("stripe-signature") ?? ""

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook signature error"
    console.error("Stripe webhook:", msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const db = adminClient()

  switch (event.type) {

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id ?? session.metadata?.userId
      if (!userId) break

      const tier = tierFromMetadata((session.metadata as Record<string, string>) ?? {})
      const tokens = INITIAL_TOKENS[tier] ?? { founder: 0, member: 0 }

      // Handle gift: generate a single-use gift code
      if (session.metadata?.isGift === "true") {
        const giftCode = `GIFT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
        await db.from("gift_codes").insert({
          code:      giftCode,
          gifted_by: userId,
          status:    "unused",
        })
        // TODO: email the gift code to the purchaser via Resend
        break
      }

      // For founding tier: assign sequential member number
      let foundingMemberNumber: number | null = null
      if (tier === "founding") {
        const { count } = await db.from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("membership_tier", "founding")
        foundingMemberNumber = (count ?? 0) + 1
      }

      // Update membership in profiles table
      await db.from("profiles").update({
        membership_tier:         tier,
        membership_status:       "active",
        founding_badge:          tier === "founding",
        founding_member_number:  foundingMemberNumber,
        token_founder:           tokens.founder,
        token_member:            tokens.member,
        stripe_customer_id:      session.customer as string,
        stripe_subscription_id:  (session.subscription as string) ?? null,
        membership_expires_at:   tier === "annual"
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      }).eq("id", userId)

      // Log token grant event
      if (tokens.founder > 0 || tokens.member > 0) {
        await db.from("token_events").insert({
          user_id:    userId,
          token_type: tier === "founding" ? "founder" : "member",
          amount:     tokens.founder > 0 ? tokens.founder : tokens.member,
          source:     `${tier}_membership_purchase`,
        })
      }
      break
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      // Lapse membership — freeze tokens (don't delete them)
      await db.from("profiles").update({
        membership_status: "expired",
      }).eq("stripe_subscription_id", sub.id)
      break
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      if (sub.status === "active") {
        const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
        await db.from("profiles").update({
          membership_status: "active",
          ...(periodEnd ? { membership_expires_at: new Date(periodEnd * 1000).toISOString() } : {}),
        }).eq("stripe_subscription_id", sub.id)
      }
      break
    }

    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice
      const subscriptionId = (inv as unknown as { subscription?: string }).subscription
      if (!subscriptionId) break
      // Annual renewal: grant 10 new member tokens
      const { data: profile } = await db.from("profiles")
        .select("id, token_member")
        .eq("stripe_subscription_id", subscriptionId)
        .single()
      if (profile) {
        await db.from("profiles").update({
          token_member: (profile.token_member ?? 0) + 10,
          membership_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        }).eq("id", profile.id)
        await db.from("token_events").insert({
          user_id:    profile.id,
          token_type: "member",
          amount:     10,
          source:     "annual_renewal",
        })
      }
      break
    }

    case "invoice.payment_failed": {
      // Grace period handled by Stripe (3 retries over 3 days by default)
      // After Stripe marks the sub as past_due → cancelled → subscription.deleted fires
      console.log("invoice.payment_failed — Stripe will retry automatically")
      break
    }
  }

  return NextResponse.json({ received: true })
}
