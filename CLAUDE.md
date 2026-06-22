# Linestry

A living, community-authored snowboarding history graph. People log their timelines (where they rode, who they rode with, what boards they used, what contests they entered) and the app builds a collective graph of the sport's history. Operated by Lineage Community Technologies Inc.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 — no config file, uses `@theme inline` in globals.css |
| State | Zustand 5 with `persist` middleware |
| Backend | Supabase (Postgres + Auth + Storage) |
| Deployment | Vercel |
| Analytics | @vercel/analytics |
| Email | Resend |
| Payments | Stripe |

**Path alias:** `@/*` → `src/*`

**Run locally:** `npm run dev`
**Type check:** `npx tsc --noEmit` (must be clean before every commit)
**Deploy:** Push to `main` — Vercel auto-deploys

---

## Project Structure

```
src/
  app/                  # Next.js App Router pages + API routes
    api/
      stories/          # CRUD for stories
      admin/            # Catalog entity creation (user-contributed)
      auth/magic-link/  # Passwordless email auth
      bug-report/       # In-app bug reports: writes bug_reports + emails a [Linestry Bug] report via Resend
      (+ stripe, gift, founding, memberships, images, etc.)
    (pages)/            # 30+ routes — see Page Inventory below
  components/
    ui/                 # Modals, nav, cards, overlays
    feed/               # FeedView, StoryCard, PostCard, etc.
    timeline/           # TimelineView, ClaimCard, DayCard
    onboarding/         # Multi-step signup wizard
  lib/
    utils.ts            # cn(), nameToSlug(), formatSmartDate(), parseYouTubeId()
    supabase.ts         # Browser client singleton
    supabase-server.ts  # Server-side session client (anon key, for auth checks)
    auth.ts             # requireAuth(), requireEditor(), getServiceClient()
    mock-data.ts        # Seed data for anon/demo users
    connection-summary.ts # Overlap-scoring algorithm
    theme.ts            # useTheme() hook
  store/
    lineage-store.ts    # Single Zustand store — all app state
  types/
    index.ts            # All TypeScript interfaces
```

---

## Core Data Model

### Entities (catalog)
- **Person** — rider profile (display_name, birth_year, riding_since, etc.)
- **Place** — resort, shop, zone, city, venue
- **Org** — brand, shop, team, magazine, event-series
- **Board** — brand + model + model_year
- **Event** — contest, film-shoot, trip, camp, gathering (has year + place)

### Claims
The heart of the app. A claim is a typed, time-bound relationship:
```
subject_id → predicate → object_id  (start_date → end_date)
```
Predicates: `rode_at | worked_at | sponsored_by | part_of_team | fan_of | rode_with | shot_by | competed_at | spectated_at | organized_at | owned_board | coached_by | organized | located_at`

Fields: `confidence`, `visibility`, `sources[]`, `note`, `approximate`, `division`, `result`

### Stories
Rich narrative posts attached to the timeline:
- `title`, `body`, `story_date` (YYYY-MM-DD), `visibility`
- `linked_place_id`, `linked_event_id`
- `board_ids[]`, `rider_ids[]` (junction tables)
- `photos[]` (story_photos table, stored in `story-images` Supabase bucket)
- `youtube_url` — any YouTube URL; parsed with `parseYouTubeId()` from utils.ts

### Riding Days
Simple daily log: date, place, riders[], note. Lighter than a full claim.

---

## Supabase Database

