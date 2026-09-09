# Bug-fix brief: one "unverified" badge, and make it say what it is judging

**Drafted:** August 27, 2026 (daily triage, auto-drafted)
**Verified against:** `main` @ `44fb3c5`
**In scope:** BUG-177, BUG-178
**Size:** small to medium. ~1.5 to 2.5 hr. Client and copy only, no migration.
**Suitability:** PIPELINE-SAFE. Presentational only. No DB write path, no auth, no payments, no `_public` view, no migration.

---

## Goal

The word "unverified" appears in three different visual treatments across the site, and where it does appear it looks like a verdict on the claim when it is actually a status on the catalog entity the claim points at. Ship one shared badge and one label that says what it means.

---

## DECISIONS (review before building)

**D1. Which treatment wins.**
Recommended: the outline chip used by the catalog list pages (`text-[10px] text-amber-600 border border-amber-500/40 rounded px-1.5 py-0.5`, no fill, no glyph). It is the most-used variant, it is legible on both the light `.postcard` surface and the dark app background, and it is quiet enough not to shout on a feed card.
Alternative: keep the filled `UnverifiedBadge` pill and repaint the catalog pages to match. Rejected: a filled amber pill on a card that already carries a predicate pill and a confidence badge is visually loud, and it is the treatment the reporter singled out.

**D2. Keep or drop the `◎` glyph.**
Recommended: drop it. Only one of the three variants has it, the reporter's comparison surfaces do not, and a lone glyph next to two other chips reads as noise. Alternative: keep it on every instance. Do not leave it on some and not others, which is the bug.

**D3. What the badge should say (BUG-178).**
Recommended: **`unverified place`, `unverified brand`, `unverified board`, `unverified event`**, driven off the entity type already in hand at each call site. That single word of context is what makes the inconsistency legible: the badge tracks the catalog entity, not the rider's claim, so a rider who logged Lake Louise (a known catalog place) gets no badge while the same rider logging a place they just added does.
Alternative A: leave the bare word `unverified` and rely on placement. Cheapest, but leaves BUG-178 open.
Alternative B: move the badge up next to the entity name instead of down in the metadata row. Stronger fix, larger diff, and it fights the existing card layout. Prefer B only if Jay explicitly wants it.

**D4. Scope of the sweep.**
Recommended: the seven catalog-status call sites listed under BUG-177. Deliberately OUT of scope: the `confidence === "self-reported" ? "unverified" : ...` renders on the brand detail page (`brands/[slug]/page.tsx` lines 1032, 1079, 1118, 1177, 1256, 1309). Those are a DIFFERENT concept (claim confidence, not entity status) that happens to share the word, and collapsing them into the same badge would be wrong. Flag them for a separate copy pass; do not touch them here.
Alternative: unify all of it. Rejected, it merges two different meanings.

**D5. `/claim/[token]` third variant.**
Recommended: repoint it to the shared badge too, with no type word (its subject is a person node, not a catalog entity). Alternative: leave it alone as a standalone surface. Repointing is two lines and removes the third fork.

---

## BUG-177: The "unverified" chip renders in three different treatments

**Severity:** P2.
**Repro flag:** reproducible. Root cause verified in code.
**Reported:** August 25, 2026, 14:45 UTC, `R1`, iPhone Safari 26.4, viewport 414x340, from `https://linestry.com/snowboarding/brands`.
**Reporter's words:** "The unverified tag appearance is different in the Feed section vs other sections."
**Session replay:** `posthog replay S-48 (link in bugs/private/session-ids.md)`
**Image reviewed:** `1a03961f1b489cc0__0__bug-screenshot.jpg`. Shows the Brands catalog list at 414px: DC, Elan Snowboards, Endeavor Snowboards and Forum each carry a small outline "unverified" chip beside the brand name, while Gnu, Jones and K2 (established catalog brands with descriptions) carry none.

### Verified facts (grepped against `44fb3c5`)

1. **Variant 1, the shared component.** `src/components/ui/badge.tsx:13-19`: `UnverifiedBadge()` renders `bg-amber-950/60 text-amber-400 border border-amber-800/40` with a leading `◎`. Those are dark-theme-tuned values: an `amber-950` fill under `amber-400` text.
2. **Where variant 1 lands.** `src/components/feed/post-card.tsx:6` imports it and `:687` renders it inside a container carrying the `postcard` class (`:663`). Per repo `CLAUDE.md` gotcha 7, `.postcard` **forces light-theme tokens even in dark mode**. So the one place this badge appears in the feed is the one place its dark palette is guaranteed to be wrong. This is the reported difference.
3. Also variant 1: `src/components/timeline/claim-card.tsx:5` (import), `:48` (`isUnverified`), `:102` (render).
4. **Variant 2, the outline chip, hand-rolled five times.** `src/app/(community)/[community]/brands/page.tsx:79`; `places/page.tsx:57`; `events/page.tsx:110`; `boards/board-parts.tsx:369` (absolute-positioned cover overlay, adds `bg-background/80 backdrop-blur-sm`) and `:426` (inline). All five are the literal string `text-[10px] text-amber-600 border border-amber-500/40 rounded px-1.5 py-0.5`, none imports the shared badge, none has the glyph.
5. **Variant 3.** `src/app/claim/[token]/page.tsx:217`: a third palette again: `bg-amber-900/30 text-amber-600 border border-amber-900/50`.
6. **One source of truth for the state.** Every one of those call sites gates on `community_status === "unverified"` (`src/types/index.ts:5`, `CommunityStatus = "verified" | "unverified"`), so the state is consistent; only the rendering has forked.

