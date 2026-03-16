# Lineage — Membership System Implementation Brief

**Project:** lineage.wtf  
**Feature:** Community Membership & Revenue Sharing  
**Prepared for:** Claude Code  
**Version:** 1.0

---

## 1. Overview

Lineage is a community-owned timeline platform for snowboarders (and eventually other communities). The membership system is central to the platform's sustainability and community ownership model.

**Core framing:** Membership is community ownership, not a subscription. Members are verified co-owners of the community's history — with a voice (governance), a role (verification), and a share (revenue).

**Revenue goal:** $1 average revenue per user across the full user base. Paying members subsidise the free tier, which is essential for database growth.

---

## 2. Membership Tiers

### Tier 1 — Rider (Free)
- **Price:** $0, forever
- **Purpose:** Full participation in building the collective history. No crippled experience.
- **Benefits:**
  - Personal snowboard timeline (boards, events, resorts, brands, people)
  - Browse collective community history
  - Connection finder (discover shared touchpoints with other riders)
  - Add entries and upload artifacts
  - Earn contribution tokens (see Section 4)

### Tier 2 — Member (Annual)
- **Price:** $25 / year
- **Purpose:** Verified community co-owner. Recurring revenue backbone.
- **Benefits:**
  - Everything in Rider
  - **Verify entries** — can confirm/validate timeline entries made by others
  - **Community governance** — voting rights on proposals
  - **Revenue share** — quarterly distribution from community pool
  - Member badge on public profile
  - 10 member tokens per year (see Section 4)

### Tier 3 — Member (Lifetime)
- **Price:** $75 one-time
- **Purpose:** Best long-term value for committed community members.
- **Benefits:**
  - Everything in Annual Member
  - 30 tokens upfront (equivalent to 3 years)
  - +10 tokens every subsequent year
  - Lifetime member badge (distinct from annual)

### Tier 4 — Founding Member (Limited)
- **Price:** $100 one-time
- **Availability:** 500 spots only. Once sold out or 12 months post-launch — whichever comes first — this tier closes permanently.
- **Purpose:** Early-revenue accelerator and community anchor. Rewards those who took a chance on the platform before it proved itself.
- **Benefits:**
  - Everything in Lifetime Member
  - **Permanent founding badge** — never goes away, even when tier closes
  - **100 tokens at 2× weight** in revenue distributions (see Section 4)
  - **1 annual membership to gift** to another rider (included in $100)
  - Priority in governance proposals
  - First access when Lineage expands to new communities
  - Listed in the permanent founding members registry

> **Gift mechanic:** Founding members receive one annual membership code to gift. Additional annual memberships can be purchased at $25 each for gifting. Gifted memberships count fully toward the receiver's status. Giver receives a "Community Patron" badge for each gifted membership. This allows high-engagement founders to seed memberships in their network.

---

## 3. Token Model

Tokens are internal community credits. They are **not** tradeable externally, not securities. Utility expands as the platform grows.

### Token Types

| Token | Earners | Amount | Weight |
|---|---|---|---|
| **Founder token** | Founding members | 100 on purchase, +10/yr | 2× in distributions |
| **Member token** | Annual + Lifetime members | 10/yr (Lifetime: 30 upfront + 10/yr) | 1× |
| **Contribution token** | All users including free | Earned by activity (see below) | 1× |

### Earning Contribution Tokens (Free + Paid)
Contribution tokens give free riders a path to revenue share and incentivise data quality.

- Adding a new timeline entry: **+1 token**
- Entry is verified by 3+ members: **+2 bonus tokens** to the original submitter
- Verifying another rider's entry (members only): **+1 token per verification**
- Uploading a media artifact (photo, video, scan): **+1 token**
- Linking an entry to an authoritative external source: **+2 tokens**
- Onboarding a new user who becomes active: **+5 tokens**

### Token Snapshot
Tokens are non-transferable and tied to accounts. Balance snapshots are taken at the start of each quarter for distribution calculation. Tokens do not expire but accumulate over time.

---

## 4. Revenue Sharing Model

### Community Revenue Pool

20% of all net platform revenue flows into the quarterly community pool.

**Revenue sources contributing to the pool:**

| Source | Target % of revenue mix |
|---|---|
| Memberships (annual + lifetime) | ~30% |
| Brand sponsorships & partnerships | ~30% |
| Marketplace commissions (events, gear, travel) | ~20% |
| Dataset licensing & data partnerships | ~20% |

