# Next bug-fix session

> This file is the single entry point for a Claude Code bug-fix session.
> The daily Cowork triage keeps it current. When a session ships, this brief is
> archived to `bugs/archive/` and this file resets to "no session queued".
>
> Kick off in Claude Code with nothing more than: **"start a bug-fix session"**.
> The repo `CLAUDE.md` auto-loads and points here.

---

## Status: BUILD-READY

**Session 3: catalog-create + event-date cluster.** Three bugs: BUG-027, BUG-028, BUG-031. All root causes were verified against the current code during the June 11 triage; file and line references below are from that read. Full reporter context, repro steps, and screenshots are in `bugs/bug-triage.md` under each BUG id.

Suggested branch: `bugfix-session3-catalog-create`.

Estimated: 2 to 3 hr. Two are small and surgical (BUG-028, BUG-031); BUG-027 needs one product call (where shops belong) before coding, flagged in its section.

---

## Standing rules (every bug-fix session)

- `npx tsc --noEmit` must be clean before commit.
- One PR for the session. Push the branch, open the PR, let Jay merge.
- Do NOT edit the **Shipped** section of `bugs/bug-triage.md`. Cowork reconciles that after the PR lands.
- No em dashes anywhere you write (code, comments, UI copy). Use periods, commas, parentheses, colons, or semicolons.
- The `bugs/` folder is gitignored; do not add it to a commit.

## Pre-flight (read before coding)

- The catalog is fetched once at app boot and is not persisted (`catalog` is excluded from the Zustand persist). Pages re-fetch via `loadCatalog()`. The user-add store helpers already do optimistic insert into `catalog` plus a `/api/admin` write, so a created entity IS in the store immediately. If something "does not surface," suspect a render-time filter, not a missing write. (Confirmed for orgs below.)
- `OrgType` values are `brand | shop | team | magazine | event-series` (`add-entity-modal.tsx:25`). The add-entity modal defaults `orgType` to `"shop"` (`add-entity-modal.tsx:67`), so "shop" is the common case, not an edge one.
- `/api/admin` POST is gated by `requireEditor()` (`app/api/admin/route.ts`). Non-editor members cannot create catalog entities through it; the optimistic add then rolls back with a "Failed to save" toast. Keep this in mind for BUG-028's "not added" symptom (see its note).

---

## BUG-027: a new shop added on the brands page never surfaces in the list  [P1]

**Root cause (verified).** The shop persists fine; the brands list simply has no bucket for it. In `app/(community)/[community]/brands/page.tsx`:

- `const brandOrgs = allOrgs.filter((o) => o.org_type === "brand" || o.org_type === "magazine")` (around line 178)
- `const teams = allOrgs.filter((o) => o.org_type === "team")` (around line 179)
- The render only ever maps `sortedBrands` / `grouped` (from `brandOrgs`) and `sortedTeams`. An org with `org_type === "shop"` (or `"event-series"`) is in neither bucket, so it never renders.
- `addUserOrg` (`store/lineage-store.ts:583`) optimistically pushes the org into `catalog.orgs` and POSTs `insert orgs` to `/api/admin` with `org_type` intact, rolling back on failure. So the row is present in the store and (for an editor like Jay) in the DB. The add-entity modal defaults the type to `"shop"` (`add-entity-modal.tsx:67`), which is exactly what Jay used ("The Snoboard Shop").
- Secondary: the header count `totalBrands = allOrgs.length` (around line 200) counts ALL orgs including shops, so the count can exceed the number of cards rendered. Same class as BUG-019.

**Product call needed before coding (one line for Jay).** Do shops belong on the Brands page or the Places page? They are created as orgs from the Brands page "+ Add brand" flow, so the low-friction fix is to surface them there. If shops should instead live under Places, that is a larger move (different entity model) and should be its own ticket. Default recommendation: surface shops on the Brands page.

**Fix (default path).**
- Add a Shops bucket to the brands list so `org_type === "shop"` renders (a "Shops & Retailers" section, mirroring the Teams section, or fold shops into the flat list with a category). Do not silently drop `event-series` either; decide whether it surfaces or is intentionally excluded, and comment the choice.
- Reconcile the header count with what actually renders (count the displayed set, or reword the label), so it does not repeat the BUG-019 count/visible mismatch.

**Acceptance.** A shop added via "+ Add brand" appears in the brands list immediately after save (no reload), and the header count matches the number of cards shown.

---

## BUG-028: story-connections "add new" create modal opens behind the parent modal  [P1]

**Corroborating report (June 11 triage update).** A second report landed June 11 14:39 UTC (replay `S-02`, offset 89s, no screenshot): "Edit story, Add event, Event was not in the event list, click add Event, background greyed out, and event NOT added" on `/snowboarding/stories`. This is the exact AddStoryModal Links tab "+ Add new" event path described below, so the confirmed reproducer is now reported twice. It also narrows secondary finding #1: the live symptom is the Edit Story panel, not the connections popover.

**Root cause (verified).** Two modals share `z-50`, and the nested one is earlier in the DOM, so the parent's backdrop paints over it. In `components/ui/add-story-modal.tsx` (Links tab):