### Key tables
| Table | Notes |
|---|---|
| `profiles` | Auth users — linked to Supabase Auth |
| `claims` | All relationship claims |
| `stories` | Story posts |
| `story_photos` | Photos per story (cascade delete) |
| `story_boards` | Junction: story ↔ board |
| `story_riders` | Junction: story ↔ rider (profiles) |
| `riding_days` | Daily log entries |
| `boards`, `places`, `events`, `orgs`, `event_series` | Catalog entities |
| `memberships` | Stripe-backed membership records |
| `story_reactions` | One emoji reaction per member per story (composite PK story_id, reactor_id; upsert to change) |
| `story_comments` | Flat story comments, hard-deleted, no threading |
| `story_comment_notifications` | Per-story batch window (6h) for comment emails; see `supabase/migrations/20260609000001_story_reactions_comments.sql` |
| `bug_reports` | In-app bug reports (note, expected, url, viewport, user_agent, posthog_session_url, reporter_id/email). Written by `POST /api/bug-report`; see migration-010-bug-reports.sql |

### Adding a column
Run SQL directly in Supabase dashboard — there are no local migration files to maintain. After adding a column:
1. Add the field to the TypeScript interface in `src/types/index.ts`
2. Pass it through the relevant API route (`src/app/api/*/route.ts`)
3. Update the modal (if user-editable) and the card component (if displayed)

### API route pattern
Two server-side Supabase clients exist:

1. **Session client** (`createServerSupabaseClient()` from `supabase-server.ts`) uses the **anon key**. Used for `auth.getUser()` to validate the caller's session. Subject to RLS.
2. **Service client** (`getServiceClient()` from `auth.ts`) uses the **service role key**. Bypasses RLS. Used for data mutations after auth is verified.

```typescript
// Auth check pattern (used by all mutating routes):
import { requireAuth } from "@/lib/auth"         // returns { user } or 401
import { requireEditor } from "@/lib/auth"        // returns { user, profile } or 401/403
import { getServiceClient } from "@/lib/auth"     // service role client for DB ops
```

Pagination uses `.range(offset, offset + limit - 1)` — not `.limit()`.

---

## Auth

Auth is **not passwordless-only**. Three sign-in methods are surfaced at `/auth/signin`:
- **Google OAuth** via `supabase.auth.signInWithOAuth({ provider: "google" })`, redirecting to `/auth/callback`.
- **Magic link** via `POST /api/auth/magic-link`, which takes an `intent: "signin" | "signup"` body field. The server path uses `admin.generateLink` (implicit flow) + Resend, with a client `signInWithOtp` fallback when Resend or the service-role key are absent. Because `admin.generateLink` creates the user when absent, `intent: "signin"` first scans `admin.listUsers` and returns `{ error }` (no account created, status 200) for unknown emails. The OTP fallback enforces the same returning-only rule with `shouldCreateUser: false` for sign-in vs `true` for onboarding signup.
- **Email + password** via `supabase.auth.signInWithPassword`. Password reset runs through `POST /api/auth/reset-password`, which sends a branded recovery email via Resend (matching every other transactional email), with the recovery link generated on `auth.linestry.com`. The reset UI is at `/auth/forgot-password` (request) and `/auth/reset-password` (set new password); the Supabase redirect allowlist already covers the recovery target.

