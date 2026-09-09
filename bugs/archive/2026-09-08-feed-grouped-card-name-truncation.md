# BUG-187: the grouped feed card clips the member's name

**Drafted:** September 8, 2026 (daily triage, auto-drafted).
**Verified against:** `main` @ `cdb0224`.
**Scope:** one file, one component, client render only.
**Classification:** PIPELINE-SAFE. No migration, no SQL, no write path, no auth surface, no `_public` view. Eligible for the 05:00 unattended run and for auto-merge.
**Estimated size:** 15 to 30 minutes including smoke.

---

## 0. What this is, honestly

This is a one-component layout fix with a well-understood cause, not an investigation. Both halves of the regression are already verified in code and in `git log -L`, and they are recorded in section 3. There is no diagnosis step and no open data question. The playbook checks that matter here are the surface-existence audit, the component-capability check, and the "do not fix the symptom in the wrong place" guard in section 5. The rest of the 24-check playbook does not apply to a render-only change and has been trimmed.

---

## 1. Goal

On the community feed, a grouped claim card must show the acting member's **full name** at mobile widths, wrapping with the sentence instead of ellipsizing to "Jay.." or "D...".

---

## 2. DECISIONS (review before building)

Two decisions. The brief is fully build-ready on the recommended defaults; override any line before the session and the rest still holds.

**D1. How to stop the name being eaten.**
- **Recommended default: make the header one wrapping text flow.** Drop the inner `flex` and render the name and the sentence as inline content in a single block, so the browser wraps the whole sentence naturally and the name is never a separately-shrinkable box. This is the smallest change, it removes the failure mode rather than tuning around it, and it matches how the sentence reads to a person: "Jay Balmer added 1 place, 2 events and 1 entry to Ingemar Backman's timeline" is one sentence, not two columns.
- Alternative: keep the flex row, add `flex-wrap` to the container and `shrink-0` to the name, and drop `truncate`. This also works, but it leaves a two-item flex layout whose only protection against a pathologically long display name is that nothing is allowed to shrink, which is how the next overflow bug gets written.

**D2. What to do about a genuinely very long display name.**
- **Recommended default: nothing.** Let it wrap. Display names are short in practice, the card has no fixed height, and wrapping a long name costs one extra line. Adding a cap here is what created the bug.
- Alternative: cap the name with `max-w-[60%] truncate` so an abusive name cannot push the sentence off screen. Only take this if Jay wants a hard guard; it reintroduces ellipsis for long-but-legitimate names.

---

## 3. Verified facts (all checked against `cdb0224`)

1. `src/components/feed/claim-group-card.tsx:48-63` is the header. Line 49 is `<div className="flex items-center gap-1 text-sm min-w-0">`. It does **not** carry `flex-wrap`.
2. That div has exactly two flex children: the actor, rendered as a `<Link>` at `:51-56` (or a bare `<span>` at `:58` when `authorHref` is absent), and the summary `<span>` at `:60` reading `added {summary} to {timelineOwner} timeline`.
3. Both actor variants carry `truncate`. `truncate` is `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`. The `overflow:hidden` is the operative part: it sets that flex item's automatic minimum size to zero, so it is the only child free to shrink. The summary span wraps normally, so its min-content width is its longest word and it resists shrinking. All shrink therefore lands on the name.
4. `truncate` on line 53 is **original to PR #232** (`b7713e0`, September 6, the BUG-076 grouping card). Confirmed with `git log --oneline -L53,53:src/components/feed/claim-group-card.tsx`, which shows the line arriving with the file.
5. PR #236 (`949ac7d`, September 7) introduced `subjectName` and the `timelineOwner` expression at `:42-43`, replacing the constant string "their" with `"{SUBJECT}'s"` for cross-timeline adds. That is what lengthened the sentence past the visible threshold. See `claim-group-card.tsx:28-31` and `:42-43`.
6. The unresolved-actor fallback lives at the **call site**, not in this component: `src/app/(community)/[community]/feed/page.tsx:362` passes `authorName={actorName || UNKNOWN_RIDER}` with `UNKNOWN_RIDER = "A rider"` at `:125`, and passes `authorHref` as `undefined` when the actor did not resolve (`:363`). So the unlinked-`<span>` branch at `:57-59` is the "A rider" path and must keep behaving the same.
7. The same call site passes `subjectName` from `subjectForClaim` (`:353-354`), which may be `undefined`; `:42-43` already collapses that case to "their".
8. `src/components/feed/story-card.tsx:328` carries `truncate` on the author name **deliberately**. The comment at `:307-312` records it as the BUG-158 fix: at 414px the name overflowed its `min-w-0` box and the Lifetime `MemberBadge` overlapped the "Only you" badge. That is an avatar row where the name sits beside a badge, not a sentence. **It is out of scope.**
9. `src/components/feed/mention-episode-group.tsx` is the sibling group card and does **not** have this pattern: its header uses `flex-shrink-0` on the trailing control (`:62`) and carries no truncated name in a sentence. Nothing to change there.
10. No test file covers `claim-group-card.tsx`; there is no test suite to update.

