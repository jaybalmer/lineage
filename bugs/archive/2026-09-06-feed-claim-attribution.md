# Bug-fix brief: the feed credits the wrong person, and a missing board renders as a dead "Unknown" link

**Drafted:** September 6, 2026 (daily triage, auto-drafted)
**BUG ids in scope:** BUG-183 (P1), BUG-184 (P2)
**Verified against:** `main` at `6b9b5ca`
**Migration:** none expected. No schema change, no `_public` view change, no write path.
**Risk:** client render only. Pipeline-safe on the recommended defaults, with one caveat in section 8.

---

## 0. Goal

The community feed at `/snowboarding/feed` attributes every claim to the claim's **subject** instead of to the member who **asserted** it, so a non-member ghost gets a card reading as if they did something. Fix the attribution, and while in the same file, stop a claim whose object no longer resolves from rendering as the literal word "Unknown" wrapped in a link to `#`.

---

## 1. DECISIONS (review before building)

Each has a recommended default. The brief is fully build-ready on the defaults; override any line before the session.

**D1. What the corrected card should say.**
- **Recommended default: keep the subject in the sentence, add the actor as the grammatical subject.** Grouped card becomes "OWNER added 4 places and 2 boards to Ingemar Backman's timeline", and when actor and subject are the same person it collapses back to today's copy, "OWNER added 4 places and 2 boards to their timeline". This is truthful, preserves the value of the BUG-076 grouping card, and keeps the subject discoverable.
- Alternative: drop the subject entirely ("OWNER added 4 places and 2 boards"). Simpler string work, but loses the whose-timeline information that makes the card useful.

**D2. What the group key becomes.**
- **Recommended default: group by actor and day** (`asserted_by|day`), which is what the BUG-076 card copy already claims to be ("a member's same-day claim adds"). Today it groups by `subject_id|day` (`src/lib/feed-grouping.ts:110`), which is why a bulk add about one ghost collapsed into one card in the first place.
- Alternative: group by actor, subject and day, so a member who edits two different people's timelines on one day gets two cards. Slightly more cards, more precise sentences. Take this one if D1's default reads awkwardly for mixed-subject days.

**D3. Fallback when the actor cannot be resolved to a name.**
- **Recommended default: reuse the existing `UNKNOWN_RIDER = "A rider"` constant** (`feed/page.tsx:125`) and render the card unlinked. Note the grouped card currently has NO fallback at all (`claim-group-card.tsx:39-48` renders an empty gap), so this is a real fix, not a no-op.
- Alternative: hide the card entirely when the actor is unresolvable. Rejected as the default: it silently drops real activity.

**D4. BUG-184, what to show when a claim's object does not resolve.**
- **Recommended default: render the entity name fallback as plain text with no link** rather than a link to `#`. A link that goes nowhere is worse than no link.
- Alternative: hide the card. Rejected: the claim is real data, and hiding it makes the underlying data problem invisible.

**D5. BUG-184, the "Unknown" string itself.**
- **Recommended default: leave `getEntityName`'s "Unknown" return alone and handle the presentation at the card**, because `getEntityName` lives in `src/lib/mock-data.ts` and is shared. Show the entity type instead, for example "A board" / "A place", matching the "A rider" tone already in the file.
- Alternative: change `getEntityName` itself. Wider blast radius, not worth it for this.

---

## 2. The two bugs

### BUG-183 (P1): the feed names the claim subject, not the member who added it

Reported September 6, 2026 by OWNER (signed in, desktop Chrome, 948x952), on `https://linestry.com/snowboarding/feed`, replay `S-55`:

> on the feed it shows that a rider 'Ingemar Backman' added to their timeline, but they are not an active member. It was added by another member (me)

Ingemar Backman is a catalog person, not an account holder. He cannot have added anything.

### BUG-184 (P2): a board in the feed shows as "Unknown" and cannot be clicked

Reported September 6, 2026 by Anonymous (logged out, iPhone Safari, 402x522), on `https://linestry.com/snowboarding/feed`, replay `S-53`:

> Jeff Patterson added a board that is showing as 'unknown' and can't be clicked on in the feed

Both reports are the same surface and the same file, which is why they are one cluster.

---

## 3. Verified facts (checked against `6b9b5ca`, do not re-derive)

**Feed route file:** `src/app/(community)/[community]/feed/page.tsx`, 424 lines, client component, single file for the route.

**The root cause of BUG-183 is three lines:**

