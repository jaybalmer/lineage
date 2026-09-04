# Bug-fix brief: fold a run of same-episode podcast mentions into one card on a timeline

**Date drafted:** August 18, 2026 (evening intake)
**BUG ids in scope:** BUG-172
**Estimated size:** 1.5 to 2.5 hr. Client-only. No migration, no schema, no API change.
**Run mode:** PIPELINE-SAFE on the defaults below (presentation only, no write path, no auth path, no DB).

---

## 0. Goal (one line)

On a person's timeline, N podcast mentions that come from the same episode currently render as N near-identical stacked rows on the same date; fold them into one expandable episode card that names each mention, keeps the per-mention "Read the line", and adds an expand-all.

---

## DECISIONS (review before building)

The brief is fully build-ready on the recommended defaults. Override any line before the session starts.

**D1. Group key: episode, not show.**
- Recommended: group on `mention.episode_event_id`. Every mention in a group then shares one real date, which is what the timeline node points at, and the card can carry a working episode link and a single "Watch" target.
- Alternative: group on the show (`episode.show_org_id` / `show_name`), which is closer to the literal words in the report ("if they are all the same podcast"). Rejected as the default because a show spans years, so a show-level card would have to sit at an arbitrary date and would swallow episodes that belong at different points on the timeline. If Jay wants a show rollup it is a second, larger grouping layer and should be its own item.

**D2. Only group when it helps: threshold of 2.**
- Recommended: a single mention on an episode renders exactly as it does today (a bare `MentionRow`), untouched. The group shell appears only at 2 or more.
- Alternative: always render the shell so every mention looks identical. Rejected: it adds a chrome layer around the common case for no gain.

**D3. Default state is collapsed with a preview.**
- Recommended: collapsed shows the episode label, the count ("Mentioned 6 times on FNRad #142"), the episode date, and the first 3 mention lines (story title when present, else a one-line excerpt clamp). The rest sit behind "Show all 6".
- Alternative: list every line immediately. Rejected for the same reason the bug was filed: a long undifferentiated run is the complaint.

**D4. Two levels of expand, both kept.**
- Recommended: each row inside the group keeps its own "Read the line" expand exactly as today, and the group header carries an "Expand all" / "Collapse all" toggle that flips them together. This is literally what the report asks for.
- Alternative: group-level expand only. Rejected: it loses the per-line read that already works.

**D5. Apply the same grouping to the entity mention list in this PR.**
- Recommended: `EntityMentions` (place, brand, board and event pages) renders the identical ungrouped list from the same component, so it has the identical stacking. It is the same one-line component swap; fix both while the helper is fresh.
- Alternative: timeline only, and file the entity pages separately. Rejected as busywork.

**D6. Header copy.**
- Recommended: `Mentioned 6 times on FNRad #142`, with the episode date rendered by the existing date treatment beside it. Collapsed control reads `Show all 6`; expanded reads `Show less`. The all-lines toggle reads `Expand all` / `Collapse all`.
- Alternative: `FNRad #142 - 6 mentions`. No em dashes in any string that ships.

---

## 1. The report

August 18, 2026, 16:46 UTC, anonymous (logged out), desktop Chrome 1411x965, `https://linestry.com/people/sean_spud_balmer`.
Session replay `S-45`, offset 39 seconds. Report started 16:43:57 UTC. No screenshot attached.

> "Looking at Sean's timeline and the podcast mentions are now there all grouped together. Maybe if they are all the same podcast they can be grouped together. Expand to see the name of each mention, Read the line for each, and expand all.
>
> I was also expecting the mentions to be spread by when the stories happened in time, not just when they were told. That is big feature :)"

The second paragraph is **out of scope** and is logged separately as **BUG-173** in the Deferred section of `bugs/bug-triage.md`. It needs a new "when this happened" date on a mention (the type has no such field today), an authoring surface to fill it, and a product call about what a mention with no such date does on the timeline. Do not build any part of it here.

---

## 2. Verified facts (grepped against the live repo this run, not assumed)

