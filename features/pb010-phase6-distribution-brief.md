# PB-010 Phase 6 (Distribution: Embed, Subdomain, Theming, Analytics) — Claude Code handoff brief

**Drafted:** June 16, 2026 by Cowork, **ahead of Phase 5** (see §0 on assumptions). **Source spec:** `Product/PB-010-Public-Timeline.docx` (Phase 2/3 feature lists), `Product/PB-010A-Stack-View-Supplement.docx` (Phase 2 analytics).
**Builds on:** PB-010 Phases 1 to 4 (MVP complete). **Does NOT depend on Phase 5** (see §0). **Pre-flight:** 24-check playbook applied against `~/lineage` post-Phase-4. Verified facts in §4.

---

## §0. What this is, dependency note, and how it splits

Phase 6 is the "make it distributable and ownable" layer the brand/creator personas need: embed it on a site, host it on a brand subdomain, theme it, and see who is engaging. It is **four independent capabilities**, each its own session and PR. Build them in any order; none blocks another.

**Written ahead of Phase 5 (drafting caveat, playbook check #22).** This brief is drafted against the post-Phase-4 code. It assumes only the Phase 2 to 4 surfaces (the `/t/[slug]` route, the `public-timeline-read.ts` payload, the decoupled renderer, the tag loop), all of which are shipped and stable. **The only Phase 5 touchpoint:** once Phase 5 adds announced events, they render inside the embed automatically (the embed reuses the same renderer), and the analytics sub-phase can count "mark interest" alongside "I was there." Nothing here needs Phase 5 to exist first. If Phase 5 ships in between, re-confirm the renderer prop names before building 6a/6c (a 2-minute check, not a redesign).

**The four sub-phases:**
- **6a. Embed + oEmbed** (~3 hr). A frame-friendly `/t/[slug]/embed` route + an `/api/oembed` discovery endpoint. Lowest ops cost; highest distribution value. Recommend first.
- **6b. Custom subdomain** ({slug}.linestry.com) (~2 hr code + ops). Wildcard DNS/cert + a host-rewrite. Ops-gated (Vercel wildcard domain + DNS), so it needs a Jay/Vercel step, not just code.
- **6c. Theming** (~3 to 4 hr). A `public_theme` JSON column + a manage-surface theming section + applying it in the renderer. One migration.
- **6d. Owner analytics** (~3 to 5 hr). Lean on the already-wired PostHog (Diagnostics Phase 1) for `/t/*` views + tag-start/claim events, surfaced in an owner dashboard.

---

## §1. Prerequisites (all sub-phases)

- P1. Branch off `main`; one PR per sub-phase; Jay merges.
- P2. `tsc` + eslint clean.
- P3. Smoke from the session working dir (stop stale servers). 6a: test the embed in an actual `<iframe>` on a scratch HTML page and via an oEmbed consumer. 6b: cannot be fully smoked without the DNS/cert step (see §6b). 6c: test theme applied signed-out. 6d: confirm events land in PostHog.
- P4. No em dashes anywhere written. Standing rule.
- P5. Migration-before-merge only applies to 6c (the `public_theme` column); 6a/6b/6d are migration-free.

---

## §2. Verified facts (checked against `~/lineage` post-Phase-4, June 16)

1. **The public render is already decoupled and payload-fed** (`public-timeline.tsx`, `stack-view.tsx`, `public-timeline-read.ts`). The embed (6a) reuses these with a lighter wrapper; theming (6c) flows through the same payload. No store, no auth on the read.
2. **No embed/oEmbed/subdomain code exists today.** `grep` for `oembed`, `frame-ancestors`, `subdomain`, `CNAME` returns nothing relevant (only unrelated YouTube `<iframe>` usage). All greenfield.
3. **No `public_theme` column exists.** `profiles` has no theming fields for the public surface (the `hero_image_url` hits are on communities, not profiles). 6c adds the column.
4. **PostHog is wired** (Diagnostics Phase 1, PR #37: events + funnels + session replay, prod-confirmed). 6d captures `/t/*` page views and tag events through the existing PostHog client/server setup rather than building a bespoke counter, with an owner-facing rollup. The Phase 4 tag loop already creates the `tag_event` rows that back "tags started / claimed."
5. **The proxy matcher is broad** (`src/proxy.ts`) and runs on `/t/*` for session refresh without gating. 6b's host rewrite hooks into the same proxy layer (rewrite `{slug}.linestry.com/*` to `/t/{slug}`), and 6a's embed route must be allowed to be framed (the app is otherwise same-origin only).

---

## §3. Sub-phase 6a — Embed + oEmbed

**Scope:** a `src/app/t/[slug]/embed/page.tsx` (or a `?embed=1` mode) that renders the same timeline/stack even lighter (no footer attribution inside the frame, no view-toggle chrome if desired), with response headers that permit framing (`Content-Security-Policy: frame-ancestors *` for the embed route only, and drop `X-Frame-Options: DENY` for that path). Plus `src/app/api/oembed/route.ts` returning oEmbed JSON (`type: "rich"`, the embed iframe HTML, width/height, title, thumbnail) for a passed `url=.../t/{slug}`, and an oEmbed `<link rel="alternate" type="application/json+oembed">` discovery tag in the `/t/[slug]` page head.

**Decisions:** D1 embed default view follows the owner default (stack for members); D2 frame-ancestors open (`*`) for the embed route since it is public read-only content (recommend), vs an allowlist (more ops); D3 the embed route excludes the "I was there" write affordance by default OR keeps it (recommend keep, it is the whole point, but confirm anti-abuse since embeds widen the attack surface; the Phase 4 rate-limit still applies by IP/email).

**Acceptance:** the embed renders inside a third-party `<iframe>`; pasting a `/t/{slug}` URL into an oEmbed consumer returns valid JSON that renders the timeline; framing headers are scoped to the embed route only (the main app stays unframable).

---

## §4. Sub-phase 6b — Custom subdomain ({slug}.linestry.com)

**Scope (code):** a host check in `src/proxy.ts` that, when the request host is `{slug}.linestry.com`, rewrites internally to `/t/{slug}` (and leaves apex `linestry.com` untouched). Canonical/OG tags on the subdomain should point at the subdomain.

**Ops-gated (NOT code, needs Jay/Vercel):** a wildcard domain `*.linestry.com` added in Vercel with the wildcard TLS cert provisioned, and the DNS wildcard `CNAME`/`A` record. The code rewrite is inert until that exists. **This sub-phase is the only one that cannot ship purely from a Claude Code session;** the brief should call out the Vercel + DNS step as a prerequisite Jay does (or approves) first.

**Decisions:** D1 reserve a slug blocklist (www, app, auth, api, admin, mail) so a member slug cannot hijack an operational subdomain (recommend, important); D2 whether subdomains are members-eligible or brand/partner-only at first (recommend brand/partner-only, gated behind a flag, since it is a brand-ownership feature).

**Acceptance:** with the wildcard configured, `{slug}.linestry.com` serves the owner's public timeline; reserved subdomains are not claimable; apex `linestry.com` is unaffected.

---

## §5. Sub-phase 6c — Theming

**Scope:** a migration adding `profiles.public_theme jsonb` (shape: `{ hero_image_url, accent_color, logo_url, tagline }`), a theming section in the `/me/public-view` manage surface (or `/me/settings/public-timeline`), the column flowing through `public-timeline-read.ts` into the payload, and the renderer applying it (hero image behind the header, accent color on the left-edge/CTA, logo + tagline in the header). Keep the accent constrained (validate it is a safe color value) so a theme cannot break contrast/accessibility badly.

**Decisions:** D1 theming members-eligible or brand-only first (recommend available to all owners, it is low-risk and a nice member touch); D2 accent application scope (header + CTA only, not the whole palette, recommend, to protect the dark-ground card legibility); D3 store as one `jsonb` column (recommend, matches the spec) vs discrete columns.

**Acceptance:** an owner sets a hero image + accent + logo + tagline; `/t/{slug}` (timeline + stack + embed) reflects them signed-out; an unset theme renders the current default exactly; the migration adds the one column; `tsc` clean. (Migration-before-merge if the read selects it unconditionally.)

---

## §6. Sub-phase 6d — Owner analytics

**Scope:** capture (via the existing PostHog setup, fact 4) the metrics the spec lists: public-timeline views, tag starts ("I was there" taps), tag claims (magic-link completions), top moments, referrer breakdown. Surface them in an owner-facing dashboard (a section on `/me/public-view` or a new `/me/public-view/insights`). Prefer reading PostHog (events + a small query) over a bespoke counter table; the `tag_event` rows from Phase 4 already give an authoritative claim/started count if PostHog is not granular enough.

**Decisions:** D1 source of truth (PostHog events vs a `tag_event` rollup vs both, recommend PostHog for views/referrers + `tag_event` counts for the loop metrics, since those are exact); D2 dashboard location (a section on the manage surface, recommend); D3 freshness (live query vs cached daily, recommend cached/short-TTL given it is a vanity dashboard, not operational).

**Acceptance:** an owner sees views, tag-starts, tag-claims, top moments, and referrers for their public timeline over a window; the numbers reconcile with the `tag_event` rows for the loop metrics; no PII beyond what the owner already sees in `/me/tags`.

---

## §7. Build order across sub-phases

Recommend **6a (embed) first** (highest distribution value, lowest ops), then **6c (theming)** (makes embeds/subdomains feel owned), then **6d (analytics)** (needs traffic to be worth reading), with **6b (subdomain)** whenever the Vercel wildcard step is done (it is ops-gated, so it can slot in independently). Each is a standalone PR; do not bundle.

---

## §8. Data-quality / setup questions for Jay

1. **6b is ops-gated:** confirm you (or Vercel) will add the `*.linestry.com` wildcard domain + cert + DNS before the 6b code session, since the rewrite is inert without it. And confirm brand/partner-only vs members-eligible for subdomains (D1/D2 in §4).
2. **6a framing policy:** open `frame-ancestors *` for the embed route (recommended) vs an allowlist?
3. **6c theming eligibility:** all owners, or brand/partner-only first?
4. **6d analytics source:** is PostHog's current event capture granular enough for per-owner `/t/*` view + referrer breakdowns, or should 6d add explicit PostHog events on the public route? (A quick check in the PostHog project answers this; the Phase 4 `tag_event` rows already cover the loop counts.)

---

## §9. Rollback

Each sub-phase is a single-PR revert. 6a removes the embed route + oEmbed endpoint + the scoped framing headers (the main app framing posture is untouched). 6b reverts the proxy host check (and the wildcard domain can be left or removed in Vercel independently). 6c reverts the column + theming UI + render application (`drop column if exists public_theme`; default render returns). 6d removes the dashboard + any added PostHog capture; no schema. None couples to another sub-phase.

---

## §10. Note

After Phase 6, PB-010 / PB-010A is feature-complete against the original spec (the MVP loop plus the brand-ownership and distribution layer). The only remaining spec items beyond this are Phase 3-vision stretch ideas (multi-source IG/YT/Spotify content sync, followed timelines, public read API, AI-personalized card ordering), which are separate product bets, not PB-010 completion work.