### Acceptance criteria

- `UnverifiedBadge` is the only place the entity-status chip is styled. `grep -rn 'text-amber-600 border border-amber-500/40' src` returns nothing.
- The badge renders identically on the feed (`/snowboarding/feed`), a personal timeline, and the Brands, Places, Boards and Events catalog lists.
- It is legible in BOTH themes, and specifically legible inside a `.postcard` (which is light even in dark mode). Check this one explicitly, it is the whole bug.
- The board cover overlay instance keeps its absolute positioning and its `bg-background/80 backdrop-blur-sm` scrim, so it stays readable over a cover image. Pass those through as an optional `className`, do not lose them.
- No layout shift on the 414px catalog rows.

---

## BUG-178: A rider's claims show "unverified" on some entries and not others, with nothing to explain why

**Severity:** P2.
**Repro flag:** reproducible. Behaviour is CORRECT; the labelling is what fails.
**Reported:** August 25, 2026, 14:37 UTC, `R1`, iPhone Safari 26.4, viewport 414x305, from `https://linestry.com/snowboarding/feed`.
**Reporter's words:** "Not sure if this a bug or not. Geoff Peterson added a bunch of Rode At to his timeline. In the feeds area for Geoff. Some are tagged unverified while others are not. Just double checking if this right?"
**Session replay:** same session as BUG-177, `replay/S-48`
**Image reviewed:** `1a0395ae6713e033__0__bug-screenshot.jpg`. Four consecutive Geoff Peterson cards in the feed at 414px. "Lyon Mountain, Alberta, Canada / RODE AT 2026 / Self-reported / unverified" carries the badge. "Lake Louise Ski Resort, AB, Canada / RODE AT 1990 / Self-reported" does not. Both are the same predicate, same rider, same "Self-reported" confidence. The only difference is the place.

### Diagnosis

Not a defect. `post-card.tsx:622-629` derives `isUnverified` from `userEntities` (user-created places, boards, orgs, events) and checks `community_status`, so the badge is a status on the **place**, not on the rider's claim. Lake Louise is an established catalog place; Lyon Mountain was added by a member and is still unverified. The badge is accurate.

The failure is that it sits in the metadata row immediately after `ConfidenceBadge` ("Self-reported"), which is a judgement about the claim. Two chips side by side, one about the claim and one about the place, with nothing distinguishing them. A careful reader (the reporter is one) reads it as the system arbitrarily doubting some of his entries.

D3 is the fix: give the badge its noun.

### Acceptance criteria

- On a feed or timeline claim card pointing at an unverified user-added place, the chip reads `unverified place` (and correspondingly `unverified brand` / `unverified board` / `unverified event`).
- On the catalog list pages the chip may stay as the bare `unverified`: the surrounding page already establishes the noun. Take whichever reads better on screen, but be consistent within each surface and say which you chose in the PR body.
- A claim pointing at an established catalog entity still shows NO badge. Do not "fix" this by badging everything.
- The claim's own `ConfidenceBadge` ("Self-reported") is untouched. It is a different axis and stays exactly as it is.
- Verify on prod data with two Geoff Peterson `rode_at` cards, one to Lyon Mountain and one to Lake Louise, that the pair now reads as clearly about the place.

---

## Suggested order

1. Preflight: read `src/components/ui/badge.tsx` whole, plus the two `UnverifiedBadge` call sites and the five hand-rolled ones listed above.
2. Rewrite `UnverifiedBadge` to the D1 outline treatment, drop the glyph per D2, and add two optional props: an entity-type noun (D3) and a `className` passthrough for the board cover overlay.
3. Repoint `post-card.tsx:687` and `claim-card.tsx:102`, passing the noun. Both already have `claim.object_type` in scope, so the noun is a lookup, not a new derivation.
4. Repoint the five catalog call sites, then `/claim/[token]/page.tsx:217` per D5.
5. Grep sweep for stragglers: `grep -rn 'amber-500/40\|amber-950/60\|amber-900/50' src`.
6. `npx tsc --noEmit`, then look at the feed, a personal timeline, and the Brands list in BOTH themes at 414px.

## Migration

**No migration this session.** Presentational only. No schema, no `_public` view, no write path.

## Out of scope, flagged for later

- The six `confidence === "self-reported" ? "unverified" : confidence` renders on `brands/[slug]/page.tsx` (D4). Same word, different meaning. They deserve their own copy pass, and "Self-reported" versus "unverified" for the same underlying value is itself worth a decision.
- BUG-109 (a curated or verified brand shows "unverified" on its own timeline entries) lives in the same badge neighbourhood and its brief `2026-06-25-brand-timeline-verified-badge.md` is stale. If this session's sweep happens to resolve it, say so in the PR body and the triage will reconcile it. Do not widen scope to chase it.

## Wrap

- Name `BUG-177` and `BUG-178` in the PR title or commit message. The daily triage reconciles off those ids.
- Append a `bugs/SHIP-LOG.md` entry: `type: bug`, `ids: BUG-177, BUG-178`, `migration: none`, `status: merged` once merged.
- Do NOT edit the Shipped section of `bugs/bug-triage.md`.
- No em dashes anywhere, including in the badge copy.
