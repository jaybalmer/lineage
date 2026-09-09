# Bug-fix brief: `/membership` tier-state and founding re-purchase guard (BUG-077)

> Self-contained, build-ready. Drafted June 18, 2026 by the daily triage with the live repo grepped. P1, HUMAN-RUN, payments-sensitive: do NOT auto-merge.

## Goal

Stop the `/membership` sale page from misrepresenting a signed-in member's tier. A founding (or any paid) member currently sees a live "Claim founding spot" checkout CTA (charge-again risk) and sees the free Rider card labelled "Your current plan". Make the page reflect the viewer's real tier and never offer a re-purchase of a tier they already hold.

## Scope

- **BUG-077** (P1): `/membership` wrong tier display + live founding re-purchase CTA for an existing member.

This brief covers the concrete display/guard fix only. The larger tier-aware offer matrix Jay sketched in the report (gift flows for founding, upgrade paths for annual/lifetime) is a separate feature/product session, NOT in scope here. Note it in the PR description as a follow-up.

## DECISIONS (review before building)

1. **What to show on a tier card the member already holds.** Recommended default: keep the existing per-card "✓ Active" + "YOUR TIER" badge path (it already works when `membership.tier` is hydrated). Alternative: replace with a "Manage membership" link to `/account/membership`. Default is the smaller change.
2. **Hero founding banner for an existing founding/paid member.** Recommended default: HIDE the hero "Claim founding spot" button (and the founding progress banner is fine to keep as informational, or hide the whole hero CTA block) when the viewer already holds `founding` or any paid tier. Alternative: keep it visible but disabled with a "You are already a founding member" note. Default = hide the CTA; safest against an accidental charge.
3. **Founding tier-CARD CTA for a member who already holds founding.** Recommended default: suppress the "Claim founding spot" card CTA when the viewer's tier is `founding` (the `isCurrentTier` "✓ Active" path already handles this IF the tier is hydrated; the fix is making sure the founding CTA never renders for a founding member regardless of hydration timing). Alternative: leave to the existing `isCurrentTier` gate. Default = belt-and-suspenders guard.
4. **Free-card "Your current plan" label.** Recommended default: only show "Your current plan" on the free card when the member's tier is actually `free`; for a non-free member, show nothing (or the same "Manage membership" link). No alternative needed; the current behaviour is simply a bug.

The brief is fully build-ready on these defaults; Jay can override any line before the session.

## Verified suspected files / symbols (grepped on live main)

- `src/app/membership/page.tsx` (the sale page; report URL is `/membership`).
  - `const { membership, activePersonId, authReady } = useLineageStore()` (~line 135); `isLoggedIn = authReady && isAuthUser(activePersonId)` (~line 139).
  - Hero founding banner with the un-guarded CTA: `onClick={() => handleCta("founding")}` (~line 219). This is the charge-again entry point: it fires for any viewer, including an existing founding member.
  - `handleCta(tierId)` (~line 156) early-returns only for `"free"`, then calls `startCheckout(tier)` for `annual | lifetime | founding`.
  - Tier cards: `isCurrentTier = isLoggedIn && membership.tier === tier.id` (~line 243). Card CTA renders when `tier.cta && !isCurrentTier` (~line 301); "✓ Active" when `isCurrentTier` (~line 320); the FREE-card fallback `{!tier.cta && !isCurrentTier && (isLoggedIn ? "Your current plan" : <Sign in CTA>)}` (~lines 326 to 331). The free tier has `cta: null`, so this fallback fires "Your current plan" for EVERY logged-in non-free member. That is defect (2) in the symptom.
- `src/components/catalog-loader.tsx` (~line 44): hydrates `membership.tier` from the profile row for non-free tiers (`if (dbTier !== "free" || ...) setMembership({ tier: dbTier, ... })`). So `membership.tier` should be correct once the catalog loads; the page must not show a re-purchase CTA in the pre-hydration window either, which is why the hero CTA needs an explicit guard rather than relying only on `isCurrentTier`.
- Reference (do not need to change): `src/app/account/membership/page.tsx` is the Stripe-backed management page and independently fetches + `setMembership(...)`; `/membership` is the marketing/sale page and only reads the store.

## Implementation order (suggested)

1. Add a small derived flag in the page, e.g. `const hasPaidOrFounding = isLoggedIn && membership.tier !== "free"` (and a specific `isFounding = isLoggedIn && membership.tier === "founding"`).
2. Guard the hero founding CTA: render the "Claim founding spot" hero button only when `!hasPaidOrFounding` (decision 2 default = hide). If keeping the banner for the progress bar, keep the bar, drop the button.
3. Guard `handleCta`: bail out (no checkout) if the viewer already holds founding/paid and the requested tier is one they hold or a downgrade; at minimum, never start `founding` checkout when `isFounding`.
4. Fix the free-card fallback: show "Your current plan" only when `membership.tier === "free"`; otherwise render nothing for a logged-in non-free member (decision 4).
5. Sanity-check the founding tier-card CTA path is suppressed for `isFounding` (decision 3).
6. `npx tsc --noEmit` clean. Smoke on the Vercel preview signed in as a founding member (or temporarily stub `membership.tier`): hero CTA gone, founding card shows Active, free card not mislabelled; logged-out and a real free member unchanged.

## Acceptance criteria (BUG-077)

- Signed in as a founding member: NO live "Claim founding spot" CTA anywhere on `/membership` (hero banner included); the founding tier shows as the current/active plan; the free Rider card is NOT labelled "Your current plan".
- Signed in as annual or lifetime: no re-purchase CTA for the tier already held; the held tier reads as current; free card not mislabelled.
- Logged-out visitor: unchanged (free card keeps its "Sign in" CTA; tiers show purchase CTAs).
- Genuinely free signed-in member: unchanged (free card reads "Your current plan"; paid tiers show their CTAs).
- `npx tsc --noEmit` clean.

## Notes / guardrails

- Payments-sensitive and membership-state: HUMAN-RUN, do NOT let the autonomous pipeline auto-merge. No migration, no schema, client render guards only.
- Name **BUG-077** in the PR title or commit message (the daily reconcile greps for it).
- Append a `status: pending` entry to `bugs/SHIP-LOG.md` at session end (schema at the top of that file). Do not edit earlier entries.
- No em dashes anywhere (code, comments, copy). Use periods, commas, parentheses, colons, or semicolons.
- Follow-up to log, not build here: the tier-aware offer matrix (founding/lifetime can gift a membership; annual can upgrade) is a feature session.
