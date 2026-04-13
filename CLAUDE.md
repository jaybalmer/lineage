# Lineage — CLAUDE.md

A living, community-authored snowboarding history graph. People log their timelines (where they rode, who they rode with, what boards they used, what contests they entered) and the app builds a collective graph of the sport's history.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
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
    supabase-server.ts  # Server-side client (for API routes)
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

### Adding a column
Run SQL directly in Supabase dashboard — there are no local migration files to maintain. After adding a column:
1. Add the field to the TypeScript interface in `src/types/index.ts`
2. Pass it through the relevant API route (`src/app/api/*/route.ts`)
3. Update the modal (if user-editable) and the card component (if displayed)

### API route pattern
All routes use the **service role key** (bypasses RLS). RLS is enforced on the client-side Supabase client.

```typescript
import { createServerSupabaseClient } from "@/lib/supabase-server"
const supabase = createServerSupabaseClient() // service role — use in API routes
```

Pagination uses `.range(offset, offset + limit - 1)` — not `.limit()`.

---

## Auth

- **Passwordless magic link** via Supabase Auth → `POST /api/auth/magic-link`
- Callback: `/auth/callback` → `/auth/complete` (profile creation)
- Session refresh on every request via `middleware.ts`
- **Only `/timeline/*` is protected** — all browse pages stay public

### Distinguish auth users from mock/demo users
```typescript
import { isAuthUser } from "@/store/lineage-store"
const isAuth = isAuthUser(activePersonId) // true if UUID, false if "u1"/"dev-*"
```

### Supabase verification email
The default Supabase confirmation email is generic ("Confirm your email"). To customize it for Lineage:
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

**Tailwind v4** — theme tokens defined in `src/app/globals.css`:

```css
--background   --surface   --surface-hover   --surface-active
--border-default            --foreground      --muted
```

Light theme: white/light-blue. Dark theme: `.dark` class on `<html>`.

**Postcard pattern:** Story cards, claim cards, day cards use `.postcard` class which forces light theme even in dark mode — consistent card appearance across themes.

**Color conventions:**
- Stories/narrative → violet (`border-violet-700`, `bg-violet-500/10`)
- Places → blue
- Events → amber
- Boards → emerald
- Riders/people → violet

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
Renders: author header → title → body → YouTube embed (if `youtube_url`) → photo grid → entity chips.
Owners get a `⋯` menu (edit / delete) — appears on hover.

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
| `/riders/[id]` | Public profile page |
| `/events/[id]` | Event page — Stories tab added |
| `/places/[id]` | Place page — Stories tab added |
| `/boards/[id]` | Board page — Rich Stories section added |
| `/stories` | Stories index page |
| `/compare` | Side-by-side rider comparison |
| `/connections/[id]` | ConnectionSummary display |
| `/admin` | Catalog editor — requires `is_editor: true` in membership |
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

6. **Service role in API routes** — use `createServerSupabaseClient()` from `supabase-server.ts`. This uses the service role key and bypasses RLS. Don't import the browser `supabase` client in API routes.

7. **Postcard light theme** — `.postcard` class forces light background. Don't add dark-mode overrides to card components — it breaks the intentional design.

8. **Stories name conflict on boards page** — the boards page has a local `StoryCard` function component and a `stories` state variable for the legacy board_stories table. New story state uses `richStories` / `setRichStories`, and the import uses `StoryCard as RichStoryCard`.

---

## Membership System

Tiers: `free | annual | lifetime | founding`

- **Founding members** get a badge, unique member number, and founder token allocation
- **Tokens:** Three types — founder_tokens, member_tokens, contribution_tokens
- Contribution tokens earned by adding entities (places, boards, etc.)
- `is_editor` flag in membership gives access to `/admin` catalog editor

---

## Session Workflow (recommended)

- **One session per task** — keep sessions short and focused
- Start a new session for each feature or fix
- End the session when you push
- This file (`CLAUDE.md`) provides persistent context across sessions — update it when significant new patterns or gotchas are introduced
