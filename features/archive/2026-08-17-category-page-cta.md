# Category Page Calls to Action

**Build-ready brief for a Claude Code feature session**
**Authored:** August 17, 2026 (Cowork, Jay live). **v3: StoryBrand copy reframed from loss to scatter-to-connection per Jay.**
**Size:** ~1.5 to 2.5 hr. Single PR. **No migration. No schema. No write paths. Copy and layout only.**
**Why now:** the FNRad Season 12 intro episode announces Linestry as sponsor/partner **this week**. Traffic is expected. Every catalog page a new visitor lands on should say what the community is building and ask them to add to it. Right now four of the five say almost nothing.

---

## 0. The one-line version

The Boards page already does this correctly. Make Places, Events, Riders, and Brands match its structure, and put StoryBrand copy (§2) in all five.

Current Boards page (`(community)/[community]/boards/page.tsx:333`) renders an intro card: a wordmark-font `<h1>` ("The Snowboard Catalog"), a live count, and a contribution ask ("Built together by the community... help us catalog every board ever ridden"), with the add buttons in the same card.

Current Places page (`:154`) renders `<h1>Places</h1>` and a nine-word muted subtitle ("Resorts, shops, and zones in the linestry"). Riders, Events, and Brands follow the same thin pattern. None of them ask the visitor for anything.

---

## 1. Scope

Five pages. Four change substantively, one gets a copy pass only.

| Page | File | Current header | Action |
|---|---|---|---|
| Places | `src/app/(community)/[community]/places/page.tsx:152-163` | `<h1>Places</h1>` + muted subtitle | Replace with intro card |
| Events | `src/app/(community)/[community]/events/page.tsx:~306-315` | `<h1>Events</h1>` + subtitle | Replace with intro card |
| Riders | `src/app/people/page.tsx:349-364` | `<h1>Riders</h1>` + count subtitle | Replace with intro card |
| Brands | `src/app/(community)/[community]/brands/page.tsx:238-246` | `<h1>Brands & Orgs</h1>` + subtitle | Replace with intro card |
| Boards | `src/app/(community)/[community]/boards/page.tsx:330-360` | Already an intro card | Copy pass only, leave structure alone |

**Out of scope, do not touch:** search inputs, sort tabs, filter chips, the card grids, the `AddEntityModal` instances and their props, any data fetching, `/[community]/stories`, `/[community]/feed`, `/[community]/collective`.

---

## 2. The copy

Jay's August 17 lines were the starting point, not the final text. This section rewrites them against StoryBrand while staying inside Jay's voice profile (`Brand/Jay-Writing-Voice-SKILL.md`).

### 2a. The structure, and why each line exists

**The rider is the hero. Linestry is the guide.** That is the whole discipline here, and it is the thing most category-page copy gets backwards. Every line below is about what the visitor holds and what it connects to, never about what the platform does.

Three lines per page, in a fixed order:

| Line | StoryBrand role | Job |
|---|---|---|
| Heading | The hero's world, named | Tell them this page is about them, not about a database |
| Problem line | The problem, stated plainly | Name what is scattered. This is the line that creates the reason to act. |
| Plan line | The plan, then the call to action | Make the next step feel small and obvious. One action, no branching. |

The **button beside it is the single call to action.** Do not introduce a second competing action anywhere in the card (see D5).

**The villain is scatter, not loss.** This is a deliberate call by Jay on August 17 and it overrides an earlier draft that led with things disappearing. Both are true, but they land differently:

- *Loss framing* ("hills close, shops shut down, it gets forgotten") is elegiac. It positions the visitor as mourning something, and it argues.
- *Scatter framing* ("everyone has their piece, it is spread across a few thousand memories") is an invitation. It positions the visitor as **holding a piece that is needed**, and it recruits.

Scatter is also the brand's own frame. The homepage already runs "Our history is real, but scattered," the product name is lineage plus tapestry, and the promise the product actually delivers is **connection**, not preservation. The success state at the end of the story is seeing where your lines cross someone else's, so the problem at the start of the story should be that they have not crossed yet.

**Voice guardrails that override StoryBrand where they conflict:** no aphorisms, no extended metaphors, no clever headings, no exclamation marks, no em dashes. Plain declarative. Concrete nouns (hills, shops, contests, boards, names). Collective "we" and "our". Invitation over critique, recruit rather than argue. If a line starts sounding like a brand manifesto, cut it back to what one rider would say to another.

### 2b. The copy

