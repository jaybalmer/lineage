# Bug-fix brief: /membership logged-out cluster (BUG-039 + BUG-040)

> Auto-drafted by the daily triage on 2026-06-14. Build-ready on the recommended defaults below.
> Lead cluster (launch-facing). One PR. Name BUG-039 and BUG-040 in the PR title.

## Goal
Fix the launch-facing `/membership` page for logged-out visitors: correct a factual share-class label, make membership reachable from the guest menu, and stop the Free tier from reading as the visitor's active plan.

## Scope
- **BUG-039** Equity Launch Offer mislabels the share class as "founding shares"; should be "common shares".
- **BUG-040** (a) no membership link in the logged-out "Sign in" menu; (b) the Free Rider tier renders as the active tier for a logged-out viewer instead of offering a Sign in CTA.

## DECISIONS (review before building)
1. **Share-class wording (BUG-039).** Recommended default: use "common shares" everywhere the offer pool is described (it is the factually correct class per `src/lib/equity-offer.ts`: "One fixed pool of 100,000 common shares"). Alternative: "Common Shares" title-cased to match the `/equity` stat label "COMMON SHARES IN THE POOL"; match each spot's existing casing.
2. **Guest-menu link label and placement (BUG-040a).** Recommended default: add a "Membership" link in `GuestMenu` pointing to `/membership`, placed directly under the primary "Sign in" item, above "Report a bug". Alternative label: "Plans" or "Membership & equity".
3. **Free-tier control when logged out (BUG-040b).** Recommended default: when there is no authenticated user, no tier shows "YOUR TIER" / "✓ Active"; the Free tier shows a "Sign in" CTA (link to `/auth/signin`) and the paid tiers keep their existing CTAs. Alternative: show a single "Sign in to manage your membership" banner above the grid and leave the tier cards CTA-only.

## Verified suspected files (grepped 2026-06-14)
- `src/app/membership/page.tsx`
  - Line ~342: `100,000 founding shares, distributed to the launch community by token balance.` (BUG-039 spot 1)
  - Line ~135: `const { membership } = useLineageStore()` is the only store read; the page does NOT read `activePersonId` or `authReady`.
  - Line ~239: `const isCurrentTier = membership.tier === tier.id`. `membership.tier` defaults to `"free"` for anon, which is why the Free card shows "YOUR TIER" (line ~257) and "✓ Active" (line ~316/319) when logged out. (BUG-040b)
- `src/app/equity/page.tsx`
  - Line ~83: `100,000 founding shares, set aside for the community...` and the line ~15 comment "pool of 100,000 founding shares" (BUG-039 spot 2). Note: this page already says "common shares" correctly at lines ~96, ~109, ~281, so it is internally inconsistent.
- `src/app/account/membership/page.tsx`
  - Line ~582: `{EQUITY_POOL_SHARES.toLocaleString()} founding shares` (BUG-039 spot 3).
- `src/components/ui/nav/guest-menu.tsx`: the logged-out menu. Currently: Sign in (Link to `/auth/signin`), Report a bug, Theme, (About). Add the Membership Link here. (BUG-040a)
- `src/store/lineage-store.ts`: `isAuthUser(id)` distinguishes auth UUID from mock/anon ids; `membership` defaults to the free tier. Use `isAuthUser(activePersonId)` (gate on `authReady` first) to decide "logged out" on the membership page.
- Canonical correct copy: `src/lib/equity-offer.ts` ("100,000 common shares", `EQUITY_POOL_SHARES = 100_000`). No data-model change anywhere in this cluster.

## Acceptance
- BUG-039: `/membership`, `/equity`, and `/account/membership` all describe the offer pool as "common shares" (no remaining "founding shares"); a repo grep for "founding shares" returns zero. Wording matches the cap-table fact that the pool is common shares, not the FOUNDING membership tier.
- BUG-040a: the logged-out "Sign in" menu includes a Membership link that routes to `/membership`.
- BUG-040b: a logged-out visitor on `/membership` sees no tier marked "YOUR TIER" / "✓ Active"; the Free tier shows a Sign in CTA. A signed-in member still sees their real current tier marked active (no regression).

## Suggested order
1. BUG-039 copy swap across the three files (fast, zero-risk, grep to confirm none left).
2. BUG-040a guest-menu Membership link.
3. BUG-040b: read `activePersonId` + `authReady` on the membership page, gate `isCurrentTier` on an authenticated user, and add the Free-tier Sign in CTA for the logged-out case.

## Notes
- No migration, no `_public` view, no write path. Pure client/UI.
- `npx tsc --noEmit` clean before commit. One PR, named "BUG-039, BUG-040 ...". Append a `status: pending` entry to `bugs/SHIP-LOG.md`. No em dashes anywhere (code, comments, copy).
