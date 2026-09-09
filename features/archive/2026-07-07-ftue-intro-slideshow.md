# FTUE Intro Slideshow (`/intro`): Claude Code Build Brief

**Date:** July 7, 2026
**Author:** Cowork (from `Linestry_FTUE_Script_and_Screens.docx`, Deliverable 2, with Jay's placement/copy/fidelity/nav decisions locked July 7)
**Size:** ~3 to 4 hr, single PR, **no migration**, UI-only (one public GET reuse)
**Model note:** Opus 4.8 class work (standing model strategy). No Fable-class complexity here.

---

## 0. What this is

A 5-screen pre-signup onboarding slideshow at a new public route, sitting BEFORE the existing `/onboarding` wizard. Each screen is scannable in 3 to 5 seconds: big headline, two lines of body copy, an animated SVG visual, a CTA. Manual navigation only (dots, swipe, arrows, click). Screen 4 (equity) renders conditionally while the launch equity offer is active, with copy rewritten to match the real `/equity` offer. Final CTA drops into the wizard.

This is the product-side companion to the founder video (Deliverable 1 of the same doc); the video is out of scope here.

Playbook subset applied: this is UI-only with no schema, no write path, and no `_public` view involvement, so the Group A schema checks and Group F migration gates are N/A. The applied checks are: code-path grep, surface-existence audit, component-capability check, dev-server prerequisite, standing copy prefs (no em dashes), and premise verification (see §4).

## 1. Prerequisites

- Pull latest `main`. Recent relevant ships: FTUE Conversion Pass (PR #153, July 2) already did a land-step copy pass and added `signup_failed` telemetry; do not re-touch that copy.
- If working in a worktree, symlink `.env.local` from the main checkout.
- **Dev server for smoke: run `npm run dev` from the repo root of THIS checkout/worktree** (the one you are editing), and confirm the port before browser-testing.
- No migration this session. If you find yourself wanting a schema change, stop and flag.

## 2. Decisions (review before building; defaults are shippable)

- **D1. Route = `/intro`, public, chromeless.** `/welcome` is TAKEN (Stripe post-purchase member-card page, `src/app/welcome/page.tsx`), do not touch it. No `/intro` route exists. A static top-level route wins over the `(community)/[community]` dynamic route (existing precedent: `/equity`, `/word`, `/founding`). No `proxy.ts` change needed; the proxy only gates `/[community]/timeline` and `/me/*` (src/proxy.ts ~lines 200 to 209). Chromeless = no `Nav`; render `BrandMark` + the Linestry wordmark (via `var(--font-wordmark)`) top-left, Skip top-right.
- **D2. Homepage CTA repoint (signed-out only).** In `src/app/page.tsx` (~line 81), the signed-out primary CTA "Start Your Timeline" changes `href` from `/onboarding` to `/intro`. Label unchanged. The signed-in branch (My Timeline → `/snowboarding/profile`) and the secondary "Browse Snowboarding" CTA are unchanged. `/onboarding` stays directly reachable (no redirect); links elsewhere in the app keep working.
- **D3. Screen 5 CTA → `/onboarding?from=intro`, wizard skips its `land` step.** `onboarding-flow.tsx` reads the param; when `from=intro`, start at the `name` step (the slideshow has just delivered the pitch, so the land screen would be a duplicate). To keep the PostHog FTUE funnel intact, still fire `ftue_landed` on wizard mount in this path, with prop `{ source: "intro" }`. Without the param, behavior is byte-for-byte unchanged.
- **D4. Manual navigation only.** No auto-advance (overrides the source doc, Jay's call July 7). Dot indicators (clickable), swipe on touch, left/right arrow keys, and each screen's CTA advances to the next screen. Skip link on every screen goes to `/onboarding?from=intro`.
- **D5. Screen 4 (equity) is conditional and uses real numbers.** Render only while the current date is before `EQUITY_SNAPSHOT_DATE` (import from `src/lib/equity-offer.ts`; there is no separate offer-active flag, the date IS the mechanism). The contributor counter comes live from `GET /api/equity/pool` (`member_count` field). If the fetch fails OR `member_count < 10`, hide the counter line entirely. Never render a fabricated number (the doc's "1,247" is illustrative only). When Screen 4 is hidden, the slideshow is 4 screens and the dots reflect that.
- **D6. Visual fidelity = lightweight hand-rolled SVG/CSS.** No animation library exists in the repo (verified: no framer-motion/gsap/lottie in package.json) and none should be added. Use inline SVG with `stroke-dashoffset` draw-in, CSS keyframes for pulse/fade, transitions in the 300 to 500ms range. Namespace any keyframes added to `globals.css` as `ftue-intro-*` (there are currently ZERO `@keyframes` in globals.css, so you are establishing the pattern).
- **D7. Respect `prefers-reduced-motion`.** Reduced motion replaces draw-in/pulse with simple opacity fades. Screen transitions become instant swaps with a short fade.
- **D8. Node colors in the graph visuals use the tier palette.** Stories/riders violet, places teal, events amber, boards emerald, brands cyan, and generic accent blue (#3B82F6) only for UI chrome (active dot, CTA). Use theme tokens (`--surface`, `--foreground`, `--muted`, `--accent`, `--accent-strong`) so the route works in both light and dark themes.

## 3. Verified facts (provenance, checked against `main` July 7)

1. `/welcome` is occupied by the Stripe membership welcome page (`src/app/welcome/page.tsx`). Route name for this feature must differ; `/intro` is free (full `src/app/` listing checked).
2. `src/proxy.ts` auth-gates only `/[community]/timeline` and `/me/*` (redirect to `/onboarding`, ~lines 200 to 209). A new top-level static route is public with no proxy change. `COMMUNITY_ROUTES` set (line ~24) is for community-scoped path parsing and does not need an entry.
3. Homepage primary CTA: `src/app/page.tsx` ~lines 72 to 87, auth-aware (`isAuth ? "My Timeline" → /snowboarding/profile : "Start Your Timeline" → /onboarding`).
4. Onboarding wizard: `src/components/onboarding/onboarding-flow.tsx` (598 lines), `StepId` union starts with `"land"` (line ~17), step order array at line ~277, `ftue_landed` fires for the land step (~lines 287 to 288). Page shell `src/app/onboarding/page.tsx` is 5 lines.
5. Analytics: `trackEvent(category, event, props)` in `src/lib/analytics.ts`, client-safe, fire-and-forget. `"ftue"` is a valid `AnalyticsCategory` (`src/types/index.ts` line ~760).
6. Equity constants: `src/lib/equity-offer.ts` exports `EQUITY_POOL_SHARES` (100000), `EQUITY_SNAPSHOT_DATE` ("2026-09-30"), `EQUITY_SNAPSHOT_LABEL` ("September 30, 2026"). No boolean offer-active flag exists anywhere; D5 defines the mechanism.
7. `GET /api/equity/pool` is public, `force-dynamic`, returns `{ total_weighted_tokens, member_count }` where `member_count` counts eligible members with a positive weighted balance (`src/app/api/equity/pool/route.ts`).
8. Brand: `BrandMark` at `src/components/ui/brand-mark.tsx` (tilt default true, contrast dot). Wordmark font `var(--font-wordmark)` (Calendula Bold), headings `var(--font-display)` (Geologica 800), body Geologica 300. Wordmark has NO trailing period.
9. No animation dependency in `package.json`; no `@keyframes` in `src/app/globals.css`.
10. Tier colors: riders/stories violet, places teal (#0D9488 anchor), events amber, boards emerald, brands/orgs cyan. Generic blue is the brand accent, not a tier color.

## 4. Premise verification

The source doc calls this "the pre-signup onboarding flow". The existing `/onboarding` wizard already opens with a `land` pitch step, so building the slideshow INSIDE the wizard would duplicate it. Jay chose a standalone route in front of the wizard (July 7), with D3 removing the duplication for slideshow arrivals. Premise holds; no prescribed change is already unnecessary.

## 5. Scope

1. **New route `src/app/intro/page.tsx`** (plus a client component, suggest `src/components/onboarding/intro-slideshow.tsx`). Chromeless full-viewport layout per D1. Server component shell + client slideshow.
2. **Slideshow chassis:** screen state, dot indicators, swipe (touch), arrow keys, click-CTA advance, Skip link, 300 to 500ms transitions, reduced-motion variant, conditional Screen 4 (D5).
3. **Five screens** per §6: copy exactly as written there (already adjusted for the no-em-dash rule; the docx copy is NOT canonical where it conflicts with §6).
4. **SVG visuals** per screen per §6 and D6/D8. These are hand-built scenes; aim for evocative-but-simple over literal fidelity to the doc's concepts. Reuse `BrandMark` where a logo is called for.
5. **Homepage CTA repoint** per D2 (one `href` change).
6. **Wizard `from=intro` handling** per D3 (start at `name`, fire `ftue_landed` with `{ source: "intro" }`).
7. **Analytics** per §7.

## 6. Screen spec

Shared layout: headline in `--font-display` (Geologica 800), body in Geologica 300, visual fills the upper ~55% of the viewport, CTA as a solid accent-blue pill, Skip top-right in `--muted`. Mobile-first (design at 375px, scale up).

**Screen 1 of 5**
- Headline: `This Isn't a Feed.`
- Body: `Every story you add connects: to a place, a time, and the people who were there. This is history, wired together.`
- Visual: an animated constellation graph draws itself. 10 to 14 nodes in tier colors (violet story nodes dominant), thin lines draw in via stroke-dashoffset, staggered. One violet node pulses gently after the draw completes.
- CTA: `[ See How It Works ]` → advance.

**Screen 2 of 5**
- Headline: `Stories. People. Places. Boards.`
- Body: `Browse a mountain and see every story that happened there. Find a rider and follow their whole arc. Everything is connected.`
- Visual: split scene. Left, a mountain silhouette (teal accent) with story nodes appearing along a vertical timeline. Right, a rider node (violet) with connections radiating to event (amber), board (emerald), and place (teal) nodes. One or two lines cross the split to join the halves.
- CTA: `[ Explore Connections ]` → advance.

**Screen 3 of 5**
- Headline: `Built by the People Who Were There.`
- Body: `This history isn't written by editors. It's authored by the community: riders, photographers, fans who lived it.`
- Visual: a grid/mosaic of small avatar circles (mixed tier-color rings, echoing the rider-avatar ring language) assembles into a snowboard silhouette. Each circle fades/pops in with a slight stagger; keep the count modest (30 to 40 circles) so it stays cheap.
- CTA: `[ Meet the Community ]` → advance.

**Screen 4 of 5 (conditional, D5)**
- Headline: `Contribute. Own a Piece of This.`
- Body: `Early contributors earn tokens for what they add. At the ${EQUITY_SNAPSHOT_LABEL} snapshot, a pool of 100,000 shares in Lineage Community Technologies is split across the launch community by token balance.`
- Counter line (only when live data passes the D5 gate): `{member_count} founding contributors so far`
- Secondary link: `How the offer works` → `/equity` (opens the explainer; plain text link under the CTA).
- Visual: a central `BrandMark` with thin lines connecting outward to a ring of contributor circles; circles light up one by one. No fake ticker.
- CTA: `[ Claim Your Stake ]` → advance.
- Tone guard: this screen explains an offer, it does not promise value. Keep the copy above verbatim; it mirrors the `/equity` page framing (pool + snapshot + split by token balance).

**Screen 5 of 5**
- Headline: `Your History Starts Now.`
- Body: `Add a photo. Tell a story. Connect yourself to forty years of snowboarding. You were part of this.`
- Visual: a clean horizontal timeline line; a first story node drops in and connects upward into a faint background constellation. The timeline "comes alive" (line brightens along its length).
- CTA: `[ Start Your Timeline ]` → `/onboarding?from=intro`.

## 7. Analytics (category `"ftue"`)

- `ftue_intro_viewed` with `{ screen: 1..5, equity_screen_present: boolean }`, fired once per screen per visit.
- `ftue_intro_completed` when Screen 5's CTA is clicked.
- `ftue_intro_skipped` with `{ screen }` when Skip is clicked.
- `ftue_landed` keeps firing for `from=intro` arrivals per D3, with `{ source: "intro" }`.

Ops note for Jay (not code): after ship, prepend `ftue_intro_viewed (screen=1)` to the PostHog FTUE funnel so the funnel measures the new true top.

## 8. Out of scope (hard line)

- The founder video (Deliverable 1) and any video embed on `/intro`.
- Auto-advance timers (D4 overrides the doc).
- Any schema change, new dependency, or animation library.
- Changes to the wizard's steps, copy, or save path beyond the D3 param handling.
- A logged-in redirect on `/intro` (signed-in users simply never get pointed there by D2; if one visits, the slideshow still renders, and Screen 5's CTA path already handles an authed user the way `/onboarding` does today).
- Localization, A/B variants, session-persistence of slideshow position.

## 9. Acceptance criteria

1. `/intro` renders chromeless (no Nav) in light and dark themes, no horizontal overflow at 375px.
2. Dots, swipe, arrow keys, and CTA clicks all navigate; dots reflect 4 vs 5 screens depending on the Screen 4 gate.
3. Skip on any screen lands `/onboarding?from=intro`.
4. Screen 4 renders before September 30, 2026 and not after (flip the system clock or temporarily stub the constant to verify both branches).
5. Counter shows the live `member_count` when `>= 10`; hidden on fetch failure or low count. No hardcoded number anywhere.
6. Screen 5 CTA lands the wizard at the `name` step; `ftue_landed` fires with `source: "intro"`. Visiting `/onboarding` with no param is unchanged (land step first, `ftue_landed` fires as today).
7. Homepage signed-out CTA goes to `/intro`; signed-in CTA and Browse Snowboarding are untouched.
8. `prefers-reduced-motion` swaps draw/pulse animations for fades.
9. `ftue_intro_viewed` fires once per screen; completed/skipped events fire with correct props.
10. `npx tsc --noEmit` clean; eslint clean on touched files.
11. No em dashes in any copy, comment, or string added this session.

## 10. Suggested order

1. Route shell + chassis (screens as plain placeholders, nav + dots + skip working).
2. Screen copy + layout, all five, static.
3. Screen 4 conditional gate + live counter.
4. D3 wizard param handling + D2 homepage repoint.
5. Analytics events.
6. SVG visuals + animation, screen by screen (1, 5, 2, 3, 4 in value order; if time runs short, screens 3 and 4 may ship with simplified static scenes and a follow-up noted in the PR).
7. Reduced-motion pass, theme pass, mobile pass.
8. Smoke + acceptance run.

## 11. Ship sequence

Standard rules apply (repo `CLAUDE.md`): tsc clean, one PR, run the full Ship sequence before wrapping. Expected statement at step 2: **"No migration this session."** SHIP-LOG entry: `type: feature`, `ids: none`, `scope: ftue-intro-slideshow`, `migration: none`.