```ts
209  function authorForClaim(claim: Claim) {
210    return catalog.people.find((p) => p.id === claim.subject_id)
211  }
```
`feed/page.tsx:209-211`. The function is named `authorForClaim` but resolves the **subject**. `git blame` dates it to `d5883972` (2026-03-23), so it long predates today's grouping PR.

Call sites: `feed/page.tsx:342-343` (grouped card) and `feed/page.tsx:379-380` (single card). The rendered line for a single card is `feed/page.tsx:385-387`:

```ts
385                  <ContextLine
386                    name={authorName || UNKNOWN_RIDER}
387                    href={authorName ? `/people/${nameToSlug(authorName)}` : undefined}
```

`ContextLine` is defined at `feed/page.tsx:98-119`. `UNKNOWN_RIDER = "A rider"` at `feed/page.tsx:125`.

The grouped card copy is `src/components/feed/claim-group-card.tsx:49`:

```tsx
49          <span className="text-muted">added {summary} to their timeline</span>
```

**`asserted_by` is already on the payload.** The feed reads `claims_public` with `.select("*")` (`feed/page.tsx:153-160`), and the view is defined `SELECT c.*` (`supabase/migrations/20260617000001_bug066_rode_with_parent_claim.sql:45-49`). So the asserter id is in hand; the UI simply never reads it. There is no read of `claim.asserted_by` anywhere under `src/app/(community)/[community]/feed/`, `src/components/feed/`, or `src/lib/feed-grouping.ts`.

**The write path confirms the semantics.** `POST /api/claims` writes `subject_id` = the person the claim is about and `asserted_by` = the acting user (`src/app/api/claims/route.ts:213`). `add-person-connections-popover.tsx:102,124` and `start-card.tsx:247,272` are the surfaces that set it.

**Column type caveat:** `claims.asserted_by` is TEXT, not uuid, and legacy person ids plus orphan asserter uuids are a known production pattern (recorded in `bugs/archive/2026-07-31-feed-claim-delete.md:32`; corroborated by `docs/backfill-token-earning.sql:37`, which joins `profiles p on p.id::text = c.asserted_by`). **So the actor lookup must be string-compared and must tolerate a miss.** This is exactly what D3 covers. There is no `CREATE TABLE public.claims` in `supabase/migrations/`, so the declared type is not verifiable from this repo; treat TEXT as the working assumption and code defensively either way.

**PR #232 (`b7713e0`, merged today) did not cause this, but it made it louder.** `git show b7713e0 --stat`: 3 files, 241 insertions, 0 deletions. It added `src/lib/feed-grouping.ts` (`groupClaimsByAuthorDay`, `summarizeClaimTypes`) and `src/components/feed/claim-group-card.tsx`, and added a `useMemo` plus a render branch in `feed/page.tsx`. It reused the pre-existing `authorForClaim` at line 342 rather than changing it. Before the PR the misattribution read as an ambiguous per-card action string; after it, three or more same-day claims collapse into one possessive sentence, which is why the report arrived hours after the merge. Grouping applies only in the "Recently added" sort (`feed/page.tsx:244-246`), which is the feed default (`feed/page.tsx:131`), and the threshold is 3 (`feed-grouping.ts:15`).

**The group key today:**
```ts
110      const key = `${c.subject_id}|${day}`
```
`src/lib/feed-grouping.ts:110`. See D2.

**BUG-184 root cause, both halves in one place.** Board claim cards render through `PostCard` (`src/components/feed/post-card.tsx`), not through `EntityChip`. Resolution order at `post-card.tsx:332-334`:

```ts
332  const board  = type === "board"
333    ? (catalog.boards.find((b) => b.id === id) ?? userEntities.boards.find((b) => b.id === id) ?? getBoardById(id) ?? null)
```

When all three miss, the name falls through `post-card.tsx:636-642` to `getEntityName`, and:

```ts
491  export function getEntityName(id: string, type: string): string {
492    const entity = getEntityById(id, type)
493    if (!entity) return "Unknown"
```
`src/lib/mock-data.ts:491-493` (a second `return "Unknown"` at `:500`). That is the literal string the reporter saw.

The same miss zeroes the href:
```ts
349  const href = place  ? `/places/${placeSlug(place)}`
350    : board  ? `/boards/${boardSlug(board)}`
...
355    : "#"
```
`post-card.tsx:349-355`. That `href` reaches `CommunityLink` at `post-card.tsx:456` and `:469`. `communityHref` passes `"#"` straight through, only prefixing strings that start with `/` (`src/components/ui/community-link.tsx:33-42`). Result: looks like a link, does nothing. That is the "can't be clicked on" half of the report.

