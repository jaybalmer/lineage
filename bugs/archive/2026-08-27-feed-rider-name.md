# Bug-fix brief: community feed claim cards render with no rider name

**Drafted:** August 27, 2026 (daily triage, auto-drafted)
**Verified against:** `main` @ `44fb3c5`
**In scope:** BUG-176
**Size:** small. ~45 to 90 min. Client-only, one file, no migration.
**Suitability:** PIPELINE-SAFE. No DB write path, no auth, no payments, no `_public` view, no migration. Safe for the unattended 05:00 slot.

---

## Goal

Every card on `/[community]/feed` names the rider it belongs to. Today a claim card can render its action line ("shredded a spot", "hit a place") with the rider's name silently missing, so the feed reads as a wall of anonymous events.

---

## DECISIONS (review before building)

**D1. What causes the blank name, and therefore what to fix.**
Recommended: treat it as a catalog-load race, not a data problem. `authorForClaim` resolves the name purely from the client-side `catalog.people` array, which is deliberately NOT persisted to localStorage and arrives asynchronously from `CatalogLoader`. The feed fetches and paints its own entries independently, so on a cold load (mobile, slow network) claim cards can paint before `catalog.people` exists, and `ContextLine` renders `null` for the name.
Alternative: denormalize a subject display name onto the claim payload server-side. Correct but heavier, and `claims_public` is a view read through PostgREST where embedded selects have bitten this codebase before (see the standing view gotchas). Do not take this path in this session.

**D2. How to close the race.**
Recommended: gate the feed's claim rendering on `catalogLoaded`, the pattern already used by every other public community surface (`places/[id]/page.tsx:43`, `brands/[slug]/page.tsx:373`, `boards/[id]/page.tsx:163`, `events/[id]/page.tsx:634`, `[community]/page.tsx:110`). Fold it into the existing `loading` gate at line 293 so the feed shows its existing "Loading…" state until both the fetch AND the catalog have landed. Verified safe for signed-out visitors: those same gated pages are all publicly browsable, so `catalogLoaded` does become true without a session.
Alternative: render a name skeleton per card instead of holding the list. More code, more flicker, no real gain.

**D3. What to show when the subject is genuinely absent from a loaded catalog.**
Recommended: render the neutral fallback `A rider` (unlinked, same `font-medium text-foreground` treatment) so the action line never floats bare. A subject can legitimately be missing after the catalog has loaded: an archived profile (`profiles.is_archived`, PR #157), or a person outside the active community scope.
Alternative: hide the whole card. Rejected, it silently drops real content.

**D4. Copy for the fallback.**
Recommended: `A rider`. Alternative: `Someone`. Lowercase-shy and neutral either way; do not use "Unknown" or "Anonymous", which read as an error state.

---

## BUG-176: Feed claim cards render with no rider name

**Severity:** P2, top of P2. Launch-facing: `/snowboarding/feed` is the main community browse surface.
**Repro flag:** reproducible.
**Reported:** August 25, 2026, 15:06 UTC, `R1`, iPhone Safari 26.4, viewport 414x750, from `https://linestry.com/snowboarding/feed`.
**Reporter's words:** "Some feeds are missing the Rider's name at the top."
**Session replay:** `posthog replay S-48 (link in bugs/private/session-ids.md)`
**Image:** `1a039753cb482736__0__bug-screenshot.jpg` is in the Drive folder but returned no OCR text on two attempts, so this entry is written from the email body plus a code trace, not from the image. Worth a manual look before building.

### Verified facts (grepped against `44fb3c5`)

1. `src/app/(community)/[community]/feed/page.tsx:201-203`: `authorForClaim(claim)` is exactly `catalog.people.find((p) => p.id === claim.subject_id)`. Client catalog is the only name source for a claim.
2. Same file, `:332-334`: the claim branch passes `name={author?.display_name}` and `href={author ? ... : undefined}` into `ContextLine`.
3. Same file, `:105-111`: `ContextLine` renders the name only when `name` is truthy, and otherwise renders **nothing at all**, leaving the bare `action` span (`:112`). This is the visible symptom: an action line with no subject.
4. Same file, `:307`: the STORY branch takes its name from `entry.story.author?.display_name`, which comes off the `/api/stories` payload, not the catalog. Stories are therefore unaffected. Matches the report, which is about claim rows.
5. Same file, `:144-153`: claims are read straight from `claims_public` with `.select("*")`. No joined subject name, no embedded profile. Confirmed there is nothing on the payload to fall back to.
6. `src/types/index.ts:499-529`: the `Claim` interface carries no denormalized subject name. `asserted_by` is a user id, not a display name.
7. Repo `CLAUDE.md` gotcha 4: `catalog` is excluded from Zustand localStorage persistence and re-fetched on every page load. Combined with fact 1 this is the race.
8. `grep -n catalogLoaded` on the feed page returns **nothing**. The feed is the outlier: it never waits for the catalog, while every sibling public detail page does.

### Acceptance criteria

- On a hard reload of `/snowboarding/feed` with the network throttled to Slow 3G, no claim card ever paints with a missing rider name. The list waits behind the existing "Loading…" state instead.
- Signed OUT, `/snowboarding/feed` still renders a full feed with rider names. This is the regression risk of D2 and must be checked explicitly.
- A claim whose `subject_id` resolves to nobody in a fully loaded catalog renders `A rider` plus its action line, and that name is not a link.
- Story cards are unchanged: same name, same link, same `ago` chip.
- Rider names that DO resolve still link to `/people/<slug>` exactly as before.
- `npx tsc --noEmit` clean.

### Suggested order

1. Read `src/app/(community)/[community]/feed/page.tsx` whole before editing (mutation-path preflight).
2. Pull `catalogLoaded` off the store next to the existing `const { catalog, activePersonId } = useLineageStore()` at `:120`.
3. Extend the render gate at `:293` so the loading branch covers `loading || !catalogLoaded`.
4. Add the D3 fallback inside the claim branch at `:327-336`: when `author` is undefined, pass the fallback string and leave `href` undefined.
5. Optional tidy, only if it costs nothing: `ContextLine` currently has a three-way name branch (`name && href`, `name`, `null`). With D3 the `null` arm becomes dead for claims but is still reachable from a story with no author, so leave it in place.
6. `npx tsc --noEmit`, then smoke signed-out and signed-in at 414px.

### Migration

**No migration this session.** No schema change, no `_public` view touched, no write path.

---

## Wrap

- Name `BUG-176` in the PR title or commit message. The daily triage reconciles off that id.
- Append a `bugs/SHIP-LOG.md` entry using the schema at the top of that file: `type: bug`, `ids: BUG-176`, `migration: none`, `status: merged` once you have merged it.
- Do NOT edit the Shipped section of `bugs/bug-triage.md`. The daily triage reconciles that.
- No em dashes anywhere, including in the `A rider` fallback copy and any comment you leave.