1. `src/components/feed/feed-view.tsx:219-226` builds **one `FeedItem` per mention**, with `sortDate: dateToSortNum(mention.episode?.start_date)`. Every mention from the same episode therefore lands on the **same** sortDate.
2. Ties break on `predicateRank` (`feed-view.tsx:87-100`), where every mention returns the same `7`, so a same-episode run has no internal ordering rule and renders in whatever order the API returned.
3. `feed-view.tsx:415-417` renders `<MentionRow mention={item.mention} context="timeline" />` once per item, each inside its own `relative pl-9` wrapper with its own fuchsia node (`nodeColor`, line 77, `bg-fuchsia-500`). Six mentions therefore draw six nodes at one date.
4. `MentionRow` with `context="timeline"` **leads with the episode label** (`episodeLabel()`, `src/components/feed/mention-row.tsx:48-57`, producing "FNRad #142"). That is the exact string repeated N times down the column, which is why the run reads as undifferentiated.
5. `src/lib/mentions.ts:58` already exports `groupMentionsByMoment`, used by `src/components/events/episode-page.tsx:396` and `src/components/public-timeline/public-episode-view.tsx:177`. **It is the wrong key here.** It groups on timestamp plus excerpt to fold one story written once per subject. On a person's timeline every row already belongs to that one person, so at most one row per moment survives and moment-grouping folds nothing. The needed key is `episode_event_id`.
6. `src/components/feed/entity-mentions.tsx:60-66` renders the same ungrouped `mentions.map(... <MentionRow context="timeline" />)` on place, brand, board and event pages, after sorting newest episode first then by timestamp (lines 44-50). Same stacking, same fix.
7. `src/types/index.ts:452-478`: `Mention` carries `episode_event_id`, `timestamp_seconds`, `excerpt`, `story_title`, `status`, and a joined `episode` object (`id`, `name`, `start_date`, `episode_number`, `media_url`, `show_org_id`, `show_name`). **There is no field for when the described event happened**, which is the BUG-173 blocker.
8. `GET /api/mentions` (`src/app/api/mentions/route.ts:44-47`) orders by `timestamp_seconds` ascending nulls last, then `created_at`, and its own comment says "the timeline surface re-sorts by episode date anyway". So within one episode the rows arrive **already in listening order** and a group can preserve input order without re-sorting.
9. Counts are safe. `filterCounts.mentions` is `mentions.length` (`feed-view.tsx:277`), the raw row count, not a FeedItem count, so the Mentions chip is unaffected by grouping. `filterCounts.all` uses `countTimelineEntries(...)` and **deliberately excludes mentions** (comment at lines 274-276), so the owner's "Entry #N" celebration (the BUG-104 family) cannot regress from this change.
10. The one count that does move is the decade header, `{grouped[decade].length} entries` at `feed-view.tsx:382`, which counts FeedItems. After grouping, a decade holding six mentions from one episode reports one entry instead of six. See section 6.
11. `/t/[slug]` is not affected. `src/components/public-timeline/public-timeline.tsx` renders no mentions; the public mention components (`public-mention-row.tsx`, `public-mention-group.tsx`) are used only by `public-episode-view.tsx`, which already groups by moment. Do not touch the public-timeline components.
12. The mentions filter chip is conditional (`feed-view.tsx:321`, rendered only when `mentions.length > 0`); leave that as is.

---

## 3. Pre-flight (read-only, run before writing code)

Confirm the stacking is real and find the worst case, so the collapsed preview count in D3 is tuned to real data rather than a guess. Read-only, safe to run against prod:

```sql
-- How many published mentions does a single person carry from a single episode?
select m.subject_id,
       m.episode_event_id,
       count(*) as rows_in_group
from mentions m
where m.subject_type = 'person'
  and m.status = 'published'
group by 1, 2
having count(*) > 1
order by rows_in_group desc
limit 20;
```

```sql
-- Same question for the entity surfaces covered by D5.
select m.subject_type, m.subject_id, m.episode_event_id, count(*) as rows_in_group
from mentions m
where m.subject_type <> 'person'
  and m.status = 'published'
group by 1, 2, 3
having count(*) > 1
order by rows_in_group desc
limit 20;
```

If the top group is 3 or smaller across the whole table, say so and stop: the report would then be describing crowding rather than repetition, and the right fix is spacing, not grouping. Otherwise proceed.

Also open the replay (`S-45` at 39s) once to confirm what Sean's timeline actually looked like: how many rows, and whether they are one episode or several.

---

## 4. Files to touch

