# Bug-fix brief: undated connections sort to the TOP of a timeline, and event connections lose the event's date

**Drafted:** September 6, 2026 (daily triage, auto-drafted)
**BUG ids in scope:** BUG-181 (P2), BUG-182 (P2)
**Verified against:** `main` at `6b9b5ca`
**Migration:** none. No schema change, no `_public` view change.
**Risk:** one client component plus one popover write path. Pipeline-safe.

---

## 0. Goal

Two reports, one surface, one session. An "Unknown" decade group is rendering at the **top** of a person's timeline instead of the bottom, and the popover that creates those connections never writes a date at all, even when the linked event has one.

BUG-182 is the cause of most of the rows BUG-181 is mis-sorting. Fix both and the surface is right.

---

## 1. DECISIONS (review before building)

**D1. Where undated items go.**
- **Recommended default: keep them on the timeline, in an "Unknown" group pinned LAST, regardless of sort direction.** The reporter offered this themselves ("if it needs to be on the timeline then unknown should be at the end of the list"), and the codebase already has this exact pattern to copy at `src/app/people/page.tsx:316`.
- Alternative: drop undated items from the timeline entirely (the reporter's first preference: "it is a place on their list, but undated"). Rejected as the default because there is currently no other surface on the person page that lists them, so dropping them makes real data invisible. Revisit if a separate "places list" surface ships.

**D2. Whether to backfill dates onto existing undated event claims.**
- **Recommended default: no backfill. Fix the write path, and add a render-time fallback so existing rows are fixed on sight** (see D3).
- Alternative: a one-time UPDATE setting `start_date` from the linked event. That is a GATED data change and it is not needed if D3 lands.

**D3. Render-time event-date fallback.**
- **Recommended default: yes, add it.** When a claim has no `start_date` and its `object_type` is `event`, resolve the event from `catalog.events` and use its date for timeline placement. This fixes every existing bad row without touching data, and it makes the timeline correct even if some other write path forgets a date later.
- Alternative: write path only. Cheaper, but every claim already created through the popover stays in the Unknown bucket forever.

**D4. Should the write path also stamp a date for non-event connections (place, brand, rider)?**
- **Recommended default: no.** There is no date to infer for those. They legitimately have no date and belong in the D1 Unknown group. Only the event case has a real answer.
- Alternative: default them to the current year, which is what `QuickClaimPopover` does (`quick-claim-popover.tsx:100-109`). Rejected: inventing a date is worse than admitting there is none.

---

## 2. The two bugs

### BUG-181 (P2): the "Unknown" group renders first, not last

Reported September 6, 2026 by OWNER (signed in, desktop Chrome, 948x952), on `https://linestry.com/people/jeff_patterson`, replay `S-55`:

> When a place is added without a date, then it should not show up in their timeline. It is a place on their list, but undated. If it needs to be on the timeline then unknown should be at the end of the list

### BUG-182 (P2): event connections are written with no date at all

Reported September 6, 2026 by OWNER (signed in, desktop Chrome, 948x952), on `https://linestry.com/people/ingemar_backman`, replay `S-54`:

> Added some connections to Ingemar Backman's timeline and they are showing up as unknown date. The 2 events should use the date of event on the timeline

---

## 3. Verified facts (checked against `6b9b5ca`, do not re-derive)

### The renderer

`src/app/people/[id]/page.tsx` merges claims from three sources at `:257-261` (Supabase `claims_public` fetched at `:139-144`, `sessionClaims` from the store, and mock `CLAIMS`), then renders **`FeedView`** at `:747-756`, passing no `days` and no `order` prop, so `order` defaults to `"desc"` (`feed-view.tsx:135`).

An owner viewing their own profile short-circuits at `:241-243` to `OwnerTimelinePanel`, which renders the **same** `FeedView` at `src/components/profile/owner-timeline-panel.tsx:932-948`. **Both reports therefore hit one code path**, and a fix in `FeedView` covers owner and visitor views at once.

### BUG-181 root cause, exactly two lines

`src/lib/timeline-grouping.ts` is 43 lines total:

```ts
14  export function dateToSortNum(dateStr?: string): number {
15    if (!dateStr) return 0
...
22  export function itemDecade(sortDate: number): string {
23    if (!sortDate) return "Unknown"
```

So an undated item gets `sortDate = 0` and lands in a real decade group keyed `"Unknown"`. **The group already exists.** The bug is purely how the group keys are ordered, `src/components/feed/feed-view.tsx:245-248`:

```ts
245  const grouped = useMemo(() => groupByDecade(items), [items])
246  const decades = Object.keys(grouped).sort((a, b) =>
247    order === "asc" ? a.localeCompare(b) : b.localeCompare(a)
248  )
```

Decade keys are sorted as **strings**. `"Unknown"` starts with `U` (U+0055), which sorts above every digit. With the person page's default `order="desc"` (`b.localeCompare(a)`), `"Unknown"` sorts **first, at the very top of the timeline**, above `"2020s"`. With `order="asc"` it would land last. This was read from the comparator, not executed.

**There is no filter anywhere that drops undated items.** The only filters in `items` (`feed-view.tsx:188-243`) are the category/predicate filter and the `owned_board` exclusion at `:192`. Nothing tests `sortDate`.

The `"Unknown"` header renders with the same styling as `"1990s"`, including the `{grouped[decade].length} entries` count at `feed-view.tsx:384`. Rendering is generic over `decades` (`:378-433`), so pinning the group is a comparator change, not a render change.

**Copy the existing precedent**, `src/app/people/page.tsx:316`:

```ts
if (noYear.length) groups.push({ label: "Unknown", items: noYear })
```

pushed **last**, after the decade groups. That is the behaviour D1 asks for, already shipped on a sibling surface.

### BUG-182 root cause, one component

`src/components/feed/add-person-connections-popover.tsx:92-104`, the "+ Add connection" button on someone else's profile (mounted at `people/[id]/page.tsx:439-444`), builds the claim with **no `start_date` and no `end_date` field at all**:

```ts
92     const { predicate, objectType } = SECTION_MAP[kind]
93     const claim: Claim = {
94       id: crypto.randomUUID(),
95       subject_id: person.id,
...
97       predicate,
98       object_id: objectId,
99       object_type: objectType,
100      confidence: "self-reported",
...
104    }
```

`SECTION_MAP` (`:32-36`) maps `place -> rode_at`, `org -> sponsored_by`, `event -> competed_at`, `rider -> rode_with`. `rodeWithThem()` at `:113-126` has the same omission.

**This single surface explains both reports**: the undated place in BUG-181 and the undated event claims in BUG-182.

**The fallback pattern to copy already exists**, `src/components/ui/add-claim-modal.tsx:583-590`:

```ts
583    // For event claims, pull date directly from the selected event record
584    const resolvedStartDate = isEventClaim && selectedEntity
585      ? ((selectedEntity as unknown as Record<string, unknown>).start_date as string | undefined) ?? effectiveStartDate
586      : effectiveStartDate
```

`add-claim-modal.tsx:512` comments "For event claims the date comes from the event itself, no year entry needed", and `:943` skips the date section for event claims entirely.

By contrast `QuickClaimPopover` always writes a date, falling back to the current year (`quick-claim-popover.tsx:100-109`). The connections popover is the outlier.

### Supporting facts

- `Claim.start_date?: string` and `end_date?: string` are optional (`src/types/index.ts:506-507`); `approximate?: boolean` at `:514` exists but is read nowhere in the timeline path.
- `start_date NOT NULL` was dropped in `migration-012-board-relationship.sql:14-18`. Its comment claims "Non-band predicates still require a date in the UI", which is **no longer true**, as this bug proves. Worth correcting the comment if convenient.
- `Event` carries dates: `start_date: string` (**required, non-optional**), `end_date?: string`, `year?: number` (`src/types/index.ts:403-411`). So the D3 fallback always has something to read.
- The claim-to-event link is only `object_id` plus `object_type`; there is **no dedicated `event_id` column** on Claim.
- **No render-time date fallback exists anywhere today.** `feed-view.tsx:201` reads `claim.start_date` only and never looks up `catalog.events`. Same in `src/components/public-timeline/public-timeline.tsx:378`. The related `event.year ?? yearOf(event.start_date)` pattern at `src/lib/public-timeline-read.ts:960` and `:1257` is for event stack entries, not for claims inheriting a date.

### One correction to the report's wording

There is **no "unknown date" copy on the card**. The card renders no date at all: `post-card.tsx:619` calls `formatDateRange`, which returns `""` for a missing start (`src/lib/utils.ts:36-37`), and `:683-685` renders nothing when the range is empty. What the reporter saw as "unknown date" is the **`Unknown` decade header sitting at the top of the timeline**. Same underlying problem, so this does not change the fix, but do not go hunting for a string that is not there.

---

## 4. Files to touch

| File | Why |
|---|---|
| `src/components/feed/feed-view.tsx` | BUG-181: the decade comparator at `:245-248`. BUG-182 D3: the claim `sortDate` at `:198-202` |
| `src/components/feed/add-person-connections-popover.tsx` | BUG-182 write path: `:92-104` and `:113-126` |

Do **not** touch `timeline-grouping.ts`; `"Unknown"` as a key is correct and is shared with other callers. Pin it in the comparator instead.

---

## 5. Suggested order

1. BUG-181 first, it is self-contained: make the comparator sort `"Unknown"` last in both directions. Two lines.
2. BUG-182 write path: resolve the event's `start_date` in the popover when `objectType === 'event'`, mirroring `add-claim-modal.tsx:583-590`. Leave non-event kinds dateless per D4.
3. BUG-182 D3 render fallback in `feed-view.tsx`: when a claim has no `start_date` and `object_type === 'event'`, look the event up in `catalog.events` and use its date for `sortDate`. `catalog` is already in scope in that component.
4. `npx tsc --noEmit`.

---

## 6. Acceptance criteria

**BUG-181**
- On a person's timeline in the default descending order, the "Unknown" group renders **after** every decade group, at the bottom.
- In ascending order it is also last.
- Dated items are unaffected: decade ordering and within-decade ordering are unchanged.
- Behaviour is identical on the owner's own timeline (`OwnerTimelinePanel`) and on a visitor's view of `/people/[id]`, since both use `FeedView`.
- Any other surface using `FeedView` still renders sensibly. Check `/snowboarding/feed` and the community timeline for regressions.

**BUG-182**
- Adding an **event** connection through the "+ Add connection" popover writes a claim carrying the event's `start_date`, and the claim lands in the event's decade, not in Unknown.
- Adding a **place**, brand or rider connection through the same popover still writes no date and still lands in the Unknown group (D4).
- With D3 in place, an event claim **already** in the database with no `start_date` renders in the event's decade on next load, with no data change.
- No claim gets an invented date.

**Both**
- `npx tsc --noEmit` clean.
- No migration, no view change, no `_public` rebuild.

---

## 7. Pipeline note

Two client files, no migration, no auth, no payments, no membership, no `_public` view. **Legal for the unattended slot.**

---

## 8. Wrap

- Name **BUG-181** and **BUG-182** in the PR title or commit message.
- `bugs/SHIP-LOG.md` entry with `migration: none`.
- Do not edit the Shipped section of `bugs/bug-triage.md`.
- No em dashes anywhere you write.