**Places**
- Heading: **The Places We Rode**
- Problem: Every rider has their own list. Home hills, the shop that sponsored you, the road trips. It is all out there, just scattered across a few thousand memories.
- Plan: Add the resorts, shops, and spots from your riding. Help map the places that connect us.
- Button: `+ Add place` (existing, unchanged)

**Events**
- Heading: **The Events That Brought Us Together**
- Problem: Contests, sessions, and trips, all remembered in pieces. You have your half of the day and someone else has the rest.
- Plan: Add an event you were at. Help fill in who was actually there.
- Button: `+ Add event` (existing, unchanged)

**Boards**
- Heading: **The Snowboard Catalog** (unchanged)
- Problem: The full list of boards ever made does not sit in one place. It is spread across closets, collections, and old catalogs.
- Plan: Add the boards you rode and the ones in your collection. Together we can build the whole thing.
- Button: `+ Add a board` / `+ Add a brand` (existing, unchanged)
- Note: keep the live `{totalBoards}` / `{totalBrands}` counts. Real numbers are the guide's proof of authority, and this page already has them.

**Riders**
- Heading: **The Riders Who Were There**
- Problem: Your crew, the locals, the ones who shaped your scene. Some of them are on here already and most of them are not.
- Plan: Add the riders you rode with. That is how the lines start crossing.
- Button: `+ Add rider` (existing, unchanged)

**Brands**
- Heading: **The Brands That Built It**
- Problem: Brands, shops, teams, and mags each hold their own history, and none of it is in one place.
- Plan: Add the ones you rode for, worked at, or grew up on. Help connect them to the riders who carried them.
- Button: `+ Add brand` (existing, unchanged)

**Note on the Riders plan line.** "That is how the lines start crossing" reads like a flourish but it is product vocabulary, not a metaphor: Compare and Connections are real surfaces and the homepage already ships "Find where lines cross." Keep it. If it ever gets cut, replace it with a concrete outcome, not a softer abstraction.

### 2c. Rendering the two lines

Problem and plan are two sentences in one paragraph, not two paragraphs. Keep the existing `<p className="text-sm text-muted mt-1 max-w-md">` and let them run together. Two stacked paragraphs makes the card too tall and pushes the actual cards below the fold on mobile, which defeats the point.

If a page's card is running long at 375px, **cut the problem line to its first sentence** rather than dropping the plan line. The plan line is the conversion.

---

## 3. The intro card pattern

Lift the structure from the Boards page. It is the reference implementation and it is already responsive and theme-correct.

```
<div className="bg-surface border border-border-default rounded-xl p-5 mb-6
                flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
  <div className="min-w-0">
    <h1 className="text-2xl font-bold text-foreground"
        style={{ fontFamily: "var(--font-wordmark)" }}>
      {heading}
    </h1>
    <p className="text-sm text-muted mt-1 max-w-md">
      {statLine} {ctaLine}
    </p>
  </div>
  <div className="flex ... shrink-0">
    {existing add button(s), moved in unchanged}
  </div>
</div>
```

Notes, all verified against the live file:
- `var(--font-wordmark)` is Calendula Bold, applied inline. It is already used for the Boards `<h1>` and community titles, so this is the established treatment for a page title, not a new one.
- The existing add buttons keep their exact classes and handlers. They move into the card's right-hand cluster. Do not restyle them.
- `max-w-md` on the paragraph keeps the line length readable; keep it.
- Boards uses `max-w-5xl` on its container; Places, Riders, Events use `max-w-3xl`. **Keep each page's existing container width.** Do not standardize widths in this PR.

`{statLine} {ctaLine}` above maps to the **problem sentence** then the **plan sentence** from §2b, run together in the one paragraph.

### Counts

Headings come from §2b. Counts are optional decoration, not the deliverable.

Each page already computes the numbers it needs, so no new queries.

| Page | Heading | Stat line source |
|---|---|---|
| Places | The Places We Rode | distinct place count, already rendered in the list |
| Events | The Events That Brought Us Together | event count |
| Riders | The Riders | `totalCount`, already computed at `people/page.tsx:353` |
| Brands | The Brands That Built It | brand + org counts, already computed |
| Boards | The Snowboard Catalog (unchanged) | `totalBoards` / `totalBrands` (unchanged) |

If a count is not already in scope on a page, **omit the stat line rather than adding a query.** The ask line is the deliverable; the number is a bonus.

---

## 4. DECISIONS (review before building)

**D1. Headings: wordmark font or plain?**
Default: **wordmark font, `text-2xl`,** matching Boards. It makes the five pages read as one family and it is the treatment already in production. Override to plain `text-xl font-bold` if the Calendula weight feels heavy at five pages in a row.