- When a SearchPicker "+ Add new" is clicked, `setAddingEntity(type)` fires (`onAddNew` props at lines 456 to 518).
- The render is a fragment where `<AddEntityModal>` (lines 239 to 244, `fixed inset-0 z-50`) is rendered BEFORE the main story panel (`<div className="fixed inset-0 z-50 ... bg-black/60 backdrop-blur-sm">`, line 247).
- `AddEntityModal`'s own overlay is also `fixed inset-0 z-50` (`add-entity-modal.tsx:208`). With equal z-index, paint order follows DOM order, so the later element (the story panel, with its `bg-black/60 backdrop-blur-sm`) covers the create modal. Result: the screen "goes black" behind the story modal and the create UI is unreachable, so nothing gets added. This matches the report exactly.

**Fix.** Make a nested create modal always stack above its parent. Simplest: raise `AddEntityModal`'s overlay above any `z-50` parent (for example `z-[60]`), or render it after the parent panel, or portal it to `document.body` with a higher stacking context. Once it is reachable, the existing `onAdded` auto-select should complete the flow; verify the entity persists and is selected.

**Secondary findings to reconcile with Jay (do not silently expand scope).**
1. `components/feed/add-connections-popover.tsx` (the story-connections popover) passes NO `onAddNew` to its three SearchPickers, so that surface has no add-new affordance at all. The reporter mentioned "story connections" and was on `/snowboarding/brands`; the confirmed reproducer is the AddStoryModal Links tab. Confirm whether the connections popover is also meant to offer add-new (a small feature add) or whether the report was purely the story-modal path. If it should offer add-new, wiring it will hit the same z-index rule, so fix the stacking first.
2. `/api/admin` create is `requireEditor`-gated. For a non-editor, "add new" would also fail with a rolled-back optimistic insert and a "Failed to save" toast, a different "not added" cause. Jay is an editor, so his symptom is the z-index one, but if user-contributed catalog adds are expected for non-editors (PB-008 framing), the editor gate is a separate question worth raising. Out of scope for this session unless Jay says otherwise.

**Acceptance.** From the AddStoryModal Links tab, "+ Add new" opens the create modal ABOVE the story modal, the new entity writes, and it is auto-selected back in the Links tab. No black-screen-behind state.

---

## BUG-031: event dates render "NaN" and "undefined"  [P1]

**Root cause (verified).** Two local date formatters assume a full `YYYY-MM-DD` and break on partial dates. `formatSmartDate` in `lib/utils.ts` is safe but it collapses partial dates to year-only (it drops the month), so it is not a drop-in for the event surfaces, which want "Mon YYYY".

Instance 1, the profile event picker ("NaN undefined 1986", "NaN Mar 1992"): `components/ui/add-claim-modal.tsx:410-413`, the local `fmt` inside `getEventDateRange`:
```
const [y, m, day] = d.split("-")
return `${parseInt(day)} ${MONTHS[parseInt(m)-1]} ${y}`
```
For "1986" (year only): `m` and `day` are undefined, so `parseInt(day)` is `NaN` and `MONTHS[NaN-1]` is `undefined`, giving "NaN undefined 1986". For "1992-03" (year-month): `day` is undefined, giving "NaN Mar 1992".

Instance 2, the event detail header ("undefined May 2026"): `app/(community)/[community]/events/[id]/page.tsx:22-30`, `formatEventDate`:
```
const [sy, sm, sd] = start.split("-").map(Number)
const startStr = `${sd} ${months[sm - 1]} ${sy}`
```
For "2026-05": `sd` is undefined, giving "undefined May 2026". This helper also handles ranges (same-month compression like "3-5 Mar 1992", and cross-month), so any shared replacement must preserve range behavior.

**Fix.** Add one precision-aware formatter to `lib/utils.ts` and route both call sites through it:
- year only ("1986") to "1986"
- year-month ("1992-03") to "Mar 1992"
- full ("1992-03-15") to "15 Mar 1992"
- keep the range logic from the event page (same-month and cross-month) for start-plus-end.

Replace the local `fmt` in `add-claim-modal.tsx` and the local `formatEventDate` in `events/[id]/page.tsx` with the shared helper. Grep for any other `months[` or `${parseInt(day)}` style date compose and route those too.

**Acceptance.** The profile event picker and the event detail header render clean dates for year-only, year-month, and full dates, with no "NaN" or "undefined" tokens. Event date ranges still compress correctly.

---

## Suggested order

1. BUG-031 first (smallest, self-contained, high visibility): add the shared formatter, swap both call sites, grep for other instances.
2. BUG-028 next (one-line z-index fix plus a verify): raise the nested create modal above `z-50` parents, confirm persist and auto-select. Park the two secondary findings as notes in the PR unless Jay green-lights them.
3. BUG-027 last (needs the shops-on-brands product confirmation): add the shops bucket and reconcile the count.

## Out of scope for this session

- BUG-032 (board model years doubled in the picker, `add-claim-modal.tsx:168` maps without dedup): related P2, separate ticket.
- The `/api/admin` editor-gate question for non-editor catalog adds: separate product call.
- Moving shops to Places (if Jay chooses that over surfacing on Brands): larger, separate ticket.