Onboarding (`save-step.tsx`) offers Google + magic link only, so signup stays passwordless; password is a sign-in path for members who set one through the reset flow.
- Callback: `/auth/callback` → `/auth/complete` (session establish; profile upsert and `welcome_pending` for new users only; session-claim migration).
- Session refresh on every request via `src/proxy.ts` (Next 16's `proxy` file convention; replaces the old `middleware.ts`. Lives next to `src/app/`, NOT at the project root. The exported function is `proxy`, not `middleware`.)
- **Proxy-gated routes** (`src/proxy.ts`): `/[community]/timeline/*` and `/me/*` redirect to `/onboarding` when signed out. All browse pages stay public.
- **`/admin/*` is gated separately, server-side**, by `src/app/admin/layout.tsx` calling `requireEditorPage()` (in `src/lib/auth.ts`): anonymous visitors redirect to `/auth/signin`, signed-in non-editors to `/`. "Editor" = `is_editor` OR founding tier, mirroring `requireEditor()`. One layout covers the whole `/admin/*` tree (dataset editor, results-scanner, tag-queue, activity, claims, asserters). There is **no** client-side password gate — the old shared password (`"outland"`) was removed; the per-page client checks are now fail-closed fallbacks only. Mutating `/api/admin/*` routes still enforce `requireEditor`/`requireModerator` independently.

### Distinguish auth users from mock/demo users
```typescript
import { isAuthUser } from "@/store/lineage-store"
const isAuth = isAuthUser(activePersonId) // true if UUID, false if "u1"/"dev-*"
```

### Supabase verification email
The default Supabase confirmation email is generic ("Confirm your email"). To customize it for Linestry:
- **Option A — Supabase email templates**: Go to Supabase dashboard → Auth → Email Templates → "Confirm signup". Update the subject and body to match the community tone.
- **Option B — Custom SMTP**: Add a custom SMTP provider (Resend is already in the stack) under Auth → SMTP Settings. This enables full HTML email control.
Neither blocks signup — users land on the email-confirm-pending screen either way.

---

## State — Zustand Store

Single store at `src/store/lineage-store.ts`. Key slices:

```typescript
const {
  activePersonId,   // current user's ID (null if anon)
  authReady,        // wait for this before auth-gating UI
  catalog,          // { places, orgs, boards, events, eventSeries, people, claims }
  catalogLoaded,    // boolean
  profileOverride,  // local edits to logged-in user's profile
  membership,       // tier, tokens, is_editor, etc.
  getAllClaims(),    // combines db + session + overrides + mock
} = useLineageStore()
```

**Persisted to localStorage** (`lineage-store-v2`). **NOT persisted:** catalog, dbClaims, catalogLoaded, authReady (always re-fetched fresh).

### Dual catalog system
- Anonymous users get **mock data** from `src/lib/mock-data.ts`
- Auth users get **Supabase data** — loaded once per session by `<CatalogLoader />`
- `profiles` table entries are merged into the `people` catalog array

---

## Navigation — `src/components/ui/nav.tsx`

Single `AppNav` component — same markup for all screen sizes.

**Row 1** (h-12): Logo + ThemeToggle + AvatarDropdown
**Row 2** (scrollable): Timeline · Compare · Connects · Feed · Collective
**Row 3** (scrollable, always visible): Riders · Events · Boards · Brands · Places · Stories

Active state: Row 2 = `bg-blue-600 text-white`; Row 3 = `bg-surface-active text-foreground`

---

## Styling

**Tailwind v4** (no config file). Theme tokens live in `src/app/globals.css`, defined on `:root` (light), `.dark`, and `.postcard`, then exposed to Tailwind through the `@theme inline` block as `--color-*` aliases.

```css
--background  --surface  --surface-hover  --surface-active  --surface-2
--border (Tailwind class: border-default)   --foreground   --muted
--accent (#3B82F6)   --accent-strong   --accent-tint
```

`--accent` is the Linestry brand blue (#3B82F6). For blue text on a light surface use `--accent-strong` (#2563EB, meets AA contrast); reserve raw #3B82F6 for fills and large display type. In dark mode `--accent-strong` lightens to #60A5FA.

Light theme: white background, near-white `--surface` (#F6F6F5). Dark theme: `.dark` class on `<html>`, warm near-black background (#161413).

**Typography:** Geologica via `next/font/google`, loaded in `src/app/layout.tsx`. `--font-display` (weight 800) drives most headings; `--font-body` (weights 300/500/600/700) covers everything else, with body copy at the light 300 weight. `--font-wordmark` (Calendula Bold, self-hosted via `next/font/local`) drives the "Linestry" wordmark and the brand/community titles (the `/[community]` name heading and the "Timeline" heading, set inline as `style={{ fontFamily: "var(--font-wordmark)" }}`). There is no serif or monospace brand font.

**Brand mark:** `src/components/ui/brand-mark.tsx` exports `<BrandMark size color dotColor knockout tilt />` (the interlocking b/l monogram: brand-blue body, a `var(--foreground)` contrast dot so it reads ink on light and near-white on dark, tilted 30 degrees left, viewBox cropped to the ink bounds so it fills its box) plus `brandMarkSvgString(color, dotColor, knockout, tilt)`, a standalone SVG string for the `next/og` image routes (`icon.tsx` renders it mono; `apple-icon.tsx` uses `knockout`; `opengraph-image.tsx`, `word/opengraph-image.tsx`, `t/[slug]/opengraph-image.tsx`) which cannot render React. The old sprouting-nodes disc is gone; there is no hexagon mark and no gold token anywhere. The "Linestry" wordmark has no trailing period.

**Postcard pattern:** Story cards, claim cards, and day cards use the `.postcard` class, which forces light-theme tokens (white surface) even in dark mode for a consistent card look across themes. Do not add dark-mode overrides to card components.

**Tier colors** (the entity type each color represents):
- Riders / people / stories: violet (`border-violet-700`, `bg-violet-500/10`)
- Places: teal (anchor #0D9488, Tailwind `teal-*`). Previously blue; moved to teal so it no longer collides with the brand accent.
- Events: amber
- Boards: emerald
- Brands / orgs: cyan

Generic UI blue (links, focus rings, primary buttons) is the brand accent now, not a tier color, so route it through `--accent` / #3B82F6. Before changing any blue value, classify it: Places-tier moves to teal, generic accent stays blue.

---

## Key Components

### `AddStoryModal` (`src/components/ui/add-story-modal.tsx`)
Two-tab modal: **Details** (date, title, body, photos, YouTube URL, visibility) + **Links** (place, event, boards, riders).

`defaults` prop pre-populates links when opened from an entity page:
```tsx
<AddStoryModal defaults={{ linkedPlaceId: place.id }} ... />
<AddStoryModal defaults={{ linkedEventId: event.id }} ... />
<AddStoryModal defaults={{ boardId: board.id }} ... />
```

In edit mode, pass `editStory={story}` — modal switches to PATCH flow.

### `StoryCard` (`src/components/feed/story-card.tsx`)
Renders: author header → title → body → YouTube embed (if `youtube_url`) → photo grid → entity chips → reactions/comments row.
Owners get a `⋯` menu (edit / delete) — appears on hover.

### `StoryInteractions` (`src/components/feed/story-interactions.tsx`)
Reaction bar (5 emoji, one per member per story) + flat comment section. Rendered by `StoryCard` only when `story.comment_count !== undefined` (i.e. the story came from `GET /api/stories`). Routes: `PUT/DELETE /api/stories/[id]/reactions`, `GET/POST /api/stories/[id]/comments`, `DELETE .../comments/[commentId]`. Comment emails batch per story (6h window) via `src/lib/emails/comment-emails.ts`; the email links to `/[community]/stories?focus=<storyId>`, the v1 story permalink.

### `FeedView` (`src/components/feed/feed-view.tsx`)
Accepts `claims`, `days`, `stories` arrays. Groups by decade. Filter chips. `order="asc"|"desc"` prop controls sort direction.

### `StoryCard` name conflict warning
`src/app/boards/[id]/page.tsx` has a local `StoryCard` function. The imported one is aliased:
```typescript
import { StoryCard as RichStoryCard } from "@/components/feed/story-card"
```

---

## Page Inventory

| Route | Key notes |
|---|---|
| `/` | Hero + feature cards, browse link to top contributor |
| `/profile` | Personal timeline — FeedView with `order` toggle, "Add Story" button |
| `/feed` | Community activity stream — stories + claims, filter chips, context lines |
| `/collective` | Community-wide FeedView |
| `/people/[id]` | Public person profile (top-level, global; was `/[community]/riders/[id]` pre-PB-008-Phase-2). The proxy redirects every legacy shape: `/[community]/riders/[id]`, `/riders/[id]`, and stale slugs from `person_slug_aliases` or `merged_from_id`. The list page at `/people` filters to the active community by default; `?community=all` shows the global directory. |
| `/events/[id]` | Event page — Stories tab added |
| `/places/[id]` | Place page — Stories tab added |
| `/boards/[id]` | Board page — Rich Stories section added |
| `/stories` | Stories index page |
| `/compare` | Side-by-side rider comparison |
| `/connections/[id]` | ConnectionSummary display |
| `/admin` | Catalog editor — gated server-side by `src/app/admin/layout.tsx` (`requireEditorPage()`); needs `is_editor: true` or founding tier |
| `/account/membership` | Stripe-powered membership management |
| `/founding` | Founding membership sale page |

---

## Data Loading Patterns

Three different patterns exist across entity pages — match the existing pattern in a file rather than introducing a new one:

1. **`useEffect` + `useRef` guard** (boards page) — ref prevents double-fetch in StrictMode
2. **`useMemo` as side-effect** (places page) — fetches inside a memoized block keyed on the entity ID
3. **`useEffect` at component top-level** (events page) — required because the page uses early returns; all hooks must be above the first `return`

---

## Utilities — `src/lib/utils.ts`

```typescript
cn(...classes)                  // Tailwind class merge (clsx + twMerge)
nameToSlug("Jay Balmer")        // → "jay_balmer"
formatSmartDate("2023-01-15")   // → "15 Jan 2023" or "2023" (year-only)
formatDateRange(start, end)     // → "2020 – present"
parseYouTubeId(url)             // → "dQw4w9WgXcQ" | null
PREDICATE_LABELS                // Human-readable predicate names
PREDICATE_ICONS                 // Emoji per predicate
CONFIDENCE_COLORS               // Tailwind classes per confidence level
```

---

## ConnectionSummary Algorithm (`src/lib/connection-summary.ts`)

Scores overlap between two people's claim sets:

| Overlap type | Score |
|---|---|
| Direct rode_with | +8 |
| Shared resort (per overlapping year, cap 8) | +2/yr |
| Shared event instance | +10 |
| Shared sponsor (per overlapping year) | +6 |
| Shared board model (per overlapping year) | +3 |
| Shared team/org (per overlapping year) | +3 |

Strength: **strong** ≥20, **medium** ≥8, **light** >0, **none** = 0

---

## Common Gotchas

1. **`youtube_url` column** — must be added to Supabase manually: `alter table stories add column youtube_url text;` (already done in production)

2. **Hook-in-conditional (events page)** — `EventPage` has early returns for instance vs. series. All `useState` and `useEffect` calls must be above the first `return`. Compute `instanceId` at the top with an IIFE if needed.

3. **Mock user IDs** — mock people use short IDs like `"u1"`, `"u2"`, `"dev-xyz"`. Auth users have full UUIDs. Use `isAuthUser(id)` to distinguish — never check ID length directly.

4. **Catalog not persisted** — `catalog` is excluded from Zustand localStorage persistence. A page refresh re-fetches it. Don't assume catalog is available before `catalogLoaded === true`.

5. **Optimistic claims** — `sessionClaims` are written immediately to state. `dbClaims` arrive async. `getAllClaims()` merges both plus overrides. Never read `dbClaims` directly.

6. **Auth in API routes** — all mutating API routes must call `requireAuth()` or `requireEditor()` from `src/lib/auth.ts` before proceeding. Use `getServiceClient()` from the same file for service-role DB operations. `createServerSupabaseClient()` from `supabase-server.ts` uses the **anon key** (not service role) and is used internally by the auth helpers for session validation.

7. **Postcard light theme** — `.postcard` class forces light background. Don't add dark-mode overrides to card components — it breaks the intentional design.

8. **Stories name conflict on boards page** — the boards page has a local `StoryCard` function component and a `stories` state variable for the legacy board_stories table. New story state uses `richStories` / `setRichStories`, and the import uses `StoryCard as RichStoryCard`.

9. **PB-009 view discipline — read through `*_public`, write to the underlying table.** Phase 1 introduced `tag_events` and the `story_riders_public` / `claims_public` views. Every public read of `story_riders` or `claims` must query the `_public` view. Write paths (POST/PATCH/INSERT/UPDATE/DELETE) keep using the underlying table. Helpers live in `src/lib/tag-events.ts`:
   - `pairStoryRiderTagEvents()` — call after a `story_riders.insert()` to create paired tag_events
   - `pairClaimTagEvents()` — call after a `claims.insert()` to create paired tag_events
   - `insertTagEvent()` — primitive for one-off tag_event creation
   Phase 1 default: every `source='member'` and `source='editor'` tag lands as `status='approved'` so behaviour is unchanged. Phase 2 flips member tags to `'pending'` and adds the `/me/tags` inbox; the single flag for that lives in `defaultStatusForSource()`.

10. **PB-009 visibility default is permissive.** Pending member tags are publicly visible by default. The `story_riders_public` and `claims_public` views show a row when:
    - `tag_event_id IS NULL` (grandfathered), OR
    - `tag_events.status = 'approved'`, OR
    - `tag_events.status = 'pending' AND profiles.require_tag_approval IS NOT TRUE`

    A user opts into consent-first gating by toggling `profiles.require_tag_approval = true` from `/me/settings/tag-privacy` (`/api/me/tag-privacy` PATCH). When on, pending tags against that subject stay hidden until approved at `/me/tags`. `declined` and `disabled` rows are hidden in both modes. Owners can decline any tag at any time regardless of the gate. The flag is read at query time, so flipping it gates existing pending tags retroactively.

11. **Entity URLs are name-based slugs — generate links through the helpers, never `/{type}/${id}` directly.** Every detail page resolves *both* slug and id, so id URLs still work; the goal is that links and the address bar show the slug.
    - **Person links:** `personHref(person, people)` / `personHrefById(id, people)` from `src/lib/entity-links.ts`, or the `usePersonHref()` hook (`src/lib/use-person-href.ts`) in components (reads `catalog.people`, precomputes a slug→count map). Person slugs derive from `display_name` via `nameToSlug()` — there is no stored slug column.
    - **Collision rule:** a name slug is emitted only when it maps to exactly one person; colliding names fall back to the stable id so two "John Smith"s never resolve onto each other. The same guard governs link generation and canonicalization.
    - **Other entities:** `entityHref(id, type, catalog)` (also in `entity-links.ts`) resolves the live catalog object and uses `placeSlug`/`boardSlug`/`orgSlug`/`eventSlug`/`seriesSlug`. It returns community-scoped paths *unprefixed* — wrap in `<CommunityLink>`. Used by `entity-chip.tsx` and `claim-card.tsx`. (The old mock-only `getEntityHref` was removed.)
    - **Address-bar canonicalization:** detail pages call `useCanonicalPath(canonical)` (`src/lib/use-canonical-path.ts`) which `history.replaceState`s a UUID/stale-slug URL to the canonical slug (no reload/refetch). The hook must sit above any `notFound()` early return. Community pages read `community` from `params` to build the prefix. There is no server-side UUID→slug 301; the proxy still only redirects merged/aliased records.
    - Admin pages intentionally keep id-based person links.

---

## Membership System

Tiers: `free | annual | lifetime | founding`

- **Founding members** get a badge, unique member number, and founder token allocation
- **Tokens:** Three types — founder_tokens, member_tokens, contribution_tokens
- Contribution tokens earned by adding entities (places, boards, etc.)
- `is_editor` flag in membership gives access to `/admin` catalog editor

---

## Bug-fix sessions

Bug tracking lives in `bugs/` (local-only, gitignored: it holds reporter emails and PostHog session ids). The daily Cowork triage maintains it.

**To start a bug-fix session, the user only needs to say "start a bug-fix session" (no file names required). On that cue:**

1. Read `bugs/NEXT-SESSION.md` first. It is the single entry point and is always current.
   - If it holds a build-ready brief (or points to a dated brief in `bugs/`), implement that brief. It is self-contained: BUG entries, suspected files, acceptance criteria, suggested order, pre-flight SQL.
   - If it says **NO BUILD-READY BRIEF YET**, do not invent scope. Read `bugs/bug-triage.md` for the queue and the latest hand-off note, then ask the user which cluster to take.
2. Read `bugs/bug-triage.md` for full context on the cluster (severity, repro, replay links, related bugs).

**Standing rules for bug-fix sessions:**
- `npx tsc --noEmit` clean before commit.
- One PR per session: push a branch, open the PR.
- **Run the full Ship sequence** (see "Session Workflow" below) before wrapping: surface every migration as copy-paste SQL, wait for Jay to apply it, prompt and wait for the merge, then log the ship. Do not treat PR-open as the end of the session.
- Do NOT edit the **Shipped** section of `bugs/bug-triage.md`. Cowork reconciles that after the PR lands so the daily dedupe stays clean.
- **Log the ship.** As the final wrap step, append one entry to `bugs/SHIP-LOG.md` using the schema at the top of that file (type, pr, branch, ids, migration, status, tsc). This applies to bug-fix AND feature sessions, and it is what lets Cowork reconcile features too (bugs reconcile off `BUG-NNN`, features have no other sweep). Because the merge now happens in-session, write `status: merged` with the real PR number once Jay confirms the merge; only fall back to `status: pending` if he defers it. Record `migration:` so the reconcile knows the gate is closed. A `SessionEnd` hook auto-appends a stub if you forget, but writing it yourself gives the richer line and the correct status. Do NOT edit earlier SHIP-LOG entries.
- No em dashes anywhere you write.

Historical one-off briefs from before this convention live at the repo root (e.g. `launch-bugfix-session-1-brief.md`); new bug-fix briefs live in `bugs/`.

---

## Session Workflow (recommended)

- **One session per task.** Keep sessions short and focused. Start a new session for each feature or fix.
- This file (`CLAUDE.md`) provides persistent context across sessions. Update it when significant new patterns or gotchas are introduced.

### Ship sequence (how a session ends)

A session is NOT done when you push. Pushing and opening the PR is the middle of the
session, not the end. The deploy steps (apply any SQL migration, merge the PR) are
part of the session and you walk Jay through them live before you wrap. This keeps
migrations from being left as silent "outstanding" gates and lets the work be
recorded as complete in the same session it shipped.

Run these steps in order and do not wrap until they are all done:

1. **Push the branch and open the PR.** As before. State the PR number.
2. **Surface every migration / manual SQL this session needs.** If the session
   created any `supabase/migrations/*.sql` file, or any one-off SQL Jay must run by
   hand (e.g. a backfill in `docs/`), print each one to chat inside a fenced
   ```sql block, in full, ready to copy-paste straight into the Supabase SQL
   editor. Do not just name the file. If there is genuinely no migration, say
   "No migration this session" explicitly so the record is unambiguous.
3. **State the apply/merge ordering.** Default is **migrate first, then merge**.
   Call out the hard pre-merge gate case (an additive column the write path sends
   unconditionally; see Group F lesson): for those the migration MUST be applied
   before the PR merges or every insert 500s in the window between. For a plain
   additive change with no write-path dependency the order is still safe as
   migrate-then-merge, so default to that.
4. **Wait for Jay to confirm the migration is applied** (or that there was none).
   Do not move on until he confirms.
5. **Prompt Jay to merge the PR, and wait for him to confirm the merge.**
6. **Only now wrap.** Write the `bugs/SHIP-LOG.md` entry with the real PR number,
   `migration:` set to what was applied, and `status: merged` (Jay just merged it
   in-session). State which BUG-IDs or feature scope shipped. If Jay explicitly
   defers the migration or merge to later, fall back to `status: pending` and
   `migration: DEFERRED <file>` and say so plainly so the daily reconcile carries it.
