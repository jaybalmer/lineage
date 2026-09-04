# Bug-fix brief: person page browser-tab title falls back to "Rider profile"

Date drafted: 2026-08-03 (daily triage)
Scope: **BUG-156** (P2, reproducible, root-caused, client-only, PIPELINE-SAFE on defaults)
Goal: the browser tab for a rider page reads the person's name (for example "Jay Balmer · Linestry"), not the generic "Rider profile · Linestry", no matter whether the page was reached by slug or by UUID.

## DECISIONS (review before building)

1. **Where to set the real name.** Recommended default: set `document.title` on the client page (`src/app/people/[id]/page.tsx`) once the person resolves, from `person.display_name`. This fixes every entry path (slug or UUID) with no server DB fetch, matching the existing `entity-metadata.ts` design note that deliberately avoids an RLS/data dependency in the server layout. Alternative: resolve the name server-side in `src/app/people/[id]/layout.tsx` via a Supabase fetch keyed on the id. Rejected as default because it reintroduces the exact server data dependency the current design avoids, and still needs a slug-to-id lookup.
2. **Restore on unmount.** Recommended default: leave the title as-is on unmount (Next sets a fresh title on the next route's metadata anyway). No cleanup needed. Alternative: capture and restore the prior title in the effect cleanup (harmless but unnecessary).

## Root cause (verified in code)

`src/app/people/[id]/layout.tsx` exports `generateMetadata` which calls `buildDetailMetadata({ type: "person", param: id, path: ... })` in `src/lib/entity-metadata.ts`. That helper derives the tab title by humanizing the **raw route param**:

- `humanizeSlug("jay_balmer")` returns "Jay Balmer" (correct), but
- `humanizeSlug(<uuid>)` and `humanizeSlug(<generated-id>)` return `null` (guarded by `UUID_RE` / `GENERATED_ID_RE`), so the title falls back to `TYPE_FALLBACK.person = "Rider profile"` (`entity-metadata.ts:29`).

So any person page reached by a **UUID or generated-id URL** renders "Rider profile · Linestry". The client page then runs `useCanonicalPath(...)` (`page.tsx:107`) which `history.replaceState`s the address bar to the slug, but that does NOT re-run the server `generateMetadata`, so the tab title stays on the fallback. Jay's report ("tab read 'Rider profile - Linestry' on `/people/jay_balmer`") is this: he reached the page by a non-slug link, the URL was canonicalized to the slug, but the title kept the fallback.

The report's "-" separator is a paraphrase; the actual separator is "·".

## Suspected files

- `src/app/people/[id]/page.tsx` -- client page; already resolves `resolvedPerson` / `person` with `display_name` (see `page.tsx:93` and `page.tsx:217`), and already runs client effects (`useCanonicalPath`). Add the `document.title` effect here, after the person resolves and above any early `return`/`notFound()` is not required (an effect is fine below hooks, but keep it with the other top-level hooks to avoid the conditional-hook trap noted in the codebase CLAUDE.md gotcha #2).
- `src/lib/entity-metadata.ts` -- unchanged; the server fallback is still the correct crawler/OG default when JS is off. Do NOT remove the fallback.

## Implementation order (recommended default)

1. In `src/app/people/[id]/page.tsx`, add a `useEffect` keyed on `person?.display_name` that, when a real person is resolved, sets `document.title = \`${person.display_name} · Linestry\``. Guard on a resolved person so an unresolved/`notFound` state does not blank the title. Keep the effect with the other top-level hooks (before the `if (!resolvedPerson) notFound()` guard at `page.tsx:213`) so the hook order is stable.
2. Leave `generateMetadata` and `entity-metadata.ts` as-is (they remain the no-JS / crawler fallback).
3. `npx tsc --noEmit` clean.

## Acceptance criteria (BUG-156)

- Visiting `/people/<uuid>` (a raw-id link) shows a browser tab title of "<Display Name> · Linestry" once the page resolves, not "Rider profile · Linestry".
- Visiting `/people/<slug>` still shows "<Display Name> · Linestry".
- The server-rendered fallback ("Rider profile · Linestry" for an unresolvable/UUID param with JS disabled) is unchanged, so crawler/OG behavior is not regressed.
- No change to the canonical URL rewrite behavior.

## DB / migration

No migration. No `_public` view touched. Client-only.

## Ship reminders

- Name **BUG-156** in the PR title.
- Append a `status: pending` SHIP-LOG entry (`type: bug`, `ids: BUG-156`, `migration: none`).
- No em dashes anywhere.
