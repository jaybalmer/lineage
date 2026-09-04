# Bug-fix brief: view-ordering polish (BUG-078 + BUG-079)

> Self-contained, build-ready. Drafted June 18, 2026 by the daily triage with the live repo grepped. Two small, unrelated client-only view-ordering fixes bundled into one PR. Auto-merge eligible (no migration, no auth/payments, read/state only).

## Goal

Two member-facing view-ordering papercuts: place pages should open on Stories, and the stack-view curate "Sort by year" should be reversible.

## Scope

- **BUG-078** (P2): entity pages like Places should default to the Stories view.
- **BUG-079** (P2): stack-view curate "Sort by year" cannot be reversed.

## DECISIONS (review before building)

1. **Place page default tab (BUG-078).** Recommended default: open on the Stories tab when the place has at least one story (`placeStories.length > 0`), else fall back to the current "All" tab so an empty-stories place does not land on an empty view. Alternative A: always default to Stories. Alternative B: leave All as default (close as wontfix). Default = conditional Stories.
2. **Scope of the default-Stories change (BUG-078).** Recommended default: place page only (the report names Places). Alternative: also apply to event and board detail pages. Default = places only; note the others as an easy follow if Jay wants parity.
3. **Sort-by-year direction control (BUG-079).** Recommended default: make the existing "Sort by year" button toggle ascending/descending on each click (track a `sortDir` state, flip on click), updating the label to make the direction explicit (e.g. "Year, oldest first" / "Year, newest first"). Alternative: add a separate "Reverse" button next to it. Default = toggle the existing button (less UI).

## Verified suspected files / symbols (grepped on live main)

### BUG-078 (place default tab)
- `src/app/(community)/[community]/places/[id]/page.tsx`
  - `type PlaceTab = "all" | "riders" | "events" | "stories"` (line 22).
  - `const [tab, setTab] = useState<PlaceTab>("all")` (line 66) is the default to change.
  - `placeStories` state is set from a fetch (line 79; populated ~line 168). The Stories tab is defined at line 142 (`{ key: "stories", label: "Stories", count: placeStories.length }`) and rendered at line 647.
  - Because `placeStories` arrives async, the conditional default needs to apply once after the stories fetch resolves (e.g. only auto-switch if the user has not already changed tabs). Simplest safe approach: initialise to `"all"`, and in the stories-fetch `.then(...)` set the tab to `"stories"` if `placeStories.length > 0` AND the user has not manually changed tabs yet (guard with a ref/flag). Do not override a tab the user explicitly clicked.

### BUG-079 (stack sort direction)
- `src/app/me/public-view/page.tsx`
  - `sortByYear` (line 289): currently `setSelection((prev) => [...prev].sort((a, b) => { /* null years sink */ return a.year - b.year }))`, always ascending.
  - Button: line 387, `<button onClick={sortByYear} ...>Sort by year</button>`, rendered when `count > 1`.
  - Add a `sortDir` state (`"asc" | "desc"`, default `"asc"`), flip it inside the handler, and apply `dir === "asc" ? a.year - b.year : b.year - a.year`. Keep the null-year summary rows pinned at the end in BOTH directions (do not let `desc` float them to the top). Update the button label to reflect the next or current direction. The page rebuilds the whole set via PUT on Save (the "rebuilt on each edit" model per the file header comment, lines 9 to 11), so the reordered `selection` persists through the existing Save with no API change.

## Implementation order (suggested)

1. BUG-079 first (single file, fully local state): add `sortDir`, flip on click, direction-aware comparator with null-year rows pinned to the end, label update.
2. BUG-078: add the post-fetch conditional default with a "user has not manually switched" guard so it does not fight an explicit tab click.
3. `npx tsc --noEmit` clean. Smoke: a place with stories opens on Stories; an empty-stories place opens on All; the place tabs still switch on click; the stack curate "Sort by year" flips oldest/newest on repeated clicks with summaries staying at the end, and Save persists the order.

## Acceptance criteria

- BUG-078: a place page with stories defaults to the Stories tab; an empty-stories place defaults to a sensible non-empty tab; clicking other tabs still works and is not overridden by the auto-default.
- BUG-079: the stack curate page sorts by year in both directions; null-year summaries stay grouped at the end in both; Save persists the chosen order.
- `npx tsc --noEmit` clean.

## Notes / guardrails

- Auto-merge eligible: client-only, no migration, no `_public` view, no auth/payments. Pure view state.
- Name **BUG-078** and **BUG-079** in the PR title or commit message (the daily reconcile greps for the ids).
- Append a `status: pending` entry to `bugs/SHIP-LOG.md` at session end. Do not edit earlier entries.
- No em dashes anywhere (code, comments, copy). Use periods, commas, parentheses, colons, or semicolons.