**D2. Copy.**
§2 rewrites all five pages against StoryBrand; Jay's August 17 lines were starting points, not final text. Default: **ship §2b as written.** Every line is a one-string change, so any of them can be swapped at code time without touching structure.

**D3. Does the ask show to signed-out visitors?**
Default: **yes, show to everyone.** FNRad traffic arrives signed out, and the ask is the point. The add buttons already handle their own auth state; do not add a signed-in gate around the copy.

**D3a. Signed-out friction (StoryBrand: keep the plan to one step).**
Verify what actually happens when a signed-out visitor presses an add button. If it drops them into a full onboarding wizard, the plan is not one step and the copy is writing a cheque the flow does not cash. **If the friction is high, do not solve it in this PR.** Note it, ship the copy, and raise it as the next brief. Flagging it because a traffic week is exactly when this gap costs the most.

**D4. Mobile treatment.**
Default: the Boards card already stacks (`flex-col lg:flex-row`). Verify at 375px and 414px that the heading, ask line, and buttons stack cleanly with no overflow. **Related: BUG-158 is an open owner-only overlap at 414x750.** It is on `post-card.tsx`, not these pages, so it should not interact, but check 414px anyway since you are already there.

**D5. Should the ask line link anywhere?**
Default: **no link.** The add button beside it is the action. Adding an inline link creates two competing affordances in one card. Revisit after the traffic wave if the buttons underperform.

---

## 5. Acceptance criteria

1. `npx tsc --noEmit` clean. ESLint clean.
2. All five pages render an intro card with heading, ask line, and the page's existing add button(s) inside it.
3. Each of the five pages carries a heading, a problem sentence, and a plan sentence per §2b, in that order. No em dashes anywhere in the diff. No exclamation marks. No line describes what the platform does; every line is about the rider and what they have.
4. No change to search, sort, filter, card grids, or any `AddEntityModal` props.
5. Add buttons still open their modals and still create entities. Smoke one add on one page.
6. 0px horizontal overflow at 375px and 414px on all five pages.
7. Signed-out render of all five pages shows the ask line.
8. Boards page structure is unchanged apart from copy.
9. Dark mode and light mode both correct (uses `bg-surface` / `border-border-default` / `text-muted` tokens only, no hardcoded colors except the existing button `#1C1917`).

---

## 6. Suggested order

1. Boards copy pass first. Smallest change, and it confirms the pattern you are copying.
2. Places. It is the cleanest header block and becomes the template for the rest.
3. Riders. Same structure as Places, plus the `totalCount` stat line.
4. Events. Slightly larger file, same block.
5. Brands. Do last; it has four `<h2>` section subheads below the header that must not be disturbed.
6. Responsive pass at 375 and 414 across all five.
7. `tsc`, commit, PR, merge. No migration, so no gate.

---

## 7. Pre-flight facts (verified against the live repo, August 17 2026)

- Places, Riders, Events, Brands all use the same header block shape: a `mb-6 flex items-center justify-between` wrapper, a `<div>` holding `<h1 className="text-xl font-bold text-foreground">` plus a `<p className="text-sm text-muted mt-1">`, and a single dark add button.
- Boards is the outlier and the good one: `bg-surface border border-border-default rounded-xl p-5 mb-6` intro card, wordmark `<h1>`, contribution ask, two add buttons.
- Every one of the five files already imports `AddEntityModal` and owns its own `addOpen` state. Nothing needs lifting.
- Riders lives at `src/app/people/page.tsx` (top-level, global), NOT under `(community)`. It was moved there by PB-008 Phase 2. Do not look for it under the community segment.
- Brands page is `brands/page.tsx` with a `[slug]` child; its `<h1>` reads "Brands & Orgs".
- All five are `"use client"` components.
- `--font-wordmark` is Calendula Bold, self-hosted via `next/font/local`, applied inline as `style={{ fontFamily: "var(--font-wordmark)" }}`. There is no Tailwind class for it.

---

## 8. Why this is the right ship this week

The FNRad announcement is a one-shot traffic event. A visitor who arrives, browses Places, and sees "Resorts, shops, and zones in the linestry" has been told a category label. A visitor who sees "Add in the resorts, shops, and places that are part of your snowboarding journey" has been told what to do. The catalog is the contribution surface with the lowest barrier in the whole product: no story to write, no date to remember, just a place you rode.

It is also the cheapest complete ship on the board: no migration, no schema, no write paths, no gate, and it can merge the same day it is built.