> Note: "Net revenue" = gross revenue minus payment processing fees and direct costs. Platform operating costs (team, infrastructure) are covered from the 80% retained.

### Distribution Formula

Each quarter:

1. **Pool closes** — Net revenue for the quarter is tallied. 20% is set aside.
2. **Token snapshot** — Every holder's balance is recorded. Founder tokens are multiplied by 2 for weighting.
3. **Share calculation** — Each holder's share = their weighted tokens ÷ total weighted tokens in circulation.
4. **Payout** — Distributed to all eligible token holders. Minimum payout threshold: **$5**. Sub-threshold amounts roll forward to next quarter.

**Formula:**
```
weighted_tokens_holder = tokens × weight_multiplier
share = weighted_tokens_holder / sum(all weighted_tokens)
payout = share × pool_total
```

### Example Distribution

Assume $5,000 quarterly pool, ~2,600 total weighted tokens in circulation:

| Member type | Tokens held | Weighted | Pool share | Earns |
|---|---|---|---|---|
| Founding member | 100 (2×) | 200 pts | 7.7% | ~$385 |
| Lifetime member yr 1 | 30 (1×) | 30 pts | 1.15% | ~$57.70 |
| Annual member | 10 (1×) | 10 pts | 0.38% | ~$19.20 |
| Active free rider | 5 contrib. (1×) | 5 pts | 0.19% | ~$9.60 |

> At early scale, individual payouts will be modest. The pitch to early members is a stake in something growing — not immediate income. As brand sponsorships and dataset licensing mature, the pool grows without requiring more members.

---

## 5. UI Placements

### 5.1 Navigation — Keep it clean

**Do not add a "Membership" item to the main nav.** The main nav should stay focused on core product navigation (Timeline, Explore, Connections, Profile). Membership is discoverable but not pushed.

**Instead, surface membership in two low-friction nav locations:**

**A) User menu / account dropdown**  
For non-members, add a subtle line item at the bottom of the user dropdown:
```
◯  Jay Balmer
   My Timeline
   Settings
   ───────────
   Become a member →       ← only visible to non-members
```
For members, replace with their status and token balance:
```
◯  Jay Balmer  [MEMBER]
   My Timeline
   Settings
   ───────────
   50 tokens  ·  Revenue share active
```

**B) Profile avatar area (desktop)**  
For logged-in non-members, a very small, unobtrusive text link `"Member?"` next to the avatar in the top-right. Disappears once they're a member. On mobile, omit entirely — rely on user menu.

---

### 5.2 Dedicated Membership Page — `/membership`

This is the primary conversion page. All CTAs across the product link here.

**Page structure:**

```
/membership

[ Hero ]
  Headline: "Own a piece of snowboarding's history"
  Subhead: "Lineage is community-owned. Members verify the record,
            vote on the platform, and share in what we build together."
  CTA: "See membership options ↓"

[ Founding member banner — only while spots remain ]
  "X founding spots remaining · closes when full"
  [ Claim founding membership → ]

[ Tier comparison — 4 columns ]
  Rider / Annual Member / Lifetime Member / Founding Member
  (all benefits listed, pricing, CTAs)

[ Revenue sharing explainer — link to /revenue ]
  Short 3-sentence summary + "How revenue sharing works →"

[ Founding member registry preview ]
  "Meet the first 500 people who built this"
  List of founding members (name, avatar, joined date) — paginated

[ Gift a membership ]
  "Know someone who belongs here?"
  Explain gift mechanic, CTA to gift annual membership ($25)

[ FAQ ]
  - What does verification mean?
  - How often is revenue distributed?
  - What happens to my tokens if I cancel annual?
  - What is a founding member?
  - When does the founding tier close?
```

---

### 5.3 Revenue Distribution Page — `/revenue`

Standalone page explaining the model clearly. Linked from `/membership` and from the member dashboard. Non-members can read it — it should be persuasive without being salesy.

**Page structure:**

