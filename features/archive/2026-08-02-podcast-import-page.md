# Podcast mention import page: paste a seed, review it, import it

> **Build-ready Claude Code handoff. Drafted August 1, 2026.**
> Source: the August 1 podcast session (PR #170 to #181) plus Jay's test of
> Claude Code on the web, which settled the design. The transcript-to-mentions
> workflow is live and ep 21 is imported; this makes the back half of it usable
> from any computer.
>
> **Size: ~4 to 6 hr. NO migration.** Everything it touches already exists.
> Mostly a port of proven logic from `scripts/import-mentions.mjs` into an
> editor-gated route plus one admin page.
>
> Pre-flight: facts in section 3 were verified against the live repo and prod on
> August 1 and carry file:line provenance. Re-verify anything tagged
> "verify at build time".

---

## 0. What this delivers

Today the workflow runs only on Jay's Mac, because resolving a seed against the
catalog and importing it both need `SUPABASE_SERVICE_ROLE_KEY` from
`.env.local`. After this, the AI half runs anywhere and the data half runs in
the browser under a normal editor login.

**Today**

1. Claude Code on the Mac, in the repo, with `.env.local`
2. transcript in, seed file out
3. `--resolve-only` against prod
4. build the review page, review it, copy the trim list
5. paste the trim list back, Claude edits the seed
6. `--apply`
7. publish on the episode page

**After**

1. Claude anywhere (claude.ai, Claude Code web, phone) writes an **unresolved**
   seed. No database, no keys.
2. Paste it into `/admin/podcast/import`. The page resolves against the catalog
   and shows the review surface: stories with casts, trim checkboxes, near-miss
   decisions, the list of new nodes it would create.
3. Import. Then publish, with the buttons that already exist.

The service-role key never leaves the server. Jay's test of Claude Code on the
web failed exactly here, and the right answer was not to put a prod service-role
key into an ephemeral container (fact 8).

---

## 1. DECISIONS (review before building)

Defaults are shippable as-is; Jay can override in review.

- **D1. Editor-gated, no new role.** `/admin/*` is already gated server-side by
  `requireEditorPage()` (fact 1), and mutating routes enforce `requireEditor()`
  independently. Reuse both. Sharing the tool with a non-editor is out of scope
  until it is a real need; Jay is the only user for now.
- **D2. Paste JSON, no file upload.** The seed is a few KB of JSON that Claude
  hands over in chat. A textarea is the whole input. An upload control is more
  surface for no gain.
- **D3. Resolution happens server-side on paste, not on import.** The page POSTs
  the seed to a **dry-run** endpoint that returns the resolved plan without
  writing. That is what makes the review honest: you see the real matched ids,
  the real near misses, and the real count of nodes that would be created,
  before anything happens.
- **D4. `src/lib/mention-import.ts` becomes the single implementation.** Port
  the resolver, near-miss probe, ghost planner and dedupe out of the `.mjs`
  script into TypeScript that the route imports. The script stays for local use
  but its logic is now a **mirror**, carrying the same "change both files" note
  the timestamp rule already carries (fact 3). Retiring the script once the page
  is proven is a follow-up, not this session.
- **D5. Import lands drafts, exactly as today.** No behaviour change: publishing
  stays the separate editorial act, and PR #178 already put Publish and Publish
  all on the episode page. The import page links to the episode when it finishes.
- **D6. Trim in the browser, not by round trip.** Checkboxes on the page set
  `resolution: "skip"` in the payload that gets imported. No copy-list-and-paste-back.
- **D7. Near misses block import until decided.** Same rule the script enforces
  (fact 4): a `review` row is refused until someone picks a `subject_id` or ticks
  "create it anyway" (`confirm_new`). This is the guard that stopped five
  duplicate places on the first real import; do not soften it into a warning.
- **D8. No AI in the app.** The extraction stays with Claude on Jay's Max plan.
  There is no Anthropic dependency in this codebase today (verified: no
  `anthropic` or `openai` in `package.json` or `src/`), and this brief does not
  add one.

---

## 2. Why now

- The workflow is proven end to end. Ep 21 is imported: 53 draft mentions across
  18 stories, 18 new catalog nodes, verified in prod.
- Jay tested Claude Code on the web and it failed at exactly the credential
  boundary (fact 8). That is the boundary this page removes.
- FNRad Season 12 is the last season and the archive goal is the whole back
  catalogue. Per-episode friction compounds.
- The importer logic is battle-tested now, including the near-miss fix that came
  out of a real defect. Porting proven code is much cheaper than designing it.

---

## 3. Verified facts (August 1, live repo and prod)

1. `/admin/*` is gated server-side by `src/app/admin/layout.tsx`, which awaits
   `requireEditorPage()` before any admin HTML reaches the browser, with
   `export const dynamic = "force-dynamic"`. Individual API routes still enforce
   their own `requireEditor` / `requireModerator`.
2. Admin page convention: `page.tsx` is a server component that resolves auth
   and redirects (401 to `/onboarding`, 403 to `/admin`), and a sibling
   `*-client.tsx` client component holds all state and interaction. See
   `src/app/admin/tag-queue/page.tsx`. The admin index links each tool by
   `href="/admin/..."` around `src/app/admin/page.tsx:1854-1897`; add the new one
   there.
3. `scripts/import-mentions.mjs` is 753 lines. The functions to port are
   `expandStories` (L160), `resolveEpisode` (L197), `normalizeName` (L270),
   `significantTokens` (L281), `isNearMiss` (L295), `loadIndex` (L311),
   `rememberCreated` (L351), `findCandidates` (L362), `planGhost` (L393),
   `linkCommunity` (L509) and the `dedupeKey` rule (L552). `parseTimestampInput`
   (L102) and `formatTimestamp` (L116) are already mirrors of `src/lib/mentions.ts`
   and should import from it instead once the logic lives in TS.
4. Near-miss handling (PR #177): exact match is pass one; when nothing matches,
   token containment after normalizing `Mt.`/`St.` and dropping generic words
   (`ski`, `area`, `resort`, `mountain`, `park`) flags the row `review` with
   candidates and refuses it. `confirm_new: true` on the subject overrides.
5. Ghost creation must set `node_status: "unclaimed"` and
   `community_status: "unverified"` EXPLICITLY; the `people.node_status` default
   is `catalog`, which misfiles a ghost. `boards.model_year` and
   `events.start_date` are NOT NULL with no default, so a board or event ghost is
   refused unless the seed carries them.
6. **Do NOT reuse `POST /api/catalog/entity` for ghost creation.** It awards
   contribution tokens (`src/app/api/catalog/entity/route.ts:217`), which would
   pay Jay tokens for every entity an import creates. The script's direct DML
   after `requireEditor()` is the correct pattern (CLAUDE.md gotcha 6:
   `requireAuth`/`requireEditor` first, then `getServiceClient()`).
7. `PATCH /api/admin/mentions { ids, status }` exists (PR #178) for bulk publish,
   and the episode page has per-story Publish and Publish all. The import page
   does not need its own publish UI; link to the episode instead.
8. Claude Code on the web cannot run the current script: a fresh container has
   empty `node_modules` (fixed by `npm install`) and no `.env.local`, which is
   correctly gitignored. Resolution needs a live catalog connection, so even the
   default dry run fails there. Exporting a prod service-role key into that
   container was declined, correctly: it bypasses RLS on every table including
   `profiles` and `memberships`.
9. The seed format is documented in `podcast-seeds/README.md`, with
   `EXAMPLE.json` as the committed reference. `stories[]` is current; the flat
   `mentions[]` array still imports.

---

## 4. Migration

**None.** `mentions` and `mentions.story_title` both exist. Ghost creation reuses
`people` / `places` / `orgs` / `boards` / `events` and their community junctions.
If a build-time gap appears, stop and flag rather than adding a migration
silently.

---

## 5. Endpoints and where they hang in the UI

| Endpoint | UI trigger | Affordance |
|---|---|---|
| `POST /api/admin/mentions/import` with `{ seed, dryRun: true }` | paste JSON, click Resolve | renders the review surface: stories, casts, near misses, new-node count |
| `POST /api/admin/mentions/import` with `{ seed }` | click Import | creates ghosts, inserts draft mentions, returns counts |
| existing `PATCH /api/admin/mentions` | Publish, on the episode page | already built, PR #178 |

One route, two modes, so the plan you review is produced by the same code that
executes it. A separate preview endpoint would be free to drift.

Both modes are `requireEditor()`-gated and use `getServiceClient()` afterwards.

**Response shape (dry run and apply share it):**

```
{
  episode: { id, name, episode_number },
  stories: [{ timestamp, title, excerpt, subjects: [
    { subject_name, subject_type, resolution, subject_id, candidates?, ghostPlan? }
  ]}],
  counts: { stories, mentions, ghosts, matched, review, refused, skipped },
  refusals: [{ where, why }]
}
```

---

## 6. The page

`/admin/podcast/import`, following the fact-2 convention (`page.tsx` server
component + `import-client.tsx`).

**Step 1, paste.** A textarea, a Resolve button, and a line of help pointing at
`podcast-seeds/README.md` for the format. Invalid JSON fails inline with the
parse error, not a toast.

**Step 2, review.** The same information architecture as the generated review
page, which Jay has used through several rounds and likes:

- one card per story, in episode order, with its cast as tier-coloured chips
  (riders violet, places teal, events amber, brands cyan)
- a timecode per story linking to the media at that second, so a story can be
  checked against the audio
- chip states: plain = matched, dashed = would be created, double-outline =
  needs a decision
- a checkbox per story to trim it
- a sticky summary bar: N stories, N mentions, N new nodes, N need a decision
- near-miss rows expand to their candidates: pick one, or tick "create it anyway"

**Step 3, import.** Disabled while any row needs a decision, with the reason
shown rather than a dead button (playbook check 16). On success, the counts and
a link to the episode page to publish.

Reuse `.claude/skills/podcast-mentions/scripts/build-review.mjs` as the design
reference; it is the markup Jay already reviewed against.

---

## 7. Out of scope (hard list)

- Any AI in the app. Extraction stays with Claude on Jay's Max plan (D8).
- Transcript fetching or upload.
- A publish UI on this page; the episode page has it (fact 7).
- Sharing with non-editors, a curator role, or invites.
- Retiring `scripts/import-mentions.mjs`. It stays; retirement is a follow-up.
- Storing seeds in the database. Paste is the input. A saved-drafts table is the
  obvious next step if Jay wants to leave a review half-finished, but it is not
  needed to make the workflow portable, which is the point of this session.

---

## 8. Acceptance criteria

A1. Pasting the ep-21 seed and clicking Resolve renders 18 stories with their
    casts, and reports 0 new nodes and 0 needing a decision, because every
    subject now resolves to an existing entity.
A2. Pasting a seed whose place is written "Mount Baker" flags it as needing a
    decision, offering `p26 Mt. Baker Ski Area`, and Import stays disabled with
    the reason shown.
A3. Picking the candidate on that row enables Import; ticking "create it anyway"
    also enables it, and then creates a new node.
A4. Import creates ghosts with `node_status='unclaimed'` (NOT `catalog`) and
    `community_status='unverified'`, with community junction rows.
A5. Every imported mention lands `status='draft'`. Anonymous reads return `[]`
    for the episode and for each subject, and the public `/t/` page shows nothing.
A6. Re-importing the same seed creates nothing and reports everything skipped.
A7. A board subject with no `brand`/`model`/`model_year`, and an event subject
    with no `start_date`, are both refused with a message naming the missing
    field. Nothing partial is written.
A8. A non-editor visiting `/admin/podcast/import` is redirected, and an unauthed
    `POST` to the route returns 401.
A9. Trimming a story on the page excludes its whole cast from the import.
A10. Malformed JSON reports the parse error inline and writes nothing.

---

## 9. Suggested order

1. Pre-flight reads (section 10).
2. `src/lib/mention-import.ts`: port resolution, near-miss, ghost planning,
   dedupe from the script. Pure functions plus a service-client executor.
3. `POST /api/admin/mentions/import`, dry-run mode first. Test with curl against
   the ep-21 seed before any UI exists.
4. Apply mode, with skip-existing.
5. The page: paste, then review, then import.
6. Acceptance A1 to A10, then the Ship sequence (no migration; SHIP-LOG
   `type: feature`, `scope: podcast-import-page`).

---

## 10. Builder pre-flight

- Read `scripts/import-mentions.mjs` end to end. It is the specification; the
  route should behave identically, including the near-miss refusal and the
  in-run `rememberCreated` step that stops one import creating the same ghost
  twice.
- Read `podcast-seeds/README.md` for the seed contract and
  `.claude/skills/podcast-mentions/scripts/build-review.mjs` for the review
  markup.
- Read `src/app/admin/tag-queue/page.tsx` and its client for the admin page
  convention, and `src/app/api/admin/mentions/route.ts` for the editor-gate plus
  service-client pattern.
- Confirm `getServiceClient()` is never reachable from a client component;
  `src/lib/mentions.ts` had exactly this bug in Session B, where importing the
  service client into a client component dragged `next/headers` into the browser
  bundle. Keep the pure helpers separate from the executor.
- A real ep-21 seed exists locally at `podcast-seeds/fnrad-ep21.json` (gitignored)
  and is the best fixture. Re-importing it should be a clean no-op, which is
  also A6.
