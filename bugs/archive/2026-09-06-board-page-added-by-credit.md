# Bug-fix brief: the board detail page gives no credit to the member who added the board

**Drafted:** September 6, 2026 (daily triage, auto-drafted)
**BUG id in scope:** BUG-185 (P2)
**Verified against:** `main` at `6b9b5ca`
**Migration:** none. The data is already loaded and already rendered on two other surfaces.
**Risk:** one client file, display only. **This is the pipeline-safe pick this run.**

---

## 0. Goal

`boards.added_by` is already on the board object the detail page holds in memory. Render it, matching the credit line the boards list page already shows.

---

## 1. DECISIONS (review before building)

**D1. Should credit show on every board, or only unverified ones?**
- **Recommended default: every board that has an `added_by`.** The reporter's point is that contributors need credit ("People need to get credit for adding boards, pictures, etc"), and a board becoming verified does not un-contribute it. The detail page is also the place a visitor lands from a share, so it is the highest-value surface for credit.
- Alternative: mirror the list page exactly, which gates credit on `community_status === "unverified"` (`board-parts.tsx:357`, `:410`). Consistent with places and events, which use the same gate. Take this if you want strict parity now and a deliberate decision about the gate later. **Note that whichever way this goes, the list page and the detail page will then disagree unless you also change the list page, so flag it rather than silently diverging.**

**D2. Copy.**
- **Recommended default: "Added by {name}"**, matching `board-parts.tsx:386` verbatim so the two surfaces read identically.
- Alternative: "Contributed by {name}". Warmer, but introduces a second word for one concept.

**D3. Placement.**
- **Recommended default: in the board's meta area near the other secondary facts** (year, shape, provenance), as small muted text, matching the list-page treatment (`text-[10px] text-muted` on the tile, inline with a middot on the list row).
- Alternative: near the image, next to the "Documented in" provenance citations that shipped in PR #223. Reasonable, since both are provenance. Pick whichever reads better on mobile at 402px wide, which is where the report came from.

**D4. Should the name link to the contributor's profile?**
- **Recommended default: yes**, using `personHref` / the `usePersonHref()` hook per the repo's entity-URL rule (CLAUDE.md gotcha 11). Credit that is not clickable is weak credit.
- Alternative: plain text, matching the list page, which does not link it today.

---

## 2. The bug

Reported September 6, 2026 by Anonymous (logged out, iPhone Safari, 402x488), on `https://linestry.com/snowboarding/boards/Sims_Switchblade_1988`, replay `S-53`:

> When people add a board they have clear credit on the list page and feed, but it is not shown on the board page. People need to get credit for adding boards, pictures, etc

The report is accurate. Verified below.

---

## 3. Verified facts (checked against `6b9b5ca`, do not re-derive)

**The detail page renders no credit.** `src/app/(community)/[community]/boards/[id]/page.tsx` is 963 lines. `grep -n "added_by\|Added by\|addedBy\|contributor"` on that file returns **nothing** (the only `added` hit is a code comment at `:217`).

**No fetch change is needed.** The detail page does not query Supabase for the board at all. It reads it out of the client catalog, `boards/[id]/page.tsx:179-180`:

```ts
179  const allBoards = catalog.boards
180  const board = allBoards.find((b) => b.id === id) ?? allBoards.find((b) => boardSlug(b) === id)
```

and the store fetches boards with `select("*")` (`src/store/lineage-store.ts:18`, called at `:260`), paging 1000 rows at a time. **So `board.added_by` is already present on the object this page is holding.** It is simply never rendered. This is the whole reason the fix is small.

**The list page's credit, to copy from.** `src/app/(community)/[community]/boards/page.tsx:163-168` builds the id-to-name map:

```ts
164  const nameById = useMemo(() => {
165    const m = new Map<string, string>()
166    catalog.people.forEach((p) => m.set(p.id, p.display_name))
167    return m
168  }, [catalog.people])
```

and `:273` maps it onto the tile props:

```ts
273    addedByName: board.added_by ? nameById.get(board.added_by) : undefined,
```

Rendered in `src/app/(community)/[community]/boards/board-parts.tsx`:

```tsx
385        {isUnverified && addedByName && (
386          <div className="text-[10px] text-muted mt-1 truncate">Added by {addedByName}</div>
387        )}
```
(card view, `BoardTile`) and

```tsx
432            {isUnverified && addedByName && <span className="truncate">· Added by {addedByName}</span>}
```
(list view, `BoardListRow`).

**Note the `isUnverified` gate** at `board-parts.tsx:357` and `:410`. That is what D1 is about. The same gate is used for places (`places/page.tsx:45`) and events (`events/page.tsx:95`).

**`boards.added_by` exists.** Verified three ways, since there is no `CREATE TABLE public.boards` in `supabase/migrations/` (the base schema lives outside this repo):
1. Type: `Board.added_by?: string` at `src/types/index.ts:383` (interface starts `:374`).
2. Write path stamps it: `src/app/api/catalog/entity/route.ts:122`, `added_by: user.id` in the `type === "board"` branch (`:101-123`).
3. Migrations mutate it: `supabase/migrations/20260511000001_merge_person_rpc.sql:439-440` and `20260512000002_...:284-285`, `UPDATE boards SET added_by = v_canonical_id WHERE added_by = v_ghost_id`.

The declared column type is not verifiable from this repo. It holds a person id, and the list page string-compares it against `catalog.people` ids, so do the same.

**One thing to handle:** `nameById.get(board.added_by)` returns `undefined` when the contributor is not in `catalog.people` (an archived member, or an orphan id from the historical merge work). The list page already handles that by rendering nothing. Do the same: no credit line rather than "Added by undefined".

---

## 4. Files to touch

| File | Why |
|---|---|
| `src/app/(community)/[community]/boards/[id]/page.tsx` | add the credit line |

Possibly `board-parts.tsx` if you extract the credit into a shared component rather than duplicating six lines. Extraction is nice but not required; do not turn this into a refactor.

If D1's default is taken, also decide whether to drop the `isUnverified` gate on the list page for consistency. **Say which way you went in the PR description either way.**

---

## 5. Suggested order

1. Read `boards/[id]/page.tsx` around the board meta rendering to pick the placement per D3.
2. Build the same `nameById` lookup the list page uses, or reuse `usePersonHref()` if you take D4.
3. Render the credit line with the D1 gate and D2 copy.
4. Check it at 402px wide, since the report came from an iPhone.
5. `npx tsc --noEmit`.

---

## 6. Acceptance criteria

- A board whose `added_by` resolves to a member in the catalog shows "Added by {name}" on `/snowboarding/boards/<slug>`.
- The copy and visual treatment match the list page (D2, D3).
- A board with no `added_by`, or whose `added_by` does not resolve, shows **no** credit line and no placeholder text.
- With D1's default: credit shows on verified boards too, and the PR says whether the list page was brought into line.
- With D4's default: the name links to the contributor's profile via `personHref`, and the link resolves.
- Readable at 402px wide with no overflow.
- The boards list page is unchanged unless D1 was deliberately extended to it.
- `npx tsc --noEmit` clean.

---

## 7. Pipeline note

One client file, display only, no migration, no `_public` view, no write path, no auth, no payments, no membership. **This is the pipeline-safe target for the unattended slot this run.**

---

## 8. Wrap

- Name **BUG-185** in the PR title or commit message.
- `bugs/SHIP-LOG.md` entry with `migration: none`.
- Do not edit the Shipped section of `bugs/bug-triage.md`.
- No em dashes anywhere you write.
