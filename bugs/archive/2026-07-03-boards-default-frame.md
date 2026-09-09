# Bug-fix session brief: Boards page default frame (BUG-127)

> Drafted by the July 3, 2026 daily triage. Self-contained.
> **P2, client-only, HUMAN-RUN: the DECISIONS block reverses a deliberate design call
> from the June boards catalog redesign (PR #99), so Jay should confirm the decision
> line before the session runs.** Not for the unattended auto-merge pipeline.
> Name the BUG id (BUG-127) in the PR title or commit message. Append a
> `status: pending` SHIP-LOG entry before wrapping.

## Scope

- **BUG-127: The Boards main page defaults to the Brands frame and lists Brands as the first filter; the reporter expected the Boards page to default to boards.** [P2] [reproducible]

One-line goal: decide and apply the default level for `/snowboarding/boards` so the page name and the default frame agree.

## DECISIONS (review before building)

1. Default level. **Recommended: default `/[community]/boards` to the all-boards level** (Boards StatButton active, board grid visible) and move "All boards" to the first position in the filter row, keeping Brands one tap away. Rationale: the page is named Boards, the nav category chip says Boards, and a tester read brands-first as backwards. **Alternative: keep brand-first and close as wont-fix**, because brand-first was the deliberate PR #99 "brands are the front door to the catalog" redesign (June 19). This is the line Jay should confirm.
2. If the default flips: keep the URL param behavior stable (recommended: no-param URL = all boards; `?view=brands` = brands level) so shared links keep working. Alternative: keep no-param = brands and send the nav chip to `?view=all`; messier.

## The report

- July 3, 2026 04:00 UTC, Cory (R1), iPhone Safari 414x750, `https://linestry.com/snowboarding/boards`.
- "On the Boards main page the default right frame highlight is set to Brands and the first filter is Brands. This feels backwards. This is the Boards page and the default frame highlight should be on boards and the filter should move to the 1st position All Boards to match."
- Screenshot `19f2622df6587f2c__0__bug-screenshot.jpg` (reviewed): The Snowboard Catalog header (161 boards across 25 brands), filter row reading "Brands | All boards | Featured | My Boards", and a RECENTLY ADDED section of brand tiles; the default highlight is on Brands.
- Session replay: PostHog session `S-25`, offset 8308 seconds.

## Verified facts (checked against the live repo July 3)

1. `src/app/(community)/[community]/boards/page.tsx` derives the level from URL params: `goBrands()` (~line 251) clears `view`/`brand`/`year`/`q`, meaning the NO-PARAM default level is `brands`. `goAll()` is the all-boards level.
2. The StatButton pair (~lines 343-344): `Boards` is active when `level === "all"`, `Brands` when `level === "brands"`. The filter row array (~line 367) lists `["brands", "Brands"]` first.
3. This layout shipped with the brand-first boards catalog redesign (PR #99, June 19; that PR also carries the still-outstanding optional `20260618000001_boards_banner.sql` migration gate, unrelated to this change).
4. The change is param-default plus array-order only; no data, no API, no migration. Check for any other links into `/boards` that assume the brands default (grep `"/boards"` and `view=` across `src/`) so deep links stay coherent.

## Acceptance

- On the recommended default: opening `/snowboarding/boards` with no params lands on the all-boards frame with the Boards StatButton active and "All boards" first in the filter row; Brands remains one tap away and `?view=brands` deep links land on the brands level; brand drill-down, Featured, My Boards, and search all unchanged.
- On the alternative (wont-fix): no code change; move BUG-127 to Shipped-as-declined with a one-line rationale in bug-triage.md.
- `npx tsc --noEmit` clean. Client-only, no migration.

## Standing rules

One PR, BUG-127 in the title. No em dashes anywhere. Run the full Ship sequence before wrapping ("No migration this session"). Append the SHIP-LOG entry. The `bugs/` folder is gitignored; do not commit it.
