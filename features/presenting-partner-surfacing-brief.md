# Presenting Partner Surfacing (featured group + landing card)

> Cowork-authored feature brief, September 8 2026. Self-contained. ~2 to 3 hr,
> ONE PR, NO migration, NO new columns, NO admin work. Parts (a) and (c) of the
> September 7 `[Linestry Idea]` FNRad request. Part (b), the curated featured page
> off the nav, is deliberately NOT in this brief; see section 4 and section 14.
>
> This is a **generic presenting-partner mechanism driven by the existing
> `orgs.curation_tier = 'founding'`**, not an FNRad special case. FNRad is the
> first row in it. The next brand partner is a dropdown in `/admin/brand/[id]`,
> which already exists and already writes every field this brief reads.
>
> Playbook subset run: checks 2, 6, 7, 10, 11, 12, 20, 21, 22, 24. Checks 1, 3, 4,
> 5, 8, 9, 13, 14, 15, 16, 17, 18, 19, 23 are not applicable (no migration, no
> schema, no backfill, no Postgres view, no plpgsql function, no moderation
> terminology, no cross-user endpoint, no new API route).

---

## DECISIONS (review before building)

Every decision has a shippable default. Build the defaults unless Jay says otherwise.

**D1. The featured group is driven by `curation_tier === 'founding'`, nothing new. DEFAULT: yes.**
`orgs.curation_tier` is already `'standard' | 'curated' | 'founding'` (`src/types/index.ts:349`),
already editable at `/admin/brand/[id]` (`:146`, `:164`), and already drives the
`'founding' adds the partner ribbon` behaviour on the brand detail page
(`brands/[slug]/page.tsx:570`). `'curated'` stays what it is today, an editorial
quality tier that earns a logo and a badge on the index. `'founding'` becomes the
commercial tier: it earns the featured slot at the top of the brands index and
eligibility for the landing card. Alternative considered and rejected: a separate
`is_presenting_sponsor` column. It is cleaner in the abstract, but it costs a
migration for a distinction the product does not yet need, and `partner_label`
(`types/index.ts`, "Founding Brand Partner") already exists precisely to say in
words what the founding tier means commercially.

**D2. The featured group pulls across ALL `org_type` buckets. DEFAULT: yes. THIS IS THE ONE THAT MATTERS.**
Read section 5 fact F3 before you build anything. FNRad is `org_type = 'media'`,
so today it does not appear in the main brands list at all: it renders in a
separate "Shows & Media" section further down the page. A featured group built
off `brandOrgs` would silently exclude the one org the whole request is about.
The featured group must be derived from `allOrgs`, the post-filter set, not from
`brandOrgs`.

**D3. A featured org is LIFTED, not duplicated. DEFAULT: lift.**
An org in the featured group is removed from its home bucket for that render, so
FNRad appears once at the top and not a second time under "Shows & Media". The
alternative (pin at top AND leave in place) is defensible for findability but it
reads as a bug on a page this short. See T2 for the exact exclusion.

**D4. The header count does not change. DEFAULT: leave `totalBrands` alone.**
`totalBrands` is `brandOrgs.length + teams.length + shops.length` and deliberately
excludes media orgs, per the BUG-027 discipline that the header number must match
the cards on screen. Lifting an org into the featured section does not change how
many cards are on screen, so the number is still correct. Do NOT "fix" it.

**D5. The featured section renders in BOTH sort modes. DEFAULT: yes.**
The page has a `sort === "category"` branch that replaces the flat list with
grouped sections (`page.tsx:319-338`). The featured section sits ABOVE that
branch so it survives every sort and every filter state. It is a pinned band, not
a sort result.

**D6. Search and My Brands filter the featured group too. DEFAULT: yes.**
Derive it from `allOrgs`, which is already post-search and post-`myOnly`
(`page.tsx:192-201`). If a member searches "Burton", a pinned FNRad card is
noise. Empty featured group renders nothing, no empty state.