```
/revenue

[ Header ]
  "How revenue sharing works"
  Subhead: "20% of everything Lineage earns flows back to the community
            that built it. Here's exactly how."

[ Section 1: Where the money comes from ]
  Visual breakdown of revenue sources:
  - Memberships (30%)
  - Brand partnerships (30%)
  - Marketplace (20%)
  - Dataset licensing (20%)
  Note: "We never sell personal data. Revenue comes from utility, 
         not surveillance."

[ Section 2: The community pool ]
  "Every quarter, 20% of net revenue is set aside.
   The remainder covers operations, team, and platform investment."
  Simple diagram: Total revenue → 80% operations / 20% community pool

[ Section 3: Tokens — how your share is calculated ]
  Table of token types, how they're earned, their weight
  Formula shown plainly:
  "Your share = your tokens ÷ total tokens in circulation"
  Callout: "Contribution tokens mean even free riders earn a share 
            by building the database."

[ Section 4: Live example ]
  Interactive calculator (or static example):
  "If the quarterly pool is $X and you hold Y tokens..."
  Show sample payout for each tier

[ Section 5: Distribution mechanics ]
  - Quarterly schedule (Jan / Apr / Jul / Oct)
  - $5 minimum threshold — sub-threshold rolls forward
  - How payouts are sent (platform credit initially, cash-out option TBD)

[ Section 6: What tokens will do as we grow ]
  Phase 1 (now): Revenue share weight + governance voting
  Phase 2: Marketplace discounts, brand sponsorship access, event priority
  Phase 3: Cross-community portability when new communities launch

[ Footer CTA ]
  "Become a member to start earning your share →"
```

---

### 5.4 Profile Page — Member Status Display

**Own profile (non-member):**  
Small tasteful prompt below the profile stats section:
```
[  You've added 12 entries to the collective history.
   Become a member to verify entries and earn from your contributions.
   Learn more →  ]
```
Shown only on the user's own profile. Never shown on other riders' profiles.

**Own profile (member):**  
Badge displayed prominently near the name:
- Annual: `[MEMBER]` dark navy pill
- Lifetime: `[LIFETIME MEMBER]` dark navy pill  
- Founding: `[FOUNDING MEMBER ✦]` amber/gold pill — permanent

Token balance and revenue share status visible in a small stats row:
```
  42 tokens  ·  Next distribution: April 2026  ·  Est. $12.40
```

**Other riders' profiles:**  
Only the badge is shown — no token/revenue data. Badges signal trust and commitment to the community.

---

### 5.5 Collective History / Entry View

Every verified timeline entry shows:
```
✓ Verified by 3 members
```
Clicking the verified indicator shows a small popover: the names/badges of the verifying members.

For non-members who try to click **"Verify this entry"**:  
→ Trigger the **verification gate modal** (see Section 6.3)

---

### 5.6 Founding Member Registry — `/founding`

A dedicated page listing all founding members. Accessible from `/membership`.

```
/founding

"The first 500"
Subtitle: "These are the people who believed in Lineage before 
           it was proven. Their names are part of the record."

[ X / 500 spots filled ]  [ progress bar ]

[ Grid of founding member cards ]
  - Avatar
  - Name
  - Member since [date]
  - Short bio or tagline (optional, user-set)

[ CTA if spots remain ]
  "Claim your founding spot →"

[ If sold out ]
  "The founding era is closed. Annual and lifetime 
   memberships are still available."
```

---

## 6. Trigger Moments

Membership prompts should feel **earned and contextual**, never interruptive. The principle: show the right prompt at the peak emotional moment, then get out of the way.

### 6.1 End of Onboarding — Soft Introduce

**When:** Immediately after a new user completes their initial timeline setup.  
**Type:** Dismissable banner at the bottom of the "Your timeline is live" screen.  
**Tone:** Celebratory, not salesy.

```
Banner content:
"Your timeline is live. You're part of 40 years of snowboarding history."
[  Explore your connections  ]   [  Learn about membership  →  ]
```

Rules:
- Do not show if user is already a member
- Dismissable — one tap/click closes it permanently for that user
- Only shown once, on first timeline completion
- "Learn about membership" links to `/membership`

---

### 6.2 First Connection Found — Peak Moment (Highest Priority)

**When:** The first time the connection finder surfaces a shared touchpoint with another rider.  
**Type:** Connection modal (already exists) — add a secondary CTA within it.  
**Tone:** Relational, exciting.

```
[ Existing connection modal content ]
  "You and Marcus both rode at Whistler in '98
   and had Morrow boards that season."

[ New secondary section at bottom of modal ]
  ─────────────────────────────────────────
  "Connections like this get stronger when they're verified.
   Members can confirm shared moments and link your histories."
  [ Become a member → ]   [ Maybe later ]
```

Rules:
- Only shown on the **first** connection discovery per user
- Secondary CTA is visually subordinate — the connection itself is the hero
- "Maybe later" permanently dismisses the CTA from this modal (not from all membership prompts)
- If user is already a member, do not show the secondary section