**Catalog truncation is ruled out as the cause.** The store loads boards with `selectAll("boards")`, paging PostgREST 1000 rows at a time until a short page returns (`src/store/lineage-store.ts:14-32`, called at `:260`), so all ~3,180 rows are resident.

---

## 4. Diagnosis step for BUG-184, do this first

The code fix above is correct regardless, but it treats a symptom. Before or alongside it, find out **why** a claim points at a board that does not exist. Run against production:

```sql
-- claims whose board object has no matching boards row
select c.id, c.subject_id, c.asserted_by, c.object_id, c.created_at
  from claims c
 where c.object_type = 'board'
   and not exists (select 1 from boards b where b.id = c.object_id)
 order by c.created_at desc
 limit 50;
```

Two likely explanations, and they need different follow-ups:
- The board row was **deleted** after the claim was made. Then the real fix is a delete-time cascade or a soft-delete, and it deserves its own BUG id.
- The claim's `object_id` is a **legacy or malformed id** (the `person_*` style problem that hit the catalog before, or a merge that repointed people but not boards). Note `merge_person_into` repoints `boards.added_by` but nothing repoints `claims.object_id` for boards.

Record the answer in the PR description. If the query returns zero rows, say so: it means the board resolves server-side and the miss is client-state only, which changes the conclusion.

---

## 5. Files to touch

| File | Why |
|---|---|
| `src/app/(community)/[community]/feed/page.tsx` | `authorForClaim` (`:209-211`), both call sites (`:342-343`, `:379-380`), the `ContextLine` props (`:385-387`) |
| `src/lib/feed-grouping.ts` | group key at `:110`, and whatever `groupClaimsByAuthorDay` returns so the card can name both actor and subject |
| `src/components/feed/claim-group-card.tsx` | the copy at `:49`, plus the missing name fallback at `:39-48` |
| `src/components/feed/post-card.tsx` | BUG-184: the `href` fallthrough at `:349-355` and the name fallback at `:636-642` |

Do **not** change `src/lib/mock-data.ts` (see D5). Do **not** change `POST /api/claims`; the write path is correct and this is a read-side bug.

---

## 6. Suggested order

1. Run the section 4 SQL, record the answer.
2. Rename `authorForClaim` to something honest (`subjectForClaim`) and add a real `actorForClaim` that resolves `claim.asserted_by` against `catalog.people` with a string compare. Keep both; the card needs both names.
3. Repoint the two call sites and `ContextLine` to the actor. Apply the D3 fallback at both, including the grouped card's currently missing one.
4. Change the group key per D2 and thread the subject through to `ClaimGroupCard`.
5. Update the `claim-group-card.tsx:49` copy per D1, including the actor-equals-subject collapse.
6. BUG-184: make the card render an unlinked title when the entity does not resolve, and swap the "Unknown" presentation per D5.
7. `npx tsc --noEmit`.

---

## 7. Acceptance criteria

**BUG-183**
- A claim added by member M about catalog person G renders in the feed naming **M** as the actor, not G.
- The grouped card sentence names both M and G, and collapses to "their timeline" when M and G are the same person.
- Grouping collapses a member's same-day adds as before (three or more, "Recently added" sort only). Verify the BUG-076 behaviour did not regress.
- A claim whose `asserted_by` resolves to nobody renders "A rider" and is not a link. No blank gap on the grouped card.
- The actor link, when present, points at the actor's profile, not the subject's.

**BUG-184**
- A claim whose object does not resolve renders a readable fallback and is **not** wrapped in a link to `#`.
- A claim whose object does resolve is unchanged: correct name, correct working link.
- The section 4 query result is recorded in the PR description.

**Both**
- `npx tsc --noEmit` clean.
- No change to any write path, view or migration.

---

## 8. Pipeline note

Client render only, no migration, no auth, no payments, no membership path, so this is legal for the unattended slot on the recommended defaults. One caveat: it changes what the primary community surface says about who did what, which is worth a human look before merge if a person is available. If the unattended run takes it, it should take **BUG-184 only** and leave BUG-183 for an attended session, since BUG-183 carries copy decisions (D1, D2) that benefit from a review.

---

## 9. Wrap

- Name **BUG-183** and **BUG-184** in the PR title or commit message. The daily reconcile keys on that and nothing else.
- Append a `bugs/SHIP-LOG.md` entry with `migration: none`, `status: merged` once merged.
- Do not edit the Shipped section of `bugs/bug-triage.md`; the reconcile does that.
- No em dashes anywhere you write.