---

## 4. Suspected files

**Change:**
- `src/components/feed/claim-group-card.tsx` (the header block, `:46-63`)

**Read for context, do not change:**
- `src/app/(community)/[community]/feed/page.tsx:340-370` (the call site, prop shapes, `UNKNOWN_RIDER`)
- `src/components/feed/story-card.tsx:305-333` (why the sibling `truncate` stays)

---

## 5. The trap

Do not do a repo-wide sweep removing `truncate` from author names. Fact 8 is the counter-example and it is a shipped fix for a real overlap bug. The rule that separates them: **truncate a name when it is a label competing for room with another element; never truncate a name that is a word inside a sentence.** Scope this change to `claim-group-card.tsx`.

---

## 6. Suggested implementation order

1. Read `claim-group-card.tsx` whole, plus `feed/page.tsx:340-370` for the prop contract.
2. Rewrite the header per D1: single wrapping text flow, name inline, sentence inline, an explicit space between them (`{" "}` rather than the `gap-1` the flex row was providing). Keep `ago` in its own `shrink-0` element on the right, and keep the outer row's `flex-wrap` so `ago` can drop to its own line when tight.
3. Preserve both actor branches: linked `<Link>` when `authorHref` is set, bare `<span>` when it is not. Keep the `font-medium text-foreground` weight on both and the `hover:text-blue-400 transition-colors` on the link, so nothing about the visual weight of a name changes.
4. Replace the BUG-076 comment on the truncate line with a one-line note naming BUG-187 and why the name must not be a shrinkable box, so the next person does not reintroduce it.
5. `npx tsc --noEmit` must be clean.
6. Smoke at 375px on `/snowboarding/feed`. `npm run dev` runs from `/Users/jaybalmer/lineage`.

---

## 7. Acceptance criteria

1. At a 375px viewport on `/snowboarding/feed`, a grouped card whose sentence uses the long subject variant ("added 1 place, 2 events and 1 entry to Ingemar Backman's timeline") renders the actor's **full** display name. No ellipsis anywhere on the name.
2. The same card at desktop width is visually unchanged from today apart from the name no longer being clipped.
3. A grouped card with a short summary ("added 18 boards to their timeline") still renders on one line where it fits.
4. When the actor does not resolve, the card still reads "A rider added ..." and the name is **not** a link. (Force this by temporarily passing `authorHref={undefined}`, or find a claim whose `asserted_by` does not resolve.)
5. When actor and subject are the same person, the sentence still collapses to "their timeline". When they differ, it still names the subject possessively. The #236 behaviour is untouched.
6. The "Show the N entries" toggle still expands to one `PostCard` per claim and the expanded state is unchanged.
7. `src/components/feed/story-card.tsx` has zero diff.
8. `npx tsc --noEmit` clean.

---

## 8. Database

**No migration this session.** No SQL, no view rebuild, no backfill, no data read or write of any kind. This is a className and JSX-structure change in one client component.

---

## 9. Wrap

- Name **BUG-187** in the PR title or commit message. The daily triage reconcile keys off that id.
- Append one `bugs/SHIP-LOG.md` entry using the schema at the top of that file: `type: bug`, `pr: #<n>`, `ids: BUG-187`, `scope: feed-grouped-card-name-truncation`, `migration: none`, `status: merged`, `tsc: clean`.
- Do not edit the **Shipped** section of `bugs/bug-triage.md`. Cowork reconciles it.
- No em dashes anywhere you write, including code comments and any UI copy.