---

### 6.3 Verification Gate — Natural Feature Gate

**When:** A non-member clicks "Verify this entry" on any timeline entry.  
**Type:** Modal (blocks the verification action).  
**Tone:** Explanatory, not punitive.

```
Modal: "Verification builds our collective record"

  Verifying entries is how we keep the history trustworthy.
  It's a responsibility — and a recognition that you were there.

  Members can verify entries and earn contribution tokens.
  This is the only feature behind membership.

  [ Become a member — $25/year ]
  [ Learn more about membership ]
  [ Not right now ]
```

Rules:
- Show for any non-member verification attempt
- "Not right now" closes modal and restores normal view
- Do not show this modal more than once per session — if already dismissed this session, silently show a small tooltip: "Members can verify entries" on hover of the button
- After becoming a member, verification works immediately — no page reload required

---

### 6.4 Contribution Milestone — Invested User

**When:** User adds their 5th entry to the collective history.  
**Type:** Inline card on the user's own profile page (not a modal, not a popup).  
**Tone:** Acknowledging, informational.

```
Profile card (appears between stats and timeline):

  "You've added 5 entries to the collective history."
  Your contributions are making the record more complete.
  Members earn tokens for every verified entry — including these.
  [ What is membership? → ]
```

Rules:
- Show only on own profile, only for non-members
- Shown after 5 entries, again after 20 entries (updated copy: "20 entries")
- Manually dismissable
- Clicking CTA goes to `/membership`

---

### 6.5 Monthly Digest — Email + In-App

**When:** 30 days after signup (and monthly thereafter).  
**Type:** Email digest + in-app notification.  
**Tone:** Personal recap with light membership mention at the end.

```
Email subject: "Your Lineage — March 2026"

Body:
  This month, your timeline grew by [X] entries.
  You share touchpoints with [Y] other riders.
  The community verified [Z] moments in March.

  [Personalised highlight: e.g. "Your 1997 Westbeach Classic 
   entry was viewed 14 times this month."]

  ─────────────────────────────────────
  Founding membership · [X] spots remain
  Become a founding member and own a piece of the history 
  you're helping build.
  lineage.wtf/membership
```

Rules:
- Include the membership mention only in the first 3 monthly digests for non-members
- After 3 digests without conversion, drop the membership mention — don't spam
- If user is a member, replace with their token balance and next distribution date
- The founding spot count should be live/accurate at send time

---

### 6.6 Founding Scarcity — Persistent Low-Key Counter

**When:** While founding spots remain.  
**Type:** Small static indicator on `/membership` page and `/founding` page — not a popup.

```
  Founding members: ███████████░░  487 / 500
  [ Claim your spot — $100 →  ]
```

Rules:
- Update in real-time (or near-real-time) as spots are claimed
- When last 50 spots remain: add subtle urgency indicator ("50 spots remaining")
- When last 10 spots remain: surface in the monthly email digest for all non-members regardless of suppression rule
- When sold out: replace with "The founding era is closed" — do not hide the registry

---

## 7. Technical Notes for Implementation

### Token Storage
- Tokens are stored server-side, tied to user accounts
- Token type (founder / member / contribution) must be tracked separately as they have different weights and earning rules
- Log all token-earning events with source, timestamp, and associated entry/action ID for auditability

### Distribution Engine
- Runs quarterly (January, April, July, October — first week of month)
- Snapshot taken on the last day of the quarter at 23:59 UTC
- Minimum payout: $5 — sub-threshold balance carries forward, never expires
- Distribution log must be publicly visible (transparency is core to community trust) — publish summary at `/revenue/distributions`

### Founding Tier Gating
- Hard cap at 500. Once 500 is reached, founding tier purchase flow should be unavailable immediately
- Gift code flow: when a founding member purchases, generate one unique single-use gift code. Store against their account. Allow them to share or redeem via `/gift/[code]`
- Founding badge should be stored as a permanent attribute — not derived from membership status — so it persists even if the account lapses in some future scenario

### Membership State
Track these states per user:
```
membership_tier: 'free' | 'annual' | 'lifetime' | 'founding'
membership_status: 'active' | 'expired' | 'gifted'
founding_badge: boolean  (permanent once earned)
token_balance: { founder: int, member: int, contribution: int }
gift_codes: [ { code: string, status: 'unused' | 'redeemed', redeemed_by: user_id | null } ]
```

