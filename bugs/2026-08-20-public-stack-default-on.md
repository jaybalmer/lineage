# 2026-08-20: Public Stack on by default for every member (BUG-174)

**Scope: BUG-174** (only some profiles show the Stack view button). Root cause is the opt-in gate: the Stack/Timeline toggle on `/people/[id]` renders only when the viewed profile has `public_timeline_enabled = true` and a `public_slug`. Jay's call (August 20, live session): the public Stack is the same information as the member's public timeline, read through the same visibility rules, so it goes on by default for everyone.

**Goal (one line):** every member profile has a live `/t/[slug]` with a Stack, so the toggle appears consistently; uncurated members get an auto-derived starter of their 3 most recent public timeline items.

**Session type:** ATTENDED or HUMAN-REVIEWED. Carries a GATED migration on `profiles` (pre-approved by Jay in this brief, but apply it with the full ship-sequence printout, and it is a hard PRE-merge gate for the default-flip portion, see Ordering).

---

## DECISIONS (review before building)

1. **Starter content = the 3 most recent public timeline items** (Jay's words: "the 3 most recent ... as the default until the user curates"). Recommended reading: the 3 most recent items from the already-read public timeline payload, stories preferred, claims filling if fewer than 3 stories, ordered by date descending. Alternative: reuse the richer D7 suggested-starter heuristic that `/me/public-view` already has (photo-rich stories + first/latest place + boards). Build on 3-most-recent; it is what Jay asked for and it is simpler.
2. **Derive server-side in `readPublicStack`**, not in the React view. When `public_stack_entries` is empty, return derived entries flagged `derived: true` instead of `entries: []`. Alternative: derive in `PublicProfileView`. Server-side keeps OG/metadata and any future consumers consistent. Build server-side.
3. **Curating replaces the starter entirely.** The starter renders only while the member has zero saved `public_stack_entries`; the first save switches them to their curated set. No migration of starter items into saved rows. (This is just the existing seeding behavior on `/me/public-view`, which already seeds the editor with a suggested starter.)
4. **RENAME LOCKED (Jay, August 20 live session): the pair is "Mini / Full".** Member-facing copy only; ALL internal identifiers stay (`stack` view key, `public_stack_entries`, `readPublicStack`, component and route names, `public_timeline_default_view` values). Verified copy inventory, complete as of today:
   - `src/components/public-timeline/stack-timeline-toggle.tsx:62`: `seg("stack", "Stack", stackHref)` label becomes "Mini"; the sibling timeline segment label becomes "Full". Toggle reads "Mini | Full".
   - `src/components/profile/owner-timeline-panel.tsx:759`: "Edit my Stack" / "Set up my Stack" become "Edit my Mini timeline" / "Set up my Mini timeline".
   - `src/app/me/public-view/page.tsx:361`: h1 "Your public view (Stack)" becomes "Your Mini timeline".
   - `src/app/me/public-view/page.tsx:324`: the two "Stack saved..." toasts become "Mini timeline saved...".
   - `src/app/me/settings/public-timeline/page.tsx:145`: "Curate your Stack View" becomes "Curate your Mini timeline".
   - Grep `src` for any other user-visible "Stack" string before wrapping (code comments do not count); `stack-view.tsx`, `stack-header.tsx`, and `public-profile-view.tsx` carry none today.
5. **Archived and non-public profiles are excluded from the backfill.** Skip `is_archived IS TRUE`. Run the §Pre-flight query on `privacy_level` first: if any member is `privacy_level = 'private'`, skip them too and list them in the wrap notes. "Same rules as their main timeline" is the principle; do not force a public surface onto an explicitly private profile.

---

## Verified facts (checked against main, 2026-08-20)

- Toggle gate: `src/app/people/[id]/page.tsx:148-162` fetches `public_slug, public_timeline_enabled` and renders `StackTimelineToggle` (line ~302-313) only when both hold. Owner variant: `src/components/profile/owner-timeline-panel.tsx:271-380,742-765` (BUG-160 links "Set up my Stack" / "Edit my Stack"). Neither needs code changes; the backfill makes the condition true for all members. People with no `profiles` row (ghosts, catalog) keep no toggle, correct.
- Enable path: `POST/PATCH /api/me/public-timeline` (`src/app/api/me/public-timeline/route.ts`) flips the flag and mints a slug via `ensureUniquePublicSlug` from `src/lib/public-slug.ts` when `public_slug` is null.
- New-user creation is TWO paths: (a) client upsert in `src/app/auth/complete/page.tsx:74` (new users only; anon key, cannot mint server-side), (b) `ensureProfile(userId, email)` in `src/lib/auth.ts:21`, called on every auth-gated request (the orphan-auth auto-create). Recommended: set the DB default so new rows are born enabled (migration below) and extend `ensureProfile` to mint a slug when `public_slug` is null. That covers both paths without touching the client upsert.
- Stack read: `readPublicStack(slug, timeline)` in `src/lib/public-timeline-read.ts` returns `{ owner, entries: [] }` when no curated rows (line ~686). It already receives the fully-read timeline payload, so deriving 3-most-recent needs no extra query.
- View decision: `/t/[slug]/page.tsx:140-144` passes both payloads to `PublicProfileView`, which "decides from stack.entries". With derived entries present, uncurated members get a real Stack view. Read that decision logic before building so the derived flag does not accidentally change the default-view resolution for members who explicitly set `public_timeline_default_view`.
- Slug collision safety: `ensureUniquePublicSlug` plus the BUG-159 `public_slug_aliases` table (migration `20260817000001`) already handle collisions and slug history. The backfill must go through the same helper, not raw SQL slug construction.
- Visibility: `/t/[slug]` reads through the `_public` views and the visibility-safe read paths (PB-010 Phase 2). Nothing in this brief adds a new read; the "same info as their timeline" premise holds by construction.

## Pre-flight (run before building)

```sql
-- How many members does the backfill touch, and are any private?
select public_timeline_enabled, count(*) from profiles group by 1;
select count(*) from profiles where public_slug is null;
select privacy_level, count(*) from profiles group by 1;
select count(*) from profiles where is_archived is true;
```

## Migration + backfill (GATED, pre-approved by Jay 2026-08-20; still print + verify per ship sequence)

1. SAFE portion: `alter table profiles alter column public_timeline_enabled set default true;`
2. GATED portion (UPDATE on pre-existing `profiles` rows):
   `update profiles set public_timeline_enabled = true where public_timeline_enabled is distinct from true and is_archived is not true` (add the `privacy_level` exclusion if the pre-flight surfaces private members).
3. Slug minting for rows where `public_slug is null`: do this in code (a small one-time script or an admin route invocation) through `ensureUniquePublicSlug`, NOT raw SQL, so collision + alias behavior matches the live path.
4. **Ordering:** the DB default change and backfill are independent of the code, but merge the starter-derivation code BEFORE or WITH the backfill; enabling everyone while `readPublicStack` still returns empty entries ships a wave of empty Stacks.

## Acceptance criteria (BUG-174)

- Every non-archived member profile shows the Stack/Timeline toggle on `/people/[id]`, signed in and signed out (the report's repro: `/people/sean_spud_balmer` signed out now shows it).
- An uncurated member's `/t/[slug]` renders a Stack of their 3 most recent public timeline items; a member with saved `public_stack_entries` is unchanged.
- A member with zero public timeline items gets a graceful Stack (header + empty state, no crash).
- Curating from `/me/public-view` replaces the starter; deleting all curated entries returns to the starter.
- Private-visibility stories and pending-hidden tags never appear in a starter (spot-check against a member with `require_tag_approval = true`).
- New signup (fresh account) lands enabled with a slug after first auth-gated request.
- No member-facing surface says "Stack" anywhere: the toggle reads "Mini | Full", the owner links read "Set up / Edit my Mini timeline", the manage and settings headings use "Mini timeline". Internal identifiers unchanged (`tsc` would catch accidental symbol renames).
- `npx tsc --noEmit` clean.

## Wrap

- Name BUG-174 in the PR title or commit message.
- SHIP-LOG entry: `type: fix`, `ids: BUG-174`, record the migration and the backfill row count.
- The rename ships in this session (Decision 4); no parked naming items remain from BUG-174.
- No em dashes anywhere, including UI copy.