**D7. Landing card copy comes from the org row, not from hardcoded strings. DEFAULT: yes.**
`partner_label` supplies the eyebrow ("Presenting Partner" / "Founding Brand
Partner"), `name` the title, `description` the line, `logo_url` the mark. All four
are already editable at `/admin/brand/[id]`. This is what makes the mechanism
generic: swapping the partner is an admin edit, not a deploy. Fallback copy for a
missing `partner_label` is in Appendix A.

**D8. The landing card renders only once the catalog has loaded. DEFAULT: yes, gate on `catalogLoaded`.**
`src/app/page.tsx` does not read the catalog today. `CatalogLoader` is mounted in
the root layout (`layout.tsx:73`) so `catalog.orgs` does arrive on the landing
page, but asynchronously and after first paint. Gate the card on `catalogLoaded`
so it does not pop in mid-read, and place it BELOW the snowboarding focus card so
its arrival cannot push the primary CTA down the page. Alternative considered and
rejected: hardcode the card in a constants file like `src/lib/fnrad.ts`. It avoids
the async entirely and would render in the first paint, but it breaks D7 and makes
every partner change a deploy, which is the opposite of what "generic" was chosen
for.

**D9. Only ONE org gets the landing card, even if several are `founding`. DEFAULT: highest by a deterministic rule.**
The landing page is not a sponsor rail. Pick the single presenting partner as the
first founding org after sorting by name, so the choice is stable across reloads
and does not depend on catalog ordering. If Jay ever wants to choose explicitly,
that is the point at which a dedicated column earns itself (section 14).

**D10. The landing card links to the brand page, not to `/fnrad`. DEFAULT: brand page.**
`/fnrad` is a campaign hub tied to one partner; the brand page
(`/snowboarding/brands/{slug}`) is the generic destination every founding org has.
Keep the mechanism generic. FNRad's own brand page already renders the Show block
and links onward to the hub.

---

## 1. Why this, why now

The request arrived through the in-app feedback widget on September 7 2026 in the
`[Linestry Idea]` lane, from OWNER on `/snowboarding/brands`, replay `S-58`. It is
**the first directly commercial request the idea lane has produced**, and it sits
against the FNRad Season 12 deal ($10K for 50,000 shares, locked) with episode 1
one to two weeks out.

The ask was three things:

1. **(a)** a featured group at the top of the brands list, home to future brand partners
2. **(b)** a curated featured page off the top nav, with editable descriptions
3. **(c)** a presenting-sponsor card on the landing page

This brief builds **(a) and (c)**. They are the pair that needs no migration, no
new storage and no nav-chassis change, and they are the two a cold listener
arriving from the podcast will actually pass through: the landing page is where
`?ref=fnrad` traffic arrives, and the brands index is where the FNRad brand page
lives. **(b)** is the heavy one and is deferred to section 14 with its shape
already decided (a hand-edited constants file, not a table).

The commercial logic is worth stating plainly because it shapes D1: Linestry is
selling presenting-partner placement, and the second sale is much easier if the
first one is visibly delivered. Building this generic now means partner two is a
dropdown, not a session.

---

## 2. Prerequisites

**P1. Pull `main` and confirm a clean tree.** Tip at brief-drafting time was
`f0cc660` (PR #246). Facts below were re-verified against it after PRs #243 to
#246 landed. Note the standing issue: the working tree has been carrying
uncommitted tracked changes for eight days, which has aborted every 05:00
unattended run. Clear that before starting.

**P2. `.env.local` present** for `npm run dev`.

**P3. Run `npm run dev` from the repo root** (`~/lineage`), not from a subfolder.
This is the Group D playbook check; a previous session lost ten minutes to the
wrong dev server.

**P4. STEP 0, a two-minute database check, do it before writing code.** The whole
brief keys off one org row being set correctly. Confirm in Supabase:

```sql
select id, name, org_type, curation_tier, partner_label, logo_url, description, public_slug
from public.orgs
where org_type = 'media' or curation_tier = 'founding'
order by curation_tier nulls last, name;
```

What you need to see, and what to do if you do not:

- **The FNRad row exists.** `src/lib/fnrad.ts` says its `public_slug` is
  `fnrad_podcast` (confirmed in Supabase 2026-09-06) and its `org_type` is
  `'media'`.
- **`curation_tier` is almost certainly `'standard'` or null today.** Nothing has
  set it. **Setting it to `'founding'` is Jay's call and is done through
  `/admin/brand/[id]`, not through SQL in this session.** Until it is set, both
  surfaces this brief builds render nothing, which is the correct empty state and
  is exactly how you should test the zero case.
- **`partner_label`, `logo_url` and `description` may all be empty.** The card
  handles each missing field (Appendix A). Do not backfill them here.

**P5. Do not add anything to the persisted Zustand store.** This brief reads
`catalog.orgs`, which is deliberately NOT persisted (repo `CLAUDE.md` gotcha 4),
and adds no new persisted state. Keep it that way. Context, since it landed the
same day this brief was written: **BUG-188 shipped as PR #243** (`f1e8d38`). The
persisted store had crossed WebKit's hard 5MB per-origin quota because
`userEntities` mirrored four catalog tables (~4.96MB after the September 7 to 8
events import), and zustand v5 calls `localStorage.setItem` synchronously inside
`set()` with no try/catch, so every store action threw. The fix drops
`userEntities` from `partialize` for signed-in users, adds a `version 1` migrate
that strips any blob already on disk, and wraps storage so a full quota degrades
to a skipped save. **The headroom that bought is not yours to spend.** The events
import is what pushed it over, and the catalog only grows.

---

## 3. Scope

Two surfaces, three tasks, one PR.

- **T1.** A shared `isPresentingPartner` / partner-resolution helper so the two
  surfaces cannot disagree about who the partner is.
- **T2.** Featured group at the top of `/[community]/brands`, lifted out of the
  normal buckets, rendered above both sort modes.
- **T3.** Presenting-partner card on `/`, below the snowboarding focus card,
  gated on `catalogLoaded`.

---

## 4. Out of scope (hard list)

Do not build any of these, even if they look like a natural extension:

- **The curated featured page and its nav entry (part b).** The lens row is a
  deliberately fixed three slots ("Community / Feed / My Timeline. Same three
  slots in every scope", `src/components/ui/nav/lens-row.tsx:15`). Adding a fourth
  is a chassis decision, not a drive-by. Section 14.
- **Any migration, any new column.** Including `is_presenting_sponsor` and
  `sponsor_rank`.
- **Any change to `/admin/brand/[id]`.** It already writes `curation_tier`,
  `partner_label`, `logo_url` and `description`. Nothing is missing.
- **Any change to what `'curated'` tier does.** Only `'founding'` gains behaviour.
- **Changing `totalBrands`** (D4).
- **A sponsor rail, or more than one card on the landing page** (D9).
- **Touching `/fnrad`, `src/lib/fnrad.ts`, or the challenge constant.** This brief
  is generic and does not know FNRad exists.
- **Setting FNRad's `curation_tier` in SQL.** That is an admin action of Jay's.
- **Analytics events.** The attribution carve (PR #238) already stamps first-touch
  onto signup; a click event on the sponsor card is a nice-to-have, not this
  session. Section 14.

---

## 5. Verified facts (checked against `main` at `f0cc660`, September 8 2026)

**F1. `orgs.curation_tier` exists and is typed.** `src/types/index.ts:349`:
`curation_tier?: "standard" | "curated" | "founding"`. Comment on it reads
"'standard' (default) renders the Phase 1 header only; 'curated' and 'founding'
render the curated sections. 'founding' adds the partner ribbon."

**F2. The brands index already reads it.**
`src/app/(community)/[community]/brands/page.tsx:46`:
`const isCurated = org.curation_tier === "curated" || org.curation_tier === "founding"`.
That flag today does exactly two things in `OrgCard`: swaps the initial block for
`logo_url` when present, and renders a violet "Curated" pill. There is no featured
section, no pinning, and no `'founding'`-specific branch on this page.

**F3. FNRad is `org_type = 'media'` and is NOT in the main brands list.** This is
the finding that would have burned a session. `page.tsx:202`:
`brandOrgs = allOrgs.filter((o) => o.org_type === "brand" || o.org_type === "magazine")`.
Media orgs are collected separately at `:231`:
`const sortedShows = allOrgs.filter((o) => o.org_type === "media").sort(cmp)`
and render in their own "Shows & Media" section at `:341-353`, below the main
list. `src/lib/fnrad.ts` confirms the show is an org with `org_type='media'` and
`public_slug='fnrad_podcast'`. **Derive the featured group from `allOrgs`.**

**F4. `allOrgs` is the correct source and is already filtered.** `page.tsx:192-201`
applies the `myOnly` filter and the search haystack (name, description, country,
brand_category, founded_year) before anything is bucketed. Deriving from it gives
D6 for free.

**F5. `partner_label` exists and is founding-only in the admin UI.**
`src/types/index.ts`: "Founding-tier ribbon text, e.g. 'Founding Brand Partner'".
`src/app/admin/brand/[id]/page.tsx:151` holds it in state, `:169` saves it, and
`:211` gates its input on `curationTier === "founding"`. So the field is already
conceptually bound to the founding tier.

**F6. The admin editor already writes every field this brief reads.**
`admin/brand/[id]/page.tsx`: `curation_tier` (`:146`, `:164`), `logo_url`
(`:148`, `:166`), `partner_label` (`:151`, `:169`). `description` is on the same
form. **No admin work is needed in this session.**

**F7. The catalog selects `*`, so no API change is needed.**
`src/store/lineage-store.ts:18`:
`async function selectAll(table: string, columns = "*")`, called as
`selectAll("orgs")` at `:259`. Every column on `orgs` already arrives client-side.
There is **no `orgs_public` view** (grep returns nothing), so the `_public` view
rebuild trap from the Group F playbook does not apply here.

**F8. `CatalogLoader` is mounted in the root layout**, `src/app/layout.tsx:73`, so
`catalog.orgs` is populated on `/` as well as on community pages. It arrives
async and `catalog` is deliberately not persisted (repo `CLAUDE.md` gotcha 4), so
`catalogLoaded` is the gate to use.

**F9. The landing page currently reads only `activePersonId` and `communities`.**
`src/app/page.tsx:11-12` (`activePersonId`, `communities`). It does not touch `catalog`. Adding a `catalog.orgs` +
`catalogLoaded` read is new to this file; follow the existing selector style at `:12`
(`useLineageStore((s) => s.communities)`).

**F10. The landing page is force-dark.** `page.tsx:19-20`:
`<div className="dark min-h-screen bg-background text-foreground">`. The whole
subtree re-scopes the theme tokens, so the sponsor card must be built on theme
tokens (`bg-surface`, `text-muted`, `border-border-default`) and must be eyeballed
in that dark scope. Do NOT use the `.postcard` class here.

**F11. The landing page's structure, in order:** banner band (`:22-28`), hero with
wordmark + headline + mobile-only CTA pair (`:31-86`), snowboarding focus card
with the desktop CTA pair (`:88-122`), equity teaser (`:124-133`), footer
(`:135-149`). The insertion point for T3 is between `:122` and `:124`. BUG-017 deliberately surfaced the primary CTA in the first mobile
screen; **do not insert anything above the focus card** or you regress it.

**F12. The brands page sort modes are mutually exclusive.** `:318-338`: the
`space-y-10` wrapper opens at `:318` and the ternary at `:319`; when
`sort === "category"` the page renders `Object.entries(grouped)` sections; every
other sort renders the flat `sortedBrands` list. The Shows / Teams / Shops
sections at `:341-383` render in BOTH modes, outside that ternary. **The featured
section goes in the same position class as those, above the ternary.**

**F13. `grouped` is computed off `brandOrgs`, not `allOrgs`** (`:211-217`), so a
media org is not in it and the category branch needs no exclusion for FNRad
specifically. It still needs the general exclusion for a founding org that IS a
brand (D3).

**F14. `OrgCard` is a local function component** at `page.tsx:43-114` (its "Curated" pill is at `:77`), taking
`{ org, conn }`. It is not exported and not shared. Reuse it inside the featured
section rather than writing a second card; the featured treatment is the section
wrapper, not a different card.

**F15. The page is `"use client"`** (`:1`) and wrapped in `<Suspense>` at the default export
because of `useSearchParams`. Nothing you add changes that.

**F16. `conn(org.id)` is safe for media orgs.** `connCounts` is built over
`catalog.orgs` in full (the `connCounts` useMemo), not over `brandOrgs`, so a media org has a real
entry and `EMPTY_CONN` is only a defensive fallback.

---

## 6. Task specs

### T1. Shared partner resolution (`src/lib/partners.ts`, new file)

One small module so the index and the landing page cannot disagree.

```ts
import type { Org } from "@/types"

/** The commercial tier. 'curated' is editorial quality; 'founding' is a paying
 *  presenting partner and is the only tier that earns the featured slot and the
 *  landing card. See features/presenting-partner-surfacing-brief.md D1. */
export function isPresentingPartner(org: Org): boolean {
  return org.curation_tier === "founding"
}

/** Every presenting partner in a given set, name-sorted for stable order. */
export function presentingPartners(orgs: Org[]): Org[] {
  return orgs.filter(isPresentingPartner).sort((a, b) => a.name.localeCompare(b.name))
}

/** The single partner the landing page features (D9). Null when there is none,
 *  which is the correct state until an org is set to 'founding' in /admin/brand. */
export function primaryPresentingPartner(orgs: Org[]): Org | null {
  return presentingPartners(orgs)[0] ?? null
}

/** Eyebrow copy for a partner surface. partner_label is admin-editable and
 *  founding-gated; this is the fallback when it is empty. */
export function partnerEyebrow(org: Org): string {
  return org.partner_label?.trim() || "Presenting Partner"
}
```

### T2. Featured group on `/[community]/brands`

**T2.1** Import `presentingPartners` and derive the group from `allOrgs`, NOT
`brandOrgs` (D2 / F3). Place it beside the existing `sortedShows` derivation
at `page.tsx:231`:

```ts
// Presenting partners (curation_tier='founding') are pinned above every bucket
// and every sort. Derived from allOrgs, not brandOrgs, because a partner may be
// any org_type: FNRad is org_type='media' and would otherwise be invisible here
// (brief F3). Derived AFTER search/myOnly so the pin respects filters (D6).
const featuredPartners = presentingPartners(allOrgs)
const featuredIds = new Set(featuredPartners.map((o) => o.id))
```

**T2.2** Exclude featured orgs from their home buckets so nothing renders twice
(D3). This touches four derivations. The cheapest correct edit is to filter once,
at the source, and let everything downstream inherit it. Insert immediately after
`allOrgs` is computed (`:192-201`) and before `brandOrgs` at `:202`:

```ts
// Featured partners are lifted out of the normal buckets (D3): they render once,
// at the top. Everything below buckets off the remainder.
const unfeaturedOrgs = allOrgs.filter((o) => !featuredIds.has(o.id))
```

then repoint `brandOrgs` (`:202`), `teams` (`:203`), `shops` (`:204`) and
`sortedShows` (`:231`) from `allOrgs` to `unfeaturedOrgs`. **Check all four**; `sortedShows` at `:231` is the one that
matters for FNRad and it is the easiest to miss because it sits apart from the
other three.

Note the ordering constraint: `featuredIds` must be computed before
`unfeaturedOrgs`, and both after `allOrgs`. `grouped` (`:211`) and the `sorted*`
lists (`:226-228`) then follow unchanged because they already read from those buckets.

**T2.3** Render the section. It goes INSIDE `<div className="space-y-10">`
(`:318`) but ABOVE the `sort === "category"` ternary (`:319`), so it survives every sort
(D5 / F12):

```tsx
{featuredPartners.length > 0 && (
  <section>
    <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
      {featuredPartners.length === 1 ? "Presenting Partner" : "Presenting Partners"}
    </h2>
    <div className="space-y-2">
      {featuredPartners.map((org) => (
        <OrgCard key={org.id} org={org} conn={conn(org.id)} />
      ))}
    </div>
  </section>
)}
```

Reuse `OrgCard` as-is (F14). The founding org already gets its logo and its
"Curated" pill from the existing `isCurated` branch at `:46`.

**T2.4. CONFIRMED IN SCOPE by Jay, September 8.** In `OrgCard`, when
`org.curation_tier === "founding"` and `org.partner_label` is set, render the
partner label instead of the generic "Curated" pill, so the card says
"Founding Brand Partner" rather than "Curated". One conditional at the pill, `:77`. Keep
the same pill styling. If `partner_label` is empty, fall back to "Curated"
unchanged.

### T3. Presenting-partner card on `/`

**T3.1** Read the catalog in `src/app/page.tsx`, matching the existing selector
style at `:11`:

```ts
const orgs = useLineageStore((s) => s.catalog.orgs)
const catalogLoaded = useLineageStore((s) => s.catalogLoaded)
const partner = catalogLoaded ? primaryPresentingPartner(orgs) : null
```

**T3.2** Render the card BETWEEN the snowboarding focus card (ends `:122`) and
the equity teaser (`:124`). Not above the focus card (F11 / BUG-017). Copy of
record is in Appendix A. Shape:

- eyebrow: `partnerEyebrow(partner)`, small, uppercase, tracked, muted
- `logo_url` when present, on a white rounded tile so a dark logo survives the
  force-dark scope (F10); initial block fallback matching `OrgCard`'s pattern
- name in `font-semibold text-foreground`
- `description` truncated to roughly 120 characters, `text-muted`, omitted entirely
  when empty
- a single link to `/{community}/brands/{orgSlug(partner)}` (D10), using
  `orgSlug` from `@/lib/mock-data` as the brands page does at `:57` (`import { orgSlug } from "@/lib/mock-data"`, `:7`). The landing
  page is not community-scoped, so hardcode `snowboarding` to match the rest of
  the file (`:82`, `:117`), or read the single launch community as the banner
  does at `:15`. Prefer matching the file's existing hardcode; this page is
  explicitly single-community at launch per its own comment at `:14`.

**T3.3** Render nothing at all when `partner` is null. No placeholder, no empty
state, no reserved height. Until Jay flips a tier in `/admin/brand`, the landing
page is byte-for-byte what it is today.

---

## 7. Surface pairing (playbook check 12)

Every behaviour this brief adds has a surface, and every surface has a way to be
turned on:

| Behaviour | Surface | Control |
|---|---|---|
| Featured group at top of brands index | `/[community]/brands` | `/admin/brand/[id]` tier dropdown, exists (F6) |
| Partner label on the card | same | `/admin/brand/[id]` partner label field, exists, founding-gated (F5) |
| Landing presenting-partner card | `/` | same tier dropdown |
| Card copy and logo | `/` | `/admin/brand/[id]` description + logo URL, exist (F6) |
| Turning the whole thing off | both | set tier back to `curated` or `standard` |

No orphan endpoint, no behaviour without a control, no control without a surface.

---

## 8. Acceptance criteria

1. `npx tsc --noEmit` clean.
2. `npm run lint` clean.
3. **Zero state.** With no org at `curation_tier='founding'`, `/` and
   `/snowboarding/brands` render exactly as they do on `main` today. Diff them
   visually before flipping anything.
4. **FNRad case.** Set the FNRad org to `founding` in `/admin/brand/[id]`. It now
   appears in a "Presenting Partner" section at the TOP of `/snowboarding/brands`,
   and it **no longer appears under "Shows & Media"**. It appears exactly once on
   the page.
5. **Brand case.** Set any `org_type='brand'` org to `founding`. It appears at the
   top and is gone from the flat list. Switch the sort to "Category": it is still
   pinned at the top and is not inside its category group.
6. **Sort survival.** The featured section renders identically under all three
   sorts (Most connections, Category, A-Z).
7. **Filter behaviour.** Search for a term the partner does not match: the
   featured section disappears. Clear the search: it returns. Toggle "My Brands"
   with a partner the member is not connected to: it disappears.
8. **Header count unchanged.** The number in the header reads the same before and
   after a brand org is promoted (D4). Confirm by counting cards.
9. **Landing card.** With FNRad at `founding`, `/` renders the card below the
   snowboarding focus card and above the equity teaser. It links to the FNRad
   brand page. With no founding org, nothing renders.
10. **No layout shift on `/`.** Hard-reload with a throttled connection: the hero
    and the focus card must not move when the catalog lands. The card appears
    below the fold-relevant content (D8 / F11).
11. **Dark scope.** The card is legible in the force-dark landing subtree,
    including a dark partner logo on the white tile (F10).
12. **Mobile.** 0px horizontal overflow at 375px and 414px on both surfaces. The
    partner name must not clip the way BUG-187 clipped the feed actor name; if you
    use `truncate`, pair it with `min-w-0` on the flex parent.
13. **Two partners.** Temporarily set a second org to `founding`: the brands index
    heading pluralizes and shows both; the landing page still shows exactly ONE
    (D9). Set it back.

---

## 9. Migration

**None.** No new tables, no new columns, no backfill, no view rebuild, no RLS
change. `orgs` has no `_public` view (F7), so the Group F view-freeze trap does
not apply. Say "No migration this session" explicitly in the SHIP-LOG entry.

---

## 10. Risks and gotchas

**R1. The `org_type='media'` trap (F3).** Highest-probability failure in this
brief. Building the featured group off `brandOrgs` produces a feature that works
for every org except the one it was requested for, and it will look correct in
code review. Derive from `allOrgs`.

**R2. Missing the `sortedShows` repoint (T2.2).** The four bucket derivations are
not adjacent in the file; `sortedShows` sits about twenty lines below the other
three. Miss it and FNRad renders twice, once pinned and once under
"Shows & Media".

**R3. Ordering of the new derivations.** `featuredIds` must exist before
`unfeaturedOrgs`, which must exist before `brandOrgs`. `allOrgs` is a `useMemo`
so the plain `const` derivations below it are fine, but keep them in that order or
you get a TDZ error at runtime rather than a type error at build.

**R4. Landing-page layout shift (D8).** The card is the first async-dependent
element on a page that is otherwise fully static on first paint. Placing it above
the focus card would push the primary CTA down after hydration, which is precisely
the regression BUG-017 was filed for.

**R5. Force-dark logos (F10).** A partner logo designed for light backgrounds
disappears on the landing page without the white tile. The brands index does not
have this problem because it is theme-following; the landing page does.

**R6. Do not widen `isCurated`.** `OrgCard` at `page.tsx:46` and
`brands/[slug]/page.tsx:569` both treat `'founding'` as a superset of
`'curated'`. That is correct and should stay. T2.4 adds a founding-only branch
INSIDE that, it does not replace it.

**R7. `curation_tier` is optional in the type.** It is `curation_tier?:`, so
`undefined` is a real case for most rows. `isPresentingPartner` uses a strict
equality check, which handles `undefined` correctly. Do not write
`org.curation_tier !== "standard"`, which would treat `undefined` as founding.

**R8. This brief does not set FNRad's tier.** If the acceptance run leaves FNRad
at `founding` in prod, that is a live commercial change to the landing page.
Confirm with Jay before leaving it on, or set it back to `standard` and let him
flip it when he wants it live.

---

## 11. Rollback

Pure client render, no data. Revert the PR. If a partner needs pulling
immediately without a deploy, set the org's `curation_tier` back to `'curated'` in
`/admin/brand/[id]` and both surfaces empty out on the next catalog load.

---

## 12. Suggested order

1. **Step 0** database check (P4). Note what FNRad's tier actually is.
2. **T1**, `src/lib/partners.ts`. Trivial, and it makes T2 and T3 short.
3. **T2.1 to T2.3**, the brands index. Verify acceptance 4, 5, 6, 7, 8 before
   moving on; this is where the real risk is.
4. **T2.4**, the partner-label pill. Confirmed in scope; roughly ten minutes.
5. **T3**, the landing card. Verify acceptance 9, 10, 11.
6. **Acceptance 12 and 13**, mobile and multi-partner.
7. Set FNRad's tier back per R8 unless Jay says leave it live.
8. `tsc`, lint, PR.

---

## 13. Ship sequence

No migration, so the gate is simple. Client render only, no auth path, no
payments, no membership write, no deletion path. **This is SAFE: self-merge with
`gh pr merge` once `tsc` is clean**, then confirm Vercel auto-deploys `main`.

Log the ship in `bugs/SHIP-LOG.md` as `type: feature`, `ids: none`,
`scope: presenting-partner-surfacing`, `migration: none`, `status: merged`.

The one thing to flag to Jay in chat rather than assume: whether FNRad's tier is
left at `founding` when you finish (R8). That is a commercial decision, not a
build decision.

---

## 14. Follow-ups, NOT this session

1. **Part (b), the curated featured page.** Decided shape, per Jay September 8: a
   hand-edited constants file in `src/lib/`, same pattern as `src/lib/fnrad.ts`,
   holding a typed list of `{ title, href, description }` entries. No table, no
   admin screen, no migration. The open question is the nav entry, and it is a
   chassis decision: the lens row is a fixed three slots by design
   (`lens-row.tsx:15`), so a "Featured" destination is more likely a category-row
   entry or a link from the landing card than a fourth lens. Draft after episode 1
   with click data from (a) and (c) in hand.
2. **A dedicated sponsor column.** If Jay ever needs to choose WHICH founding org
   gets the landing card, or to order several, D9's name-sort stops being enough
   and `sponsor_rank` earns its migration.
3. **A click event on the partner card.** `partner_card_clicked` with the org id,
   so the sponsorship can be reported on. Cheap, but it belongs with the funnel
   event taxonomy in `features/funnel-event-completion-brief.md` rather than
   bolted on here.
4. **Partner placement elsewhere.** The idea bullet also implies presence on other
   index pages. That overlaps the separate September 8 idea, "give the other index
   pages the treatment the boards page has", and the two should be drafted as one
   pass over Places / Events / Riders / Brands rather than twice.

---

# Appendix A: copy of record

## A1. Brands index section heading (T2.3)

Singular: `Presenting Partner`
Plural: `Presenting Partners`

Same treatment as the existing section headings on the page:
`text-xs font-semibold text-muted uppercase tracking-widest mb-4`.

## A2. Card pill (T2.4)

Use `org.partner_label` verbatim when set, e.g. `Founding Brand Partner`.
Fall back to the existing `Curated` when empty. Same pill styling as today.

## A3. Landing card (T3.2)

Eyebrow: `org.partner_label` when set, else `Presenting Partner`.

Title: the org name, verbatim.

Line: `org.description`, truncated near 120 characters with an ellipsis. Omit the
element entirely when the description is empty rather than rendering a blank row.

Link text: `Visit {name}` for the single action. Do not write "Learn more"; the
category-page CTA pass established that Linestry names the destination.

No em dashes anywhere in the rendered copy. Use a middot separator if you need
one, matching `OrgCard`'s existing `·` usage in the card subtitle.

## A4. SHIP-LOG entry skeleton

```
## 2026-09-XX - Presenting partner surfacing (feature)
- type: feature
- pr: #NNN
- branch: feat/presenting-partner-surfacing
- ids: none
- scope: presenting-partner-surfacing
- migration: none
- status: merged
- tsc: clean
```