| File | Change |
|---|---|
| `src/lib/mentions.ts` | Add a pure `groupMentionsByEpisode<T>(rows)` beside `groupMentionsByMoment`. Same shape of contract: preserve input order, never re-sort, return `{ key, items }` plus the shared episode object off `items[0]`. Rows with no `episode_event_id` are each their own group (the `solo:` pattern already used at line 71). |
| `src/components/feed/mention-episode-group.tsx` | New. The group card: header (count + episode label + date + episode link), collapsed preview of the first 3, "Show all N", "Expand all" / "Collapse all", and the rows themselves. Delegates each row to `MentionRow`, it does not re-implement one. |
| `src/components/feed/mention-row.tsx` | Add an optional `nested?: boolean` (default false). When true the row drops its own episode-leading header (the group already said it) and its outer card chrome, so nested rows read as lines inside one card rather than cards inside a card. Nothing else about the row changes; `context="episode"` and un-nested `context="timeline"` render byte-identically to today. |
| `src/components/feed/feed-view.tsx` | Change the mention `FeedItem` variant from `{ mention: Mention }` to `{ mentions: Mention[] }` (or add a parallel `mention_group` kind, builder's call). Build it by grouping first, then mapping groups to items: sortDate from `items[0].episode?.start_date`, unchanged. Update the three switch sites: the `key` expression (line 391), `nodeColor` (line 77) and `predicateRank` (line 92) so a group is still fuchsia and still ranks 7, and the render branch (line 415) to emit `MentionEpisodeGroup` for a group of 2+ and a plain `MentionRow` for a group of 1. |
| `src/components/feed/entity-mentions.tsx` | Same swap at lines 60-66, keeping its existing newest-episode-first sort (lines 44-50) before grouping so groups come out in the same order they do now. |

Do not touch: `src/app/api/mentions/**`, `src/lib/mentions-server.ts`, `src/lib/public-timeline-read.ts`, anything under `src/components/public-timeline/`, `src/components/events/episode-page.tsx`, or the `Mention` type.

---

## 5. Suggested order

1. Run the pre-flight SQL and open the replay. Confirm the premise.
2. `groupMentionsByEpisode` in `src/lib/mentions.ts`, written pure and order-preserving. This is the only piece with real logic, so get it right first.
3. `nested` prop on `MentionRow`, verifying on the episode page that the un-nested render is unchanged.
4. `MentionEpisodeGroup`, built and eyeballed in isolation against the worst-case group from the pre-flight.
5. Wire `feed-view.tsx`. Check the decade count and the Mentions chip count in the same pass (section 6).
6. Wire `entity-mentions.tsx`.
7. `npx tsc --noEmit`, then walk the acceptance list.

---

## 6. The one count that moves, and what to do about it

After grouping, the decade header at `feed-view.tsx:382` reads `{grouped[decade].length} entries`, which now counts groups. A decade holding six mentions from one episode will say one fewer... six fewer, in that example.

Recommended: leave the arithmetic alone and let it count what is actually on screen, because the header labels visible rows and a group IS one row. Do **not** try to inflate it back by counting nested mentions; that reintroduces exactly the mismatch BUG-104 was filed about (a count that disagrees with what the reader can see).

Verify explicitly that `filterCounts.all` and `filterCounts.mentions` are untouched (fact 9), because those two are the ones wired to the celebration and the chip.

---

## 7. Acceptance criteria (BUG-172)

1. A person with 2 or more published mentions from one episode sees **one** card for that episode on their timeline, with **one** fuchsia node, at the episode's date.
2. The card header states the count and the episode ("Mentioned 6 times on FNRad #142") and links to the episode page.
3. Collapsed, the card previews the first 3 mentions by name (story title, else a clamped excerpt) with a "Show all N" control; expanded, every mention is listed.
4. Each listed mention keeps its own "Read the line" expand, showing the same excerpt blockquote and the same watch/episode links it shows today.
5. An "Expand all" control opens every line in the card at once, and flips to "Collapse all".
6. A person with exactly one mention from an episode sees the current `MentionRow` unchanged: no group chrome, no count, no extra control.
7. Mentions from **different** episodes are never merged, even when their episode dates are identical.
8. The Mentions filter chip count still equals the raw number of mentions, and the chip still hides for a rider with none.
9. The "Entry #N" celebration and `filterCounts.all` are numerically unchanged (mentions were never in that count and still are not).
10. Place, brand, board and event pages show the same grouping through `EntityMentions`, with their existing newest-episode-first ordering preserved.
11. The episode page (`episode-page.tsx`) and the chromeless `/t/[slug]` episode view render exactly as before; the moment-grouping path is untouched.
12. `npx tsc --noEmit` clean. No em dashes in any shipped string.

---

## 8. Wrap

- Name **BUG-172** in the PR title or commit subject. The daily triage reconcile reads that id off `git log main` and will not close the bug without it.
- Append a `bugs/SHIP-LOG.md` entry using the schema at the top of that file: `type: bug`, `ids: BUG-172`, `migration: none`, and `status: merged` once the PR is merged in-session per the Ship sequence.
- No migration this session. State that explicitly in the wrap so the record is unambiguous.
- Do not edit the **Shipped** section of `bugs/bug-triage.md`; the next triage run reconciles it.