### Trigger Moment Suppression
- Track which trigger moments have been shown per user
- Store in user preferences: `{ onboarding_banner_shown, first_connection_cta_shown, verification_gate_count, milestone_card_dismissed, digest_membership_mentions: int }`
- Do not re-trigger dismissed or seen moments (except scarcity escalation at 10 spots)

### Revenue Distribution Page
- `/revenue` page should be publicly accessible (no login required)
- The live example calculator on `/revenue` should use real current token circulation numbers (or clearly labelled approximations during beta)
- `/revenue/distributions` — public log of past quarterly distributions (aggregate totals, not individual payouts)

---

## 8. Copy & Tone Guidelines

**Framing to use:**
- "Community ownership" not "subscription"
- "Co-owner" not "subscriber" or "customer"
- "Your share" not "cashback" or "rewards"
- "Verified member" not "paid member" or "premium user"
- "Founding era" not "early access" or "pre-launch"

**Framing to avoid:**
- Never describe free users as having a "limited" or "basic" experience — they have full access to the product
- Never describe membership as "unlocking" features — the only gate is entry verification, and it's framed as responsibility not restriction
- Avoid urgency manipulation — founding scarcity is real and should be communicated factually, not with countdown pressure tactics

---

## 9. Pages Summary

| Page | Route | Auth required | Priority |
|---|---|---|---|
| Membership overview | `/membership` | No | P0 |
| Revenue sharing explainer | `/revenue` | No | P0 |
| Founding member registry | `/founding` | No | P1 |
| Past distributions log | `/revenue/distributions` | No | P2 |
| Gift redemption | `/gift/[code]` | Yes (receiver) | P1 |
| Member dashboard (tokens, status) | `/account/membership` | Yes | P1 |

---

## 10. Implementation Decisions

All questions resolved. Build to these specs.

1. **Payment processor — Stripe**
   Set up Stripe from scratch. Use Stripe Checkout for one-time payments (lifetime, founding) and Stripe Billing / Subscriptions for annual memberships. Use Stripe's built-in customer portal for self-serve cancellation. Store `stripe_customer_id` and `stripe_subscription_id` on the user record.

2. **Distribution payout — Platform credit only (v1)**
   Revenue share distributions are issued as platform credit, spendable in the Lineage marketplace (events, gear, travel). Cash-out (PayPal / bank transfer) is a future option — do not build it now but design the distribution ledger so it can be extended. Display credit balance prominently in the member dashboard at `/account/membership`.

3. **Annual renewal — Auto-renew with easy cancel**
   Annual memberships auto-renew via Stripe Billing. Send a renewal reminder email 7 days before charge. Cancellation must be reachable in 2 clicks from the member dashboard — link directly to Stripe customer portal. On cancellation: membership stays active until end of paid period, then lapses (tokens freeze per decision 4).

4. **Token behaviour on lapse — Freeze**
   When an annual membership lapses (non-renewal or cancellation), member tokens are frozen: the existing balance is preserved and remains eligible for quarterly distributions, but no new member tokens are earned until membership is renewed. Contribution tokens continue to accumulate regardless of membership status. Frozen token state should be clearly communicated in the member dashboard: "Your membership has lapsed. Your 40 tokens are preserved — renew to start earning again."

5. **Revenue share eligibility — Paid membership required**
   Contribution tokens accumulate for all users including free riders, but **revenue share distributions require at least 1 active member or founder token**. Free riders build up their contribution token balance so they have a head-start the moment they become members — this should be communicated as an incentive. Update contribution token earn screens to include: "These tokens count toward your revenue share when you become a member." Do not distribute to contribution-only (free) accounts.

---

## 11. Stripe Integration Checklist

- [ ] Create Stripe account and complete business verification
- [ ] Set up products and prices:
  - `lineage_annual` — $25.00 USD, recurring annually
  - `lineage_lifetime` — $75.00 USD, one-time
  - `lineage_founding` — $100.00 USD, one-time
  - `lineage_gift_annual` — $25.00 USD, one-time (generates gift code)
- [ ] Configure Stripe Customer Portal (cancel, update payment method)
- [ ] Set up webhooks: `customer.subscription.deleted`, `customer.subscription.updated`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [ ] Handle failed payment grace period: 3-day grace, then lapse + freeze tokens
- [ ] Founding tier hard cap: enforce 500-unit inventory limit in Stripe (or application layer — application layer preferred for real-time accuracy)

---

*End of brief. — lineage.wtf*
