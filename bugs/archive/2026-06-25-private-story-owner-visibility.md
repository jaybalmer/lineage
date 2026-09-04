# Bug-fix brief: private ("Only Me") story vanishes from the author's own timeline

Date: 2026-06-25
Lead: yes (P1, top item for Jay)
BUG ids in scope: BUG-106
Run type: HUMAN-RUN (visibility / read-path correctness; not auto-merge)
Estimated: ~30-60 min (verified root cause, single-file fix likely)

## Goal
A private ("Only Me") story that the author added to their own timeline must stay visible to that author after they navigate away and return (or refresh). It currently appears optimistically, then disappears on the next fetch. To the author it reads like the story was lost.

## No open decisions
The fix is a read-path correctness fix; the only judgment is whether to scope the owner-private read to the `author_id === viewer` case (recommended) rather than loosening the list fetch globally.

## Verified root cause (do confirm, then fix)
`GET /api/stories` has two read branches in `src/app/api/stories/route.ts` (verified on current main):

- Single-story fetch (`if (storyId)`, lines ~75-78): mirrors the stories RLS rule, `query.or('visibility.eq.public,author_id.eq.${viewerId}')` when a viewer is present, so the author can read their own private story by id.
- List fetch (`else`, lines ~80-81): hardcoded `query.eq("visibility", "public")` with the in-code comment "The list fetch stays public-only." Then `if (authorId) query = query.eq("author_id", authorId)` (line ~84).

The owner timeline on `/people/[id]` loads authored stories through the LIST fetch (filtered by `author_id`), which is public-only, so a `visibility='private'` (Only Me) story the author just added is filtered out on the refetch. The optimistic session-state copy is what the reporter saw "temporarily"; the refetch drops it. `stories` has no `_public` view, so this is a query-filter issue, not a view rebuild.

## Suspected files
- `src/app/api/stories/route.ts` (the GET list branch, ~lines 80-84). Confirm how `viewerId` is resolved in GET (it is already used by the single-story branch).
- The caller: the owner timeline / profile story loader on `/people/[id]` (FeedView is fed `stories`; trace which fetch populates the owner's authored stories, e.g. `?author_id=<id>`). Confirm it passes / can pass the authenticated session so `viewerId` is available server-side.

## Recommended fix
In the LIST branch, when the requested `author_id` equals the authenticated `viewerId`, include that author's own non-public stories instead of forcing public-only. For example, when `authorId && authorId === viewerId`, apply `query.or('visibility.eq.public,author_id.eq.${viewerId}')` (or simply skip the public-only `.eq` for the self-author case), leaving the default list path public-only for everyone else. Do NOT broadly drop the public-only default for non-owner list reads (that would leak private stories).

## Acceptance criteria (BUG-106)
- An author adds a story with VISIBILITY "Only Me" + "Add to my timeline"; after navigating away and back (and on a hard refresh), the story still renders on the author's own `/people/[id]` timeline.
- The same private story does NOT appear for any other viewer (logged-out or a different member) on that timeline, the feed, or any linked entity page.
- Public and on_timeline filtering behaviour for everyone else is unchanged.
- `npx tsc --noEmit` clean.
- No migration (state this explicitly in the PR; `stories` has no `_public` view). If the diagnosis instead surfaces an RLS gap on the `stories` table, treat any policy change as HUMAN-RUN and surface the SQL in the Ship sequence.

## Pre-flight
- Confirm the GET `viewerId` resolution path (how the route reads the session) so the self-author branch actually has the viewer id.
- Reproduce against prod/local: add an Only Me story to your own timeline, refresh, confirm it drops before the fix.

## Ship
- One PR, branch `bugfix/bug-106-private-story-owner-visibility`. Name BUG-106 in the PR title / commit so the next reconcile closes it.
- Append a `status: pending` SHIP-LOG entry (`type: bug`, `ids: BUG-106`, `migration: none`), flipped to merged in-session per the Ship sequence.
