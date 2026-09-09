# FNRad Listener Landing

> Cowork-authored feature brief, September 4 2026, REVISED the evening of September 4
> 2026 and again on September 6 2026. Self-contained. ~4 to 6 hr, ONE PR, NO migration.
> Nothing here is gated: no schema, no `profiles` SQL, no payment path, no auth path, no
> data-deletion path.
> Migrate-first does not apply, so the ship sequence is tsc, PR, merge.
>
> **What the evening revision changed.** The FNRad deal is announced and episode 1 drops
> in one to two weeks. Its community challenge asks listeners to ADD A STORY ABOUT THAT
> EPISODE'S GUEST. The morning draft scoped the challenge as the episode's first curated
> `public_stack_entries` row plus the anonymous `POST /api/public/tag` mark. That does not
> survive contact with a guest-story ask: `TAGGABLE` excludes riders outright
> (F41), the tag route accepts only place, event and story moments (F14), and writing a
> story is authenticated only (F40). So D5, D6 and D7, their task specs, their acceptance
> criteria and their Appendix A copy were replaced with a guest-derived, authenticated
> challenge. The estimate moved from 3 to 5 hours up to 4 to 6: the guest read is cheaper
> than the curated-stack read it replaces, but the public-episode-view guest links (T8)
> and the in-app CTA rewiring (T9) are new work that did not exist in the morning draft.
> Section 10 risk 12 records why the curated-stack approach was superseded.
> Everything else in this brief stands: the `/fnrad` route choice, the hub, the episode
> list, the listener strip, the equity block, the attribution dependency, the voice.
>
> **What the September 6 revision changed.** Four things, and all of them narrow rather
> than widen. First, **D5 inverted.** The weekly challenge now keys off a PERSON named in
> a config constant, `FNRAD_CHALLENGE` in `src/lib/fnrad.ts`, and the episode link is
> OPTIONAL and addable later. Jay: "The episode page will be created separately, so we
> need the option to add the episode link later." Both earlier drafts derived the
> spotlight from the episode, the morning one from its curated stack and the evening one
> from its `event_guests` row, which made the card depend on an episode record existing.
> It no longer does. T1, T5, T6 step 5, the acceptance criteria A8a to A8c and the section
> 7 pairings were rewritten to match; T8 and T9 were NOT, because the episode page's own
> guest header still reads `event_guests` and that is still right. Second, **T7a was
> added**: the sparse-person empty state at `src/app/people/[id]/page.tsx:666-692` (F54)
> hides its actions from signed-out visitors, which is exactly the state episode 1 lands
> on while Ingemar's page is still empty. Third, **PRE-FLIGHT 3 was added**, from a read
> of the committed catalog export: the catalog already carries two Ingemar rows and one
> board whose model name is misspelled "Ingmar". Fourth, **Appendix A's hero, lead,
> challenge-ask and challenge-body were replaced with Jay's own copy.**
>
> **The estimate stays at 4 to 6 hours, re-checked deliberately rather than carried
> over.** T7a is genuinely new work, but it is one gate removed and one copy block
> rewritten inside a single file, and it routes through a helper the PR was building
> anyway (`addStoryAboutHref`, T1). Call it twenty minutes. The D5 inversion pays for it
> and then some: the hub loses a whole `readEventStack` round trip (T6 step 5) and the
> card loses its guest-picking helper, so the net is flat to slightly cheaper. 4 to 6
> holds.
>
> **Read section 0 first.** The revision added a third blocking pre-flight check, so there
> are now three. They are Jay's to run and no amount of building can substitute for them.
>
> Playbook subset run: checks 2, 6, 7, 10, 11, 12, 18, 20, 21, 22. Checks 1, 3, 4, 5,
> 8, 9, 13, 14, 15, 16, 17, 19, 23, 24 are not applicable (no migration, no schema, no
> backfill, no Postgres view, no new state model, no owner/editor moderation
> terminology, no plpgsql function, no `_public` view column, no cross-user write).
> This brief was drafted from the repo on disk with no live database session, so every
> statement about DATA (which show rows exist, which episodes are published, how many
> mentions are live) is tagged AUDIT in section 5 and must be checked in the Supabase
> dashboard before the acceptance pass. The same is true of everything about the episode-1
> guest: their id and their tag-approval setting are both unknown from the repo, which is
> what section 0 is for. Whether an `event_guests` row exists for them is also unknown, but
> after the September 6 revision that is no longer blocking: it gates T8's guest chips, not
> the challenge (AUDIT-3).

---

## 0. PRE-FLIGHT: three checks that BLOCK episode 1

**Read this before anything else. Owner: Jay. Run all three the moment the episode-1
guest is known, and again before the episode goes out.** None of them is a code task and
none of them is part of the PR. All three are here because each one silently breaks the
challenge: nothing errors on a page anyone looks at, listeners do the thing they were
asked to do, and their work does not appear. A quiet failure on episode 1 of an announced
sponsorship costs more than the whole build.

### PRE-FLIGHT 1. Does the guest have `require_tag_approval` switched on?

**Why it breaks things.** Tag visibility is permissive by default. PB-009 added
`profiles.require_tag_approval` as `boolean NOT NULL DEFAULT false` (F45), and BUG-060's
`tag_event_publicly_visible` treats a pending tag as visible when the subject's flag is
false, hidden when it is true (F46). `story_riders_public` filters through that same
helper (F46), and the guest's own page reads tagged-in stories through
`/api/stories?rider_id=...`, which reads the approved-only view (F47). So with the flag
OFF, a listener's story appears on the guest's page the moment it is published, with no
approval step and no waiting. With the flag ON, every single listener submission goes
invisible, pending the guest approving them one at a time at `/me/tags`.

The flag is a user setting at `src/app/me/settings/tag-privacy/page.tsx` (F48), and a
podcast guest is precisely the person likely to have turned it on: they are the most
tagged person in the graph and the most likely to have gone looking for a control.

**The check.** Substitute the episode-1 guest's id.

```sql
-- Does the episode-1 guest gate incoming tags?
select p.id,
       p.display_name,
       p.require_tag_approval
from public.profiles p
where p.id::text = '<GUEST_PERSON_ID>';
```

That is the PRIMARY form and it is the one that has to be run. The id it takes is the
same id that goes into `FNRAD_CHALLENGE.guestId` (D5, T1), which is the only thing the
challenge requires. No episode record has to exist for this check to be meaningful.

The episode-join below is an OPTIONAL convenience for reading a guest id off an episode
that already exists. It returns nothing at all when the S12 E01 event has not been created
yet, which on September 6 is the expected state. An empty result from it is not a failed
check and it is not a blocker.

```sql
select eg.position, eg.person_id,
       pr.display_name,
       pr.require_tag_approval
from public.event_guests eg
left join public.profiles pr on pr.id::text = eg.person_id
where eg.event_id = '<EPISODE_EVENT_ID>'
order by eg.position;
```

**Pass:** `require_tag_approval` is false, or the row is absent entirely (a ghost guest
with no `profiles` row COALESCEs to false, which is permissive, F46).

**Fail:** `require_tag_approval` is true. Then either ask the guest to turn it off at
`/me/settings/tag-privacy` for the duration of the episode, or tell them plainly that
submissions will land in their `/me/tags` inbox and they need to work through it. Do not
flip another person's privacy setting for them. What you must NOT do is leave it on and
say nothing, because the listeners will never know their stories are invisible.

### PRE-FLIGHT 2. Is the guest's id UUID-shaped?

**Why it breaks things.** `story_riders.rider_id` is `uuid NOT NULL` (F49). The FK to
`profiles` was deliberately dropped so unclaimed ghosts can be tagged, with the comment
stating that integrity moved to the application layer (F50). On the write path it did not
move anywhere: `POST /api/stories` maps `rider_ids` straight into the insert with no
shape check, and a bad id throws out of the junction insert into the catch-all, which
returns 500 (F51). Meanwhile `event_guests.person_id` is `text`, not uuid, and the
migration that created it states outright that roughly 29 `people.id` values are still
non-uuid (F35).

So a non-uuid guest fails in three separate places: `POST /api/stories` 500s for every
listener who tries, `POST /api/stories/[id]/connections` returns 400 "Unknown rider" for
the after-the-fact tag path (F52), and even if a row somehow existed, the guest's own page
never fetches tagged-in stories at all, because that read is gated on a uuid test (F47).

**The check.** Substitute the same id that is going into `FNRAD_CHALLENGE.guestId` (D5,
T1). This is the PRIMARY form, it needs no episode record, and it is the one to run:

```sql
-- Is the episode-1 guest taggable as a story rider?
select p.id,
       p.display_name,
       (p.id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         as is_uuid
from public.profiles p
where p.id::text = '<GUEST_PERSON_ID>';
```

If no `profiles` row comes back, the guest is a `people` ghost rather than a claimed user,
which is fine and expected. Test the id shape on its own:

```sql
select '<GUEST_PERSON_ID>' as person_id,
       ('<GUEST_PERSON_ID>' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         as is_uuid;
```

OPTIONAL convenience, for when the episode record exists and you want to read the ids off
it rather than type one. It returns nothing when there is no episode yet, which is not a
failure:

```sql
select eg.event_id,
       eg.position,
       eg.person_id,
       (eg.person_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         as is_uuid
from public.event_guests eg
where eg.event_id = '<EPISODE_EVENT_ID>'
order by eg.position;
```

To sweep every guest across every episode at once, which is worth doing once:

```sql
select eg.event_id, e.name, eg.person_id
from public.event_guests eg
join public.events e on e.id = eg.event_id
where eg.person_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
order by e.episode_number desc nulls last;
```

**Pass:** `is_uuid` is true for the episode-1 guest.

**Fail:** `is_uuid` is false. This is a data fix, not a code fix, and it must happen
before the episode drops. The repair the product already has is `merge_person`, which
resolves an approved claim request by merging the text-id ghost into the claimant's
uuid-keyed canonical row, repointing every junction on the way (F53). In practice that
means the cleanest fix is the one you want anyway: get the guest to CLAIM their page from
`/people/{id}` ("This is me", F34), approve the claim, and their id becomes uuid-keyed.
After the merge, re-run this query. **The AUDIT that stood on this line is RESOLVED as of
September 6 2026, and the answer is yes:** PR #229's `merge_person_into` dedupes
`event_guests` on its composite primary key and then repoints `person_id` from the ghost
to the canonical row (`supabase/migrations/20260906000001_merge_person_into.sql:242-253`),
and PR #230 folds ghost promotions through the same function. So a merge no longer leaves
an `event_guests` row pointing at a dead id. Re-run the query anyway: verifying one row
costs ten seconds and this is the check that gates an announced episode.

Do NOT paper over a non-uuid guest by hiding the call to action for them in code: that
ships a page whose main ask silently disappears on some episodes and nobody notices which.
If the repair cannot be made in time, the honest fallback is to point
`FNRAD_CHALLENGE.guestId` at a different person for that week, which is a one-line config
edit and a deploy (D5). There is NO fallback that points the challenge at the episode
itself. Revised D5 has exactly one spotlight type and it is a person; `guestId` null means
no card at all, on any surface, rather than a card about an episode.

### PRE-FLIGHT 3. The catalog already knows Ingemar, and it spells his name wrong.

**Added September 6 2026, from a read of the committed catalog export. This is good news
with one sharp edge.**

Three rows relevant to episode 1 are already live, which means the challenge has real
things to point at on day one rather than an empty page:

- **Atlantis**, brand, `atlantis`, status `defunct`, with "Ingemar Backman" recorded as its
  notable rider and a note reading "Rider-owned, sidewall construction."
  (`data/catalog/v0.3/brands.csv`).
- **Allian**, brand, `allian`, founded 1999, status `active`, noted as "Associated with
  Ingemar Backman" (same file). Note the open country disagreement recorded there: Send It
  DB says USA, the reviewer says Sweden. Sweden is almost certainly right, but it is
  flagged as needing confirmation and this episode is the moment someone will notice.
- **Atlantis Ingmar Backman, 1997**, board id `9dca31d3-fca2-4244-aa79-1b9609a4b645`,
  confidence `verified`, sourced to RetroSnow
  (`data/catalog/existing-boards-export.csv`).

**Swept September 6 2026: this is the ONLY misspelling in the catalog worth fixing.**
"Craig Kelley" appears in v0.3 research but only inside a quoted museum source string; the
structured rider field says "Craig Kelly" and all three live Craig Kelly boards are spelled
correctly. "Terje Haakonsen" is the standard anglicisation of Hakonsen and is what Burton
themselves print. Neither is a defect.

**The one real edge: that board row spells him "Ingmar", not "Ingemar".** The RetroSnow source URL
carries the same misspelling, so it came in with the data rather than being introduced
here. The correct spelling is Ingemar. Left alone, a listener who searches "Ingemar" does
not find his own pro model, the challenge's most obvious hook, and the guest sees his name
misspelled on the page the podcast just sent people to.

**What to do, before the episode and outside this PR.** Correct the board's model name to
"Ingemar Backman", keeping the RetroSnow source URL as it stands since that is the source's
own spelling and not ours to rewrite. Then decide whether "Ingmar Backman" should survive
as a search alias so the misspelling still resolves. Sweep for the same misspelling
elsewhere in the catalog while you are in there.

```sql
-- what exists today
select id, brand, model, model_year, confidence
from boards
where model ilike '%backman%' or brand ilike '%atlantis%'
order by model_year;

-- the correction (run it yourself, not from the build session)
update boards
set model = 'Ingemar Backman'
where id = '9dca31d3-fca2-4244-aa79-1b9609a4b645';
```

**Still unknown from the repo, and still owned by Jay:** whether a `people` or `profiles`
row for Ingemar exists at all, and whether its id is uuid-shaped. Those are pre-flights 1
and 2 and neither can be answered without a database session. Whether the S12 E01 episode
exists as an event, and whether an `event_guests` row links the two, is worth knowing but
is NOT blocking under revised D5: the episode is optional, `FNRAD_CHALLENGE.episodeSlug`
stays null until it exists, and the challenge card renders in full without it.

**All three checks are cheap, all three are read-only, and all three take under a
minute.** They are first in this brief because they are the only three things here that
can be wrong in a way the build cannot detect. Pre-flights 1 and 2 fail silently at
runtime: the page looks perfect and the listener's work goes nowhere. Pre-flight 3 fails
silently in search, which is a different kind of bad, because the person it embarrasses is
the guest.

---

## DECISIONS (review before building)

Every decision has a shippable default. Build the defaults unless Jay says otherwise.
Nothing in this brief blocks on an answer.

**D1. The hub lives at `/fnrad`, a static top-level route. DEFAULT: yes.**

`/fnrad` is free and safe. It is not a community slug (`COMMUNITY_SLUGS` is
snowboarding, surf, skate, ski, mtb, F1), it is not a legacy community route
(`COMMUNITY_ROUTES`, F2), and no `src/app/fnrad` directory exists (F3). In the Next
App Router a static segment beats the sibling dynamic `(community)/[community]`
segment, so adding `src/app/fnrad/page.tsx` cannot shadow or be shadowed by a
community. It also survives being said out loud: "linestry dot com slash F N Rad" is
six syllables and no listener has to spell anything.

Alternative A: reuse the existing public show page at `/t/{show-slug}`. Rejected
because that page is a chromeless share surface for people who already know what
Linestry is. It has no explainer, no signup call to action beyond a footer link that
says "Explore the snowboarding graph", no equity block, and its URL is whatever slug
the org happened to mint, which is not sayable on air. The show page stays exactly as
it is; the hub is a different job.

Alternative B: `/snowboarding/fnrad`. Rejected because it is longer to say, it puts a
campaign landing page behind a community prefix that means nothing to a first-time
listener, and it would sit under `CommunityShell` chrome that competes with the one
action we want.

**D2. The hub is a server component on the dark ground with minimal chrome, not the app
Nav. DEFAULT: yes.**

Follow `src/app/word/page.tsx` (F4) for the shape: brand-mark header linking home, a
`Metadata` export, no `Nav`. Use the dark ground the public `/t/` family already uses
(`#1C1917`, F5) so a listener arriving from an episode page sees one continuous
surface, and so the page does not flip appearance with the viewer's theme toggle mid
campaign. The homepage already takes this position for its own landing (`className="dark"`
wrapper, F6), so this is the established treatment for a top-of-funnel page, not a new one.

Alternative: render inside `Nav` like a community page. Rejected. The nav's three rows
of category links are the opposite of one obvious next action, and this page is judged
on one screen.

**D3. The hub resolves FNRad through a single constant show slug, and degrades to
evergreen content when it does not resolve. DEFAULT: yes, `FNRAD_SHOW_SLUG = "fnrad"`
in a new `src/lib/fnrad.ts`.**

There is no "campaign" concept in the schema and this brief is not adding one. The page
needs exactly one pointer: which org is the show. A constant is the whole mechanism.

The important half of this decision is the failure mode. If the slug does not resolve
(wrong value, show not published yet, org renamed), the page MUST still render the
explainer, the call to action and the equity block, with the episode list and the
challenge simply absent. It must never 404 and it must never throw. A URL that is being
read out on a podcast cannot have a data-dependent dead state.

Alternative A: look the org up by name with `ilike 'FNRad'`. Rejected as fragile against
a rename and a second show. Alternative B: an environment variable. Rejected because it
adds a Vercel step to a one-line change and makes the value invisible in the repo.

**D4. The episode list shows live episodes only, newest first, each with the names from
its published mentions. DEFAULT: yes, up to 8 names per episode then "and N more".**

"Live" already has a precise meaning in this codebase: enabled AND past `publish_at`
(`isEpisodeLive`, F7), and `readOrgStack` already filters non-live episodes out of the
public payload rather than only out of the render, after a real leak was caught in the
Session C acceptance pass (F8). Inherit that, do not re-derive it.

The names are the point of the list. A listener who just heard a rider's name needs to
scan the page and find that name, then tap it. An episode list of titles and dates does
not do that job. Published mentions only, never drafts (F9), which matters right now:
ep 21 is sitting at 53 draft mentions (reported, section 5b), and drafts must not leak
onto a page that is being advertised on air.

Cap at 8 so a 53-mention episode does not push the next episode off the screen.

**D5. The weekly challenge is "add your stories connected to this week's guest". The
spotlight is a PERSON, named in config, and the episode link is OPTIONAL and addable
later. DEFAULT: yes. NO migration, NO new table, NO new admin screen.**

REVISED September 6 2026, and the revision matters. Both earlier versions derived the
spotlight from the episode: the September 4 morning draft from its first curated
`public_stack_entries` row, the September 4 evening draft from its `event_guests` row.
Either way the challenge card depended on an episode record existing. Jay: "The episode page will be created separately, so we need the option to add
the episode link later." So the dependency inverts. **The guest is the spotlight and the
guest alone is required. The episode is decoration that can arrive afterwards, and its
absence must degrade silently rather than blanking the card.**

Concretely, one config object, `FNRAD_CHALLENGE` in `src/lib/fnrad.ts`:

```ts
export const FNRAD_CHALLENGE = {
  guestId: "<person or profile id>",   // REQUIRED. No id, no card, anywhere.
  guestName: "Ingemar Backman",        // display fallback if the node is unreadable
  episodeSlug: null,                   // OPTIONAL. The episode's public_slug. Fill in later.
  episodeLabel: null,                  // OPTIONAL. "FNRad S12 E01"
} as const
```

**The episode field holds a SLUG, not an id, and that is settled rather than incidental.**
Appendix A `[challenge-action-hub-secondary]` links to `/t/{episode-slug}`, and episode
pages are addressed by `public_slug` everywhere else in this brief: T2 step 2 lists only
episodes that have one, T6 step 6 links each row by it, and every destination in the
section 7 table is spelled that way. An `episodeId` would have to be turned into a slug by
a read, and this decision's whole point is that the hub does not read the episode. So the
field holds what the href holds and there is nothing to resolve.

Two consumers, and they are the only two:

- **`episodeLabel` feeds the kicker.** It is what the "From {episode-title}" line prints,
  verbatim (Appendix A `[challenge-kicker-hub]`).
- **`episodeSlug` feeds the secondary link.** It is what "See the episode" links to, as
  `/t/{episodeSlug}` (Appendix A `[challenge-action-hub-secondary]`).

**Both are hidden when `episodeSlug` is null.** Treat `episodeSlug` as the single switch
for the pair, including the case where a label has been filled in and a slug has not: a
kicker naming an episode the listener cannot open is worse than no kicker.

Three render states, all of which must be correct on day one:

1. `guestId` set, `episodeSlug` null. The card renders in full: ask, body, primary action.
   The "From {episode-title}" kicker and the "See the episode" secondary are BOTH absent.
   **This is the episode-1 launch state and the one to build and smoke first.**
2. `guestId` set, `episodeSlug` set. Kicker and secondary appear. Adding them later is a
   two-line config edit and a deploy, no code change, no migration.
3. `guestId` null. No card on any surface. No empty state, no placeholder.

"On any surface" and "on every surface" mean it literally: the hub and every public
episode page. There is no per-episode variation, because there is one constant and one
challenge. An episode page showing this week's challenge next to a different guest's chips
is correct and not a defect: the chips are that episode's guests (T8) and the card is this
week's ask (D5). If that ever reads badly, section 14 follow-up 5 is where a per-episode
challenge goes.

`event_guests` stays exactly where it is and is still the right home for the guest ON an
episode page (T8 and T9 read it). It is simply no longer what the CHALLENGE keys off,
because the challenge now outlives any single episode record. When `episodeSlug` is set,
the build may cross-check that the guest appears in that episode's `event_guests` and log
a warning on a mismatch, but it must never fail the render on one.

This is the load-bearing scope decision, so here is the reasoning in full.

The contractual commitment is a weekly community challenge tied to the episode (R3).
Episode 1's challenge, decided this week, is to add a story about that episode's guest.
That names the spotlight for us: it is the guest, and the guest is already a first-class
editor-managed field. `event_guests` is a junction of `event_id` and `person_id` with an
explicit `position`, created for exactly this purpose and kept deliberately separate from
attendance claims and from the curated stack "so the guest header is unambiguous" (F35).
`GET /api/events/[id]/guests` reads it in position order with no auth at all (F36), and
`readEventStack` already loads it, folds the guest ids into the shared entity resolution
pass, and hands the resolved people back as `meta.guests` (F37). All of that is still
live and is still exactly what the episode page's own guest header renders (T8, T9). It is
why "the guest" is a real, editor-managed thing in this product rather than a label
someone types.

It is NOT what the challenge reads. **On BOTH surfaces, the hub and the public episode
page, the challenge guest comes from `FNRAD_CHALLENGE.guestId` and is resolved to one
person.** Neither surface indexes `meta.guests` for the spotlight, which is why neither
can disagree with the other, and why neither goes blank when an episode record is missing
or its guest row has not been filled in yet. The hub does not need the episode at all.

Everything else costs more and buys nothing:

Alternative A: the morning draft's approach, the episode's first curated
`public_stack_entries` row. Rejected, and the reasoning is in section 10 risk 12 so it is
not lost. In short: it cannot express "the guest" reliably, and the anonymous mark it was
paired with cannot point at a rider at all.

Alternative B: two additive columns on `events` (`spotlight_type`, `spotlight_ref_id`).
Rejected. `EVENT_STACK_COLS` is an explicit column list and a missing column 404s the
entire public episode read (F11), which is exactly what made the Session C migration a
hard pre-merge gate. That turns a zero-risk copy-and-layout PR into a gated deploy, in
exchange for a stored spotlight that a two-line constant already expresses well enough for
one season. Section 14 follow-up 2 is where that trade flips.

Alternative C: a `challenges` table with its own admin CRUD. Rejected outright. That is a
contest system, which is the thing this brief exists to avoid building. It is in section
14 as the upgrade path if the challenge earns it after a season.

The cost of the default is that the challenge is only as good as the one id in config. A
null `guestId` renders no challenge at all, on every surface, which is correct: absent
beats wrong. A WRONG `guestId` renders a confident card about the wrong person, which is
the failure mode worth being careful about, and which is also a one-line fix the moment
anyone notices. Nothing in the schema records what the challenge was in a given week, and
section 14 follow-up 2 is where that gets fixed if the challenge runs a season. Section 15
question 3 asks Jay for the id before the episode drops, and section 0 is the pre-flight
that makes sure the person behind it is actually taggable.

A multi-guest episode still gets exactly one challenge, because `FNRAD_CHALLENGE` holds
exactly one `guestId` and Jay picks which person that is rather than the editor's row
order picking for him. Do not render a challenge per guest: the podcast says one ask, and
two asks is zero asks.

**D6. The challenge is an AUTHENTICATED action, and the on-ramp is sign up first, then
write. DEFAULT: yes. There is no anonymous story path in this brief.**

Not a style call, a constraint, and it is the constraint that killed the morning draft.

Writing a story is authenticated only. `POST /api/stories` opens with `requireAuth()` and
returns its response before touching the body (F40). There is no anonymous story write
anywhere in the tree. The anonymous loop this product does have, `POST /api/public/tag`,
cannot be pointed at a person: it accepts three moment kinds, place, event and story, and
nothing else (F14), it validates the posted moment against the owner's curated stack
(F13), and the card that renders the affordance enforces the same three kinds with a
comment saying in as many words that board, rider and category_summary entries get no
"I was there" affordance (F41). A rider is not a taggable moment. There is no anonymous
mark that can point at a guest, and this brief does not invent one.

Jay chose sign up first, then write, over the two alternatives:

Alternative A: write first, then sign up, holding the draft through the signup chain and
replaying it on arrival. Rejected. It is a better funnel and a worse first week: it means
holding unauthenticated user-generated prose in some store before there is an account to
own it, which is a data-retention and abuse question, not a landing-page question.

Alternative B: anonymous moderated submission, the way `POST /api/public/tag` works.
Rejected. A tag is a name and an email against a fixed moment. A story is free prose. The
moderation surface those two need is not the same surface, and the second one does not
exist.

So the call to action is "Add your story about {Guest}", and pressing it sends the
listener into the signup chain with the guest as the destination. What happens next is
section D7 and the dependency in T7b.

**D7. The guest has to be reachable from the surfaces a listener actually lands on, so
the public episode view gets guest links and the in-app logged-out CTA gets the episode
and the guest. DEFAULT: yes.**

There is an asymmetry in the product today that quietly guarantees a dead end, and it has
to be fixed for the challenge to work at all.

On the IN-APP episode page each guest is already a `next/link` to `/people/{id}`, avatar
and name inside one tappable chip (F38). On the PUBLIC chromeless `/t/[slug]` episode
view, which is the page show notes actually link to, the same guests render as plain
`<div>` elements with no href and no click handler (F39). A listener who hears "add your
story about Guest X", opens the show notes link, and sees Guest X's name and face on the
page cannot get from that name to that person. The one thing the podcast asked them to do
is the one thing the page will not let them do.

So this brief makes the public episode view's guest chips links to `/people/{id}`, bare
and community-scoped like every other outbound link on the chromeless pages (F19), and
adds the challenge call to action next to them. That is T8.

Second, the in-app episode page's logged-out call to action reads "Join Linestry to add
what you know about this episode" and links to `/` with no episode id and no guest id
(F42). It throws away everything it knows about where the visitor was standing. That is
one line to fix and it is the same fix the challenge needs everywhere else, so it is in
scope here: point it at the guest and carry the destination. That is T9.

Note what is deliberately NOT here. There is no per-type prompt table any more, because
there is one spotlight type: a person. There is no `IWasThere` affordance anywhere in the
challenge path, because a rider is not a taggable moment (F41). The existing `IWasThere`
panels on place, event and story stack entries stay exactly as they are: this brief does
not touch `StackEntryCard`, `i-was-there.tsx` or `POST /api/public/tag`.

**D8. Mention names on the public episode page become links. DEFAULT: yes.**

Today they render as plain `<span>` chips with no href and no affordance (F17). That is
the single biggest dead end for a listener: they hear a name, they open the show notes
link, they see the name, and it does nothing. `stackHref` already computes in-app paths
for place, event, board and rider (F18); orgs need one line more (`/brands/{orgSlug}`).
Bare community-scoped paths are correct here: the proxy 301s them to the active
community, which is exactly how the chromeless pages already link into the app (F19).

Where a subject cannot be resolved to a name, `mentionSubjectName` falls back to the raw
id (F20). Render those as unlinked text, as today. Never link an unresolved id.

**D9. A short listener strip goes on EVERY public episode page, not only FNRad's.
DEFAULT: yes.**

There is exactly one show in the product today, so branching on "is this the campaign
show" is speculative generality. One strip, one sentence, one call to action, directly
under the episode header and above the featured set.

**D10. The equity offer gets a short block on the hub, reading from the constants, and
links to `/equity`. DEFAULT: yes.**

`EQUITY_POOL_SHARES`, `EQUITY_SNAPSHOT_LABEL`, `EQUITY_SNAPSHOT_TIME_LABEL` and
`EQUITY_SNAPSHOT_CONTEXT` all exist and already carry the April 30 2027 noon Pacific
end-of-Season-12 values (F21). Read them. Do not hardcode a date on this page: the last
time six surfaces hardcoded the snapshot date, one of them was still saying April 2026
months later (F22).

Three sentences and a link. The `/equity` page owns the mechanism, the token weights and
the formula. This page owns one job: telling a listener that the offer exists and that
it closes at the end of the season they are currently listening to.

**D11. No attribution code in this PR. DEFAULT: yes, and the hub is not blocked by it.**

The companion brief `features/funnel-attribution-brief.md` (same day) owns first-touch
capture, the `ref_codes` and `acquisition` tables, and the spoken `/r/[code]` route
(F23). This brief must not import `src/lib/attribution.ts`, must not call
`attributionProps()`, and must not add a column or an event for attribution. See
section 6, T7 for the codes the campaign needs and what happens in each shipping order.

**D12. No new analytics events and no new `AnalyticsCategory`. DEFAULT: yes.**

The category union is auth, ftue, content, invite, redirect, moderation, error (F24). A
campaign category would be a types change plus a server allowlist change for a page whose
pageviews PostHog already captures automatically (`capture_pageview: true`, F25). Not
worth it. Section 14 logs it if the campaign ever needs per-section click data.

**D13. Erik's sticker-for-signup idea is NOT in this session. DEFAULT: correct.**

Reported as unanswered since August (section 5b). It is an ops and fulfilment question
(who prints, who mails, what triggers it, what address data gets collected and where it
is stored), and the last one of those is a privacy-policy change. It does not belong in
a landing-page PR. Section 15 asks Jay to answer Erik either way, because an unanswered
partner idea costs more than a declined one.

---

## 1. Why this, why now

Linestry is the Season 12 presenting sponsor of FNRad. The deal (reported, section 5b)
commits Linestry to a dedicated page that gets read out on air, per-episode pages linked
from show notes and transcripts, and a weekly community challenge tied to each episode.

**The deal is announced and episode 1 drops in one to two weeks.** That is the deadline
this brief now runs against, and it is what makes the challenge urgent rather than
seasonal: there is exactly one first episode and the page has to be right for it.

Episode 1's challenge is decided: it asks listeners to add a story about that episode's
guest (R8). That is why D5 through D7 read the way they do, and it is why section 0 exists
at all. It also means the challenge is an authenticated action, because writing a story
always has been (F40), which is a materially harder ask than the anonymous one-tap mark
this brief originally scoped. Section 10 risk 12 records that trade in full.

Today a listener who hears the callout lands on `/`. The homepage has no idea the
podcast exists: it contains the string "FNRad" nowhere, its hero is about snowboarding
history in general, and its primary action is "Start Your Timeline" with no context for
why a person who was just listening to Erik should press it (F26). The listener has to
make the leap from "the podcast mentioned a website" to "this is the website and here is
what it has to do with the episode" entirely unaided.

The strange part is how much is already built. The mentions pipeline is complete end to
end: a transcript becomes a seed file becomes draft mentions becomes published mentions
on a public episode page, with timestamped links back into the audio (F27). Episodes have
public chromeless pages with scheduled release. The show has a public hub. Guests are an
editor-managed field that is already read and already resolved into the public episode
payload (F35, F37). The composer on a person's page already opens pre-tagged to that
person (F43). What is missing is the front door: one page that a cold listener can land
on, understand in a screen, and act from, and a path from a guest's name to a story about
them that does not dead-end.

So this is not new machinery. It is a landing page over machinery that already runs, plus
three small passes on the episode surfaces that turn them from artifacts into entry
points. That is why it is a four-to-six hour session and not a three-week one.

The timing is the season. The equity offer closes at the end of Season 12 (F21), which
makes every episode between now and then a chance to convert a listener while the offer
is still open, and makes each of those chances non-repeatable.

---

## 2. Prerequisites

1. **Pull `main`.** Every line number in this brief was verified against `39f169d`
   (September 4 2026). **Re-verified against `b7713e0` on September 6 2026:** ten PRs have
   merged since (#223 to #232: the catalog provenance layer, the Issuu catalog merge, the
   shared unverified badge, and the three-phase duplicate-person prevention work). This
   brief touches TEN files. Four of them do not exist yet and it creates them
   (`src/lib/fnrad.ts`, `src/lib/mention-links.ts`,
   `src/components/fnrad/challenge-card.tsx`, `src/app/fnrad/page.tsx`; `ls` confirms all
   four absent, extending F3). The other six are `src/lib/public-timeline-read.ts`,
   `src/components/public-timeline/public-episode-view.tsx`,
   `src/components/public-timeline/public-mention-group.tsx`,
   `src/components/public-timeline/public-mention-row.tsx`,
   `src/components/events/episode-page.tsx` and `src/app/people/[id]/page.tsx`, and
   `git diff --stat 39f169d..HEAD` reports **all six byte-identical, zero changed lines**.
   So sections 5a, 6, 7 and 11 can be trusted exactly as written; nothing needs re-grepping
   before building. One file this brief only CITES did move:
   `src/components/ui/add-story-modal.tsx` gained three lines from PR #227, but the
   `riderIds` prop comment F43 cites is still at `:28-29`, so that citation holds too. The
   one change that touches this brief is in SQL rather than TypeScript, and it RETIRES an
   AUDIT rather than creating work: see pre-flight 2 on `merge_person_into` and
   `event_guests`.
2. **Dev server** (playbook check 20). `npm run dev` runs from the repo root
   (`~/lineage`), serving on port 3000. Kill any stale dev server bound to 3000 first,
   or the smoke pass will be against the wrong tree.
3. **Confirm the FNRad show's `public_slug` and `public_enabled` in Supabase** before
   coding T1. One query:
   ```sql
   select id, name, org_type, public_slug, public_enabled
   from public.orgs where org_type = 'media';
   ```
   Whatever `public_slug` comes back is the value for `FNRAD_SHOW_SLUG`. If
   `public_enabled` is false, the show page is not live and `readOrgStack(..., requireEnabled: true)`
   returns null, which means the hub renders in its degraded state. That is a data fix
   (tick "Public link" on the show), not a code fix.
4. **Confirm at least one episode is live and has published mentions**, so the episode
   list and the challenge have something to render during the smoke pass:
   ```sql
   select e.id, e.name, e.episode_number, e.public_enabled, e.publish_at,
          count(m.id) filter (where m.status = 'published') as published_mentions,
          count(m.id) filter (where m.status = 'draft')     as draft_mentions
   from public.events e
   left join public.mentions m on m.episode_event_id = e.id
   where e.event_type = 'episode'
   group by e.id order by e.episode_number desc nulls last;
   ```
   If every episode returns zero published mentions, build against the degraded render
   and note it in the PR; do not publish drafts to make a screenshot work.
5. **Confirm the episode-1 guest's id, and run the three pre-flight checks.** The
   challenge spotlight is `FNRAD_CHALLENGE.guestId` in `src/lib/fnrad.ts` (D5, T1), a
   hand-edited constant, so what has to be confirmed is that one id and the person behind
   it. No `event_guests` row is required for the challenge to render anywhere. The query
   below is still worth running, for two reasons that are not the challenge: it is how you
   read a guest id off an episode when one exists, and it tells you whether T8's guest
   chips have anything to render. One query for the guest set across every episode:
   ```sql
   select e.episode_number, e.name, eg.position, eg.person_id
   from public.events e
   left join public.event_guests eg on eg.event_id = e.id
   where e.event_type = 'episode'
   order by e.episode_number desc nulls last, eg.position;
   ```
   Then run **all three pre-flight checks in section 0** against episode 1's guest id.
   They are blocking and they are Jay's, not the build's.
6. **Read `features/signup-intent-handoff-brief.md`.** It IS on disk, it is 979 lines,
   it is the critical path for this brief's call to action, and it ships FIRST. See T7b
   for what the FNRad surfaces do in each shipping order. Its section and task numbers are
   cited in T7b from the file itself rather than guessed, so the AUDIT hedge that stood
   here on September 4 is struck.
7. **Read `features/funnel-attribution-brief.md` section 6 T4** if it is still on disk
   unshipped, so the `ref` code names in T7 match what that brief will mint.

---

## 3. Scope

**In scope**

- A new public route `/fnrad`: a server-rendered listener hub with a brand-mark header,
  an explainer, one primary call to action, this week's challenge, the Season 12 episode
  list with the names from each episode, a short equity block, and a footer.
- One new exported reader, `readShowHub()`, in `src/lib/public-timeline-read.ts`, which
  returns the show header, the live episode list, and the published-mention names per
  episode in one pass.
- One new tiny constants module, `src/lib/fnrad.ts`.
- A shared `ChallengeCard` component used by both the hub and the public episode page,
  taking its spotlight from `FNRAD_CHALLENGE.guestId` in `src/lib/fnrad.ts`, with the
  episode link optional and absent until it is filled in (D5).
- Four additions to the public episode page (`public-episode-view.tsx`): the listener
  strip, the challenge card, linked mention names, and linked GUEST chips (D7, T8).
- One line on the in-app episode page (`episode-page.tsx`): the logged-out call to action
  gets the episode and the guest instead of pointing at `/` (D7, T9). This is one of two
  exceptions to "leave the authenticated surfaces alone" in section 4 item 10, and it is
  scoped to that one paragraph.
- One block on the person page (`src/app/people/[id]/page.tsx`): the sparse-ghost empty
  state at `:666-692` (F54) renders its actions for signed-out visitors too, routed
  through the same `addStoryAboutHref` everything else in this feature uses, and its copy
  stops asserting a mention that is not there (T7a). This is the second exception, and it
  is scoped to that one block. T7b's prohibition covers a DIFFERENT block in the same
  file, the signed-out CTA button row, which stays the handoff brief's.
- The full page copy, written and locked in Appendix A. Build from Appendix A verbatim.
- `Metadata` on `/fnrad` (title, description, canonical, OpenGraph, Twitter), matching
  the `/word` pattern.

**Out of scope. Do not build these.** Hard list in section 4.

---

## 4. Out of scope (hard list)

1. **Any migration, column, table or view.** If a task seems to need one, it is out of
   scope, not out of budget. See D5.
2. **Any change to `POST /api/public/tag`.** Not the accepted moment kinds, not the
   moment validation, not the throttle. The challenge does not use this route at all
   (D6): a rider is not a taggable moment (F41) and this brief does not make one.
3. **Any anonymous story-write path.** No draft held for an unauthenticated visitor, no
   moderated anonymous submission queue, no "post now, claim later". D6 records that Jay
   chose sign up first, then write, and the two rejected alternatives. If a task seems to
   need one, stop and re-read D6.
4. **Any change to `StackEntryCard`, `TAGGABLE` or `i-was-there.tsx`.** The existing
   anonymous marks on place, event and story stack entries keep working exactly as they
   do today. The challenge sits beside them, not through them.
5. **Any new admin or editor screen.** Not for the guest set, which is already editable
   through the existing editor path behind `PUT /api/events/[id]/guests` (F36), and not
   for the challenge, which is a hand-edited constant in `src/lib/fnrad.ts` (D5) and stays
   one this session. Section 14 follow-up 2 is where a real picker goes if the challenge
   earns it.
6. **Attribution.** No `src/lib/attribution.ts` import, no `/r/[code]` route, no
   `ref_codes` row. See D11 and T7.
7. **New analytics events or a new `AnalyticsCategory`.** See D12.
8. **The sticker programme.** See D13.
9. **Changing the public SHOW page** (`public-show-view.tsx`). The hub does not replace
   it and this PR does not touch it. Two surfaces with different jobs is correct: the
   show page is a share card for the show, the hub is a landing page for a campaign.
10. **The in-app episode page** (`src/components/events/episode-page.tsx`) and the show
    module, EXCEPT the one logged-out call-to-action paragraph at `:426-430` that T9
    rewires. Nothing else in that file is opened: not the guest chips (already links,
    F38), not the editor controls, not the mention rendering. Show notes link to the
    public `/t/` page, which is where the listener work happens.
11. **Episode transcripts on the page.** Excerpts already render inside mention cards.
    A full transcript surface is its own feature.
12. **Any "media" community type.** Explicitly recommended against in the pass notes and
    still correct (F28).
13. **RSS, an episode player, or anything that fetches from a podcast host.** The
    `media_url` link and the YouTube embed already there are the whole media story.
14. **Refactoring `mentionSubjectName`, `stackHref`, or `StackEntryCard`** beyond the
    one org case D8 needs. Tempting while in the file. It puts a shared-component
    refactor in a PR whose diff should be readable by a non-engineer.

---

## 5. Verified facts (checked against `main` at `39f169d`, September 4 2026)

Provenance given so the session does not re-derive these. Everything in 5a was read off
the tree on disk. 5b is reported context that was NOT verified from code. 5c is what
could not be checked at all.

### 5a. Verified from the repo

- **F1. Community slugs are a fixed list.** `COMMUNITY_SLUGS = ["snowboarding", "surf",
  "skate", "ski", "mtb"]` at `src/lib/community.ts:7`, gated by `isValidCommunitySlug`
  at `:11`, which `src/app/(community)/[community]/layout.tsx:14` calls before
  `notFound()`. `fnrad` is not in it.
- **F2. Legacy top-level community routes are a fixed list.** `COMMUNITY_ROUTES` at
  `src/proxy.ts:24-28` is places, events, boards, brands, orgs, stories, feed,
  connections, collective, profile, explore, timeline. A first segment in that set 301s
  to `/snowboarding/...` at `src/proxy.ts:165-169`. `fnrad` is not in it, so `/fnrad`
  passes through untouched.
- **F3. No `/fnrad` route exists.** `ls src/app` returns (community), account, admin,
  api, auth, claim, compare, data-deletion, equity, fonts, founding, gift, intro, me,
  member, membership, onboarding, people, privacy, t, terms, welcome, word plus the
  loose files. Nothing to remove, no redirect to preserve. Playbook check 22: the
  premise "this page does not exist" is confirmed, not assumed.
- **F4. `src/app/word/page.tsx` is the model for a minimal-chrome public page.** Full
  `Metadata` export at `:8-26`, `displayFont` const at `:28`, brand-mark header linking
  home at `:41-45`, no `Nav`. 210 lines total.
- **F5. The public `/t/` family renders on `#1C1917`** with white-on-dark type:
  `public-episode-view.tsx:73`, `public-show-view.tsx:40`.
- **F6. The homepage is force-dark regardless of the theme toggle**, via a `className="dark"`
  wrapper that re-scopes the tokens for the subtree: `src/app/page.tsx:20`.
- **F7. `isEpisodeLive(row, now)`** at `src/lib/public-timeline-read.ts:1072` returns
  `public_enabled AND (publish_at is null OR publish_at <= now)`, and treats an
  unparseable `publish_at` as not-yet, failing closed.
- **F8. `readOrgStack` already filters the episode list on the public read.**
  `src/lib/public-timeline-read.ts:1592` is the function; the episode query is at
  `:1607`; the sort (episode number desc, else year desc) at `:1629`; the
  `opts.requireEnabled ? episodes.filter(e => e.live) : episodes` line at `:1636`, added
  after Session C acceptance caught unpublished episode titles serialized into the public
  page source. It accepts either `slug` (with `requireEnabled`) or `orgId`.
- **F9. Published-only mention reads exist and have no editor escape hatch on the public
  path.** `readPublishedMentions(episodeId)` at `src/lib/mentions-server.ts:27` filters
  `status = 'published'`, ordered by `timestamp_seconds` nulls last then `created_at`.
  `GET /api/mentions` at `src/app/api/mentions/route.ts:16` honours `include_drafts=1`
  ONLY for an editor session and ONLY on the episode-side read (`:33`).
- **F10. The curated stack is editor-ordered per episode.** `public_stack_entries` rows
  carry `position`; `loadOwnerStack(db, "event", event.id, ...)` at
  `src/lib/public-timeline-read.ts:1293` loads them; `StackCurateModal`
  (`src/components/ui/stack-curate-modal.tsx`) is the editor surface; `ShowModule`
  and `EpisodeView` open it. Reorder is move-buttons, not drag and drop.
- **F11. `EVENT_STACK_COLS` is an explicit column list**, `src/lib/public-timeline-read.ts:1045-1046`.
  A column named there that does not exist in the database 404s the whole public episode
  read. This is why the Session C `publish_at` migration was a hard pre-merge gate, and
  it is the reason D5 refuses to add a column.
- **F12. `category_summary` stack entries have no `refId`.** `resolveCuratedRow` returns
  null for them at `src/lib/public-timeline-read.ts:1215`, and returns null for any row
  with no `entry_ref_id` at `:1218-1219`. A resolved entry's `refId` is documented at
  `:596-598`.
- **F13. `POST /api/public/tag` validates the moment against the owner's surface.**
  Slug resolution order profile, then episode, then show at
  `src/app/api/public/tag/route.ts:125-158`. For an episode or show owner the moment must
  be a curated stack entry of the claimed kind: `stack.entries.some(en => en.entry_type === kind && en.refId === momentId)`
  at `:154-156`. A mismatch returns 400 "That moment is not on this timeline" at `:164`.
- **F14. Only three moment kinds are accepted.** `type MomentKind = "place" | "event" | "story"`
  at `src/app/api/public/tag/route.ts:43` and
  `const MOMENT_KINDS = new Set<MomentKind>(["place", "event", "story"])` at `:44`. The posted
  kind is clamped and cast at `:92` and rejected at `:100-102`. There is no board, org or
  person moment. **Corrected in the September 4 evening revision: this fact previously cited
  `:89-90` for the definitions, which is where the request body is parsed, not where the union
  is declared. The claim was right and the line numbers were wrong.**
- **F15. The stack card enforces the same set.** `const TAGGABLE = new Set(["story", "place", "event"])`
  at `src/components/public-timeline/stack-entry-card.tsx:23` with the comment "Board,
  rider and category_summary entries get no I was there affordance"; the gate is at
  `:117-118`; `IWasThere` renders at `:230-233`. `StackView` passes `allowTagging`
  through at `src/components/public-timeline/stack-view.tsx:12` and `:42`.
- **F16. `IWasThere` is a self-contained anonymous island.** `src/components/public-timeline/i-was-there.tsx:35`,
  CTA labels at `:26-30` ("I rode there" / "I was there" / "I was there too"), POST at
  `:80`, "check your email" state at `:112-120`, `variant="panel"` for the dark ground at
  `:62-64`. No store, no auth.
- **F17. Mention subject names on the public episode page are dead text.**
  `src/components/public-timeline/public-mention-group.tsx:66-74` renders each
  `mention.subject_name` inside a plain `<span>` chip. No href, no click handler, no
  claim affordance. `public-mention-row.tsx` (the ungrouped twin) is the same.
- **F18. `stackHref` covers four of the five subject types.**
  `src/lib/public-timeline-read.ts:1191-1206`: place, event, board and rider get a path;
  it returns null for story and has no org branch. `orgSlug(org)` exists at
  `src/lib/mock-data.ts:558`.
- **F19. Chromeless pages emit BARE community paths on purpose.** Documented at
  `src/lib/public-timeline-read.ts:604-609`: "Community-scoped paths are emitted BARE
  (/places/...): the proxy 301s them to the active community, which is what lets the
  chromeless /t/ page link into the app."
- **F20. `mentionSubjectName` falls back to the raw id** when a subject cannot be
  resolved: `src/lib/public-timeline-read.ts:1498-1510`, for all five subject types.
- **F21. The equity constants already carry the Season 12 values.**
  `src/lib/equity-offer.ts:8` `EQUITY_POOL_SHARES = 100_000`; `:18`
  `EQUITY_SNAPSHOT_DATE = "2027-04-30T19:00:00Z"`; `:19` `EQUITY_SNAPSHOT_LABEL = "April 30, 2027"`;
  `:20` `EQUITY_SNAPSHOT_TIME_LABEL = "12:00 noon Pacific"`; `:22`
  `EQUITY_SNAPSHOT_CONTEXT = "the end of FNRad Season 12"`. The doc comment at `:10-17`
  states the offer runs to the end of Season 12 because Linestry is the presenting
  sponsor.
- **F22. Hardcoded snapshot dates have drifted before.** The pass notes record six
  hardcoded date strings bypassing the constants, one of them a stale "Next distribution:
  April 2026" on the profile strip: `features/podcast-episode-pass-notes.md` section 3.
  All six were replaced in PR #167.
- **F23. There is no `/r` route today.** `ls src/app/r` returns nothing. The companion
  brief `features/funnel-attribution-brief.md` specs it at section 6 T4 (`:566`), and its
  own worked example mints the code `fnrad-s12e04` (`:604-610`).
- **F24. `AnalyticsCategory`** is auth, ftue, content, invite, redirect, moderation,
  error: `src/types/index.ts:813-821`. `captureServerEvent` rejects anything outside the
  union at `src/lib/analytics-server.ts:66`.
- **F25. PostHog captures pageviews automatically.** `capture_pageview: true` and
  `capture_pageleave: true` at `src/instrumentation-client.ts:23-32`, initialised before
  hydration, guarded on the key so a missing key is inert.
- **F26. The homepage says nothing about the podcast.** `src/app/page.tsx` is 148 lines
  and contains no "FNRad", no "podcast", no "episode". Hero at `:50-57`, the snowboarding
  focus card and its two CTAs at `:90-121`, the equity teaser at `:126-133`, the legal
  footer at `:137-141`.
- **F27. The mentions pipeline is complete.** Table:
  `supabase/migrations/20260731000001_mentions.sql` (episode FK, five subject types, no
  subject FK, `timestamp_seconds`, `excerpt`, draft/published, dedupe unique index, RLS
  select published-only) plus `20260801000001_mention_story_title.sql` for `story_title`.
  Authoring: `.claude/skills/podcast-mentions`, `podcast-seeds/` (real seeds gitignored,
  `EXAMPLE.json` committed), `scripts/import-mentions.mjs` (dry run by default,
  `--resolve-only`, `--apply` imports as DRAFT), and the editor page
  `src/app/admin/podcast/import/page.tsx` with `POST /api/admin/mentions/import`.
  Rendering: `groupMentionsByMoment` at `src/lib/mentions.ts:58`, `PublicMentionGroup`
  on the public page, `MentionRow` and `mention-episode-group.tsx` in-app.
- **F28. Show and episode modelling, exactly.** A show is an **Org** with
  `org_type: "media"`; an episode is an **Event** with `event_type: "episode"`,
  `show_org_id`, `episode_number`, `media_url`, `public_slug`, `public_enabled`,
  `publish_at`. There is no episodes table and **no `event_series` involvement**:
  `features/podcast-episode-pass-notes.md` section 1 states it and
  `src/app/api/admin/show-episode/route.ts:64-77` (show insert, `org_type: "media"`) and
  `:80` onward (episode insert) are the write path. Ids are generated text, not uuids:
  `genId()` at `:19-21` produces `org_<ms>_<rand>` and `evt_<ms>_<rand>`, which is why
  `mentions.subject_id` and `public_stack_entries.entry_ref_id` are text with no FK.
- **F29. `/t/[slug]` resolution order and its fallbacks.** `src/app/t/[slug]/page.tsx:109-145`:
  profile timeline, then episode (`readEventStack`), then show (`readOrgStack`), then an
  editor-only preview of a not-yet-public episode or show, then a 308 to a canonical slug
  from `person_slug_aliases`, then `notFound()`.
- **F30. What the public episode page renders today**, `src/components/public-timeline/public-episode-view.tsx`:
  brand-mark header (`:76`), an editor-only preview or scheduled banner (`:79-93`), the
  show name linking `/t/{show-slug}` (`:97-107`), the episode title as H1 (`:108-113`),
  an "Episode N  ·  YYYY" line (`:114`), the description (`:115-119`), guest avatars
  (`:121-135`), a YouTube embed or a "Listen to the episode" link (`:138-157`), "Featured
  in this episode" stack (`:161-166`), "Mentioned in this episode" grouped cards
  (`:171-182`), "Stories from this episode" (`:187-209`), and a footer with "Powered by
  Linestry" and "Explore the snowboarding graph" (`:211-219`). There is no sentence
  anywhere on the page explaining what Linestry is.
- **F31. Only `/[community]/timeline` and `/me/*` are auth-gated.** `src/proxy.ts:199-205`.
  Every browse page, and therefore `/fnrad`, stays public.
- **F32. The root OG image applies to routes with no image of their own.**
  `src/app/opengraph-image.tsx` exists alongside `src/app/t/[slug]/opengraph-image.tsx`,
  so `/fnrad` inherits the site card with no work.
- **F33. The copy frame in production is scatter-to-connection, not loss.**
  `features/archive/2026-08-17-category-page-cta.md` section 2a: the villain is scatter,
  the visitor holds a piece that is needed, invitation over critique. Voice guardrails
  from the same section: no aphorisms, no extended metaphors, no clever headings, no
  exclamation marks, no em dashes, plain declarative, concrete nouns, collective "we".
  The homepage runs "Our history is real, but scattered" at `src/app/page.tsx:51`.
- **F34. `/people/[id]` carries the claim affordance.** `HelpConnectCard` with "This is
  me", and the claim path `POST /api/public/claim-node`, per
  `features/archive/2026-08-19-invite-flow-claim-first.md` (premise-correction section).
  Claim is the primary CTA on that surface and the email invite is secondary, as of
  PR #204.

Facts F35 through F52 were added in the September 4 evening revision and verified against
the same tree. F10, F12, F13, F15 and F16 describe the SUPERSEDED curated-stack and
anonymous-mark mechanic. They are retained, not deleted, because risk 12 rests on them and
because they remain true statements about the code; they are simply no longer what this
feature is built on. F41 restates F15 with the current line numbers and the comment text
in full, because that one fact is the reason the morning design does not work.

**A second, narrower supersession, September 6 2026.** F35, F36 and F37 are STILL TRUE as
statements about the code, and nothing in them was re-verified as wrong. What is superseded
is the DESIGN RATIONALE they were carrying: all three were written to argue that the
challenge spotlight should be derived from `event_guests` because that read was already
free. Revised D5 does not derive the spotlight from `event_guests` at all. The three facts
stay load-bearing for T8 and T9, which render the episode page's own guest header and are
unchanged by this revision. Read them as evidence about GUESTS, not as evidence about the
CHALLENGE. F37's closing sentence has been rewritten accordingly; its body is untouched.

- **F35. `event_guests` is the editor-managed guest junction, and its person ids are
  text.** `supabase/migrations/20260629000002_fnrad_featured_timelines_phase1.sql:97-108`
  creates it: `event_id text not null references public.events(id) on delete cascade`,
  `person_id text not null`, `position int not null default 0`, `added_by`, `created_at`,
  primary key `(event_id, person_id)`; index `event_guests_event` on `(event_id, position)`
  at `:110-111`. The header comment at `:95-96` says it is kept "separate from attendance
  claims and from the curated stack so the guest header is unambiguous". The comment at
  `:100-102` states `person_id` is text because "catalog person ids are mixed-type (roughly
  29 people.id values are still non-uuid)" and that there is no FK for the same reason.
- **F36. `GET /api/events/[id]/guests` is PUBLIC.** `src/app/api/events/[id]/guests/route.ts:13-28`.
  It calls `getServiceClient()` directly with no auth check, selects `person_id, position`
  ordered by `position` ascending, and returns `{ person_ids: string[] }` in position
  order (`:26`). `requireEditor()` is called only in `PUT` at `:38`. `MAX_GUESTS` is 12
  (`:11`).
- **F37. `readEventStack` already reads guests and resolves them to `meta.guests`.**
  `src/lib/public-timeline-read.ts:1404-1410` queries `event_guests` for the episode in
  position order and maps to `guestIds`; `:1427` folds those ids into the shared entity
  resolution seed (`person: [...guestIds, ...mentionSeed.person]`); `:1469-1471` maps them
  back through `entities.people` and filters out anything unresolved; `:1480` returns them
  as `meta.guests`. The type is `guests: PublicPersonLite[]` at `:1094`. So the public
  episode payload ALREADY carries the resolved guest, which is what the episode page's own
  guest header renders and what T8 turns into links. **Conclusion superseded September 6
  2026:** this fact used to close by saying no new read was needed for the spotlight.
  Revised D5 does not take the spotlight from `meta.guests` on either surface, so the fact
  no longer argues anything about the challenge. Everything above this sentence stands
  exactly as written.
- **F38. In-app, each guest IS a link.** `src/components/events/episode-page.tsx:249-273`:
  a "Guest"/"Guests" label, then `guests.map` rendering a `next/link` whose `href` is
  `/people/` plus the guest id, at `:257-260`, wrapping the avatar and the display name in
  one rounded chip with a hover border.
- **F39. On the public chromeless episode view, guests are NOT clickable.**
  `src/components/public-timeline/public-episode-view.tsx:121-135`: the same label at
  `:123-125`, then `meta.guests.map` rendering a plain `<div>` at `:128` containing
  `GuestAvatar` (`:129`, defined at `:40`) and a `<span>` with the display name (`:130`).
  No `href`, no handler, no link import for this block. This is the dead end D7 fixes.
- **F40. Adding a story is authenticated only.** `POST /api/stories` at
  `src/app/api/stories/route.ts:309` opens with
  `const { user, response: authResponse } = await requireAuth()` and returns
  `authResponse` immediately at `:310`, before the body is read. `requireAuth` is imported
  at `:3`. `PATCH` (`:457`) and `DELETE` (`:718`) do the same. There is no anonymous story
  write anywhere in `src/app/api`.
- **F41. Riders get no "I was there" affordance, by design and in a comment.**
  `src/components/public-timeline/stack-entry-card.tsx:23`:
  `const TAGGABLE = new Set<TagMoment["kind"]>(["story", "place", "event"])`, preceded at
  `:21-22` by "Only story / place / event stack entries are taggable (brief section 5).
  Board, rider and category_summary entries get no 'I was there' affordance." The gate is
  at `:118`. A rider is therefore not markable through the anonymous loop, full stop.
- **F42. The in-app logged-out episode CTA throws away the episode and the guest.**
  `src/components/events/episode-page.tsx:426-430`: `{!isAuth && (` then a paragraph
  reading `<CommunityLink href="/">Join Linestry</CommunityLink> to add what you know
  about this episode.` The href is `/`. No episode id, no guest id, no `returnTo`.
  `isAuth` is `isAuthUser(activePersonId)` at `:63`.
- **F43. `/people/[id]` already has the exact affordance the challenge needs.**
  `src/app/people/[id]/page.tsx:423-428` renders a button labelled
  `Add story about {person.display_name.split(" ")[0]}` which sets `showAddStory`; the
  modal at `:777-786` opens as
  `<AddStoryModal defaults={{ riderIds: [resolvedId], onTimeline: false }} ... />`. The
  `riderIds` default is documented on the prop itself at
  `src/components/ui/add-story-modal.tsx:28-29`: "Pre-tag riders (e.g. opening 'Add a story
  about {person}' from a profile)." The block is gated on
  `!isCurrentUser && isAuthUser(activePersonId)` at `:415`. So the destination for a
  signed-in listener already exists and is already pre-tagged. Nothing in this brief has to
  build a composer.
- **F44. The SIGNUP chain drops any destination; only the SIGN-IN chain carries one.**
  `safeReturnTo` and `signInHref` at `src/lib/safe-redirect.ts:17` and `:33` validate a
  root-relative `returnTo`; `src/app/auth/signin/page.tsx:59-60` and `:71-75` carry it into
  `redirectTo`, and `src/app/auth/complete/page.tsx:25` reads it and `:225` does
  `router.replace(returnTo)`, falling back to `/{community}/profile`. But the sign-in surface
  sets `shouldCreateUser: false` on purpose (`signin/page.tsx:108-116`), so it is not a
  signup path. The signup path is `/onboarding` (`src/app/onboarding/page.tsx`, three lines,
  renders `OnboardingFlow`), whose `SaveStep` calls
  `signInWithOAuth` with `redirectTo` set to the origin plus `/auth/callback` at
  `src/components/onboarding/save-step.tsx:87-89` and `:107-109`, and `signInWithOtp` with
  `emailRedirectTo` set to the origin plus `/auth/complete` at `:154-159`, none of them
  carrying a `returnTo`. `OnboardingFlow` has no `returnTo` and its
  only exit is `router.push` to `/${activeCommunitySlug}` at
  `src/components/onboarding/onboarding-flow.tsx:262`. This gap IS the companion brief.
- **F45. `profiles.require_tag_approval` exists and defaults to permissive.**
  `supabase/migrations/20260514000001_pb009_permissive_tag_visibility.sql:38-39`:
  `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS require_tag_approval boolean NOT NULL DEFAULT false;`
  The column comment at `:41-42` states the default means "pending tags are publicly visible
  (the asserter and viewers see them immediately) and the inbox is a notification +
  remove-tool, not a gate".
- **F46. That flag is what decides whether a listener's story is visible.**
  `supabase/migrations/20260616000001_bug060_tag_visibility_definer.sql:53-73` defines
  `tag_event_publicly_visible(uuid)` as `SECURITY DEFINER`, returning true when the tag is
  approved OR `(status = 'pending' AND COALESCE(p.require_tag_approval, false) = false)`
  (`:66-69`). The truth table is spelled out in the header comment at `:45-48`:
  pending plus gate OFF is visible, pending plus gate ON is hidden. `story_riders_public` at
  `:92-96` is `security_invoker` over `story_riders` filtered by that helper.
- **F47. The guest's own page reads tagged-in stories through the approved-only view, and
  only for uuid ids.** `src/app/people/[id]/page.tsx:143-145` says so in a comment
  ("Tagged-in reads through story_riders_public, so pending tags stay hidden until the
  tagged rider approves them"); `:146` computes
  `const isProperUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(resolvedId)`; the authored and
  tagged-in fetches at `:167-181` are inside `if (isProperUuid)`. Podcast mentions at
  `:190-196` are deliberately NOT gated on it. `GET /api/stories` reads `story_riders_public`
  at `src/app/api/stories/route.ts:172` and `:188`.
- **F48. The gate is a user-facing setting.** `src/app/me/settings/tag-privacy/page.tsx`
  is a client page reading and PATCHing `/api/me/tag-privacy` (`:19`, `:38-42`), toasting
  "Approval required. New tags will wait in your inbox." on true and "Approval not
  required. Tags appear immediately." on false (`:47-49`).
- **F49. `story_riders.rider_id` is uuid.**
  `supabase/migrations/20260323000001_stories.sql:31-35`:
  `create table if not exists story_riders ( story_id uuid ..., rider_id uuid not null references profiles(id) on delete cascade, primary key (story_id, rider_id) );`
- **F50. The profiles FK was dropped on purpose, moving integrity to the application.**
  `supabase/migrations/20260512000003_story_riders_drop_profiles_fk.sql` drops it by
  introspecting `pg_constraint`, and its closing
  `COMMENT ON COLUMN public.story_riders.rider_id` states: "FK to profiles(id) dropped to
  permit ghost-rider tagging. Column remains uuid; references either profiles.id (claimed
  users) or people.id (UUID-format ghosts). Integrity is enforced at the application layer."
- **F51. The application layer does NOT validate the shape on the POST path.**
  `src/app/api/stories/route.ts:388-392` inserts
  `rider_ids.map((rid: string) => ({ story_id: storyId, rider_id: rid }))` into
  `story_riders` and throws `story_riders insert failed: ...` on error; the surrounding
  `catch` at `:446-449` returns that message with `status: 500`. There is no uuid test
  anywhere on this path. So a non-uuid rider id is a 500, not a 400 with a readable
  message.
- **F52. The after-the-fact connection path DOES validate, and rejects.**
  `src/app/api/stories/[id]/connections/route.ts:113-115`:
  `if (!UUID_RE.test(entityId)) { return NextResponse.json({ error: "Unknown rider" }, { status: 400 }) }`.
  The two paths disagree, which is worth knowing but is not this brief's to fix.
- **F53. `merge_person` is the existing repair for a text-id ghost.**
  `supabase/migrations/20260511000001_merge_person_rpc.sql:146-149` defines
  `merge_person(p_claim_request_id uuid, p_admin_id uuid)` as `SECURITY DEFINER`; it loads
  the claim request at `:188-191`, takes the ghost id from `claim_requests.node_id` at
  `:198` (declared `v_ghost_id text` at `:158`, so a non-uuid ghost is expected), and repoints
  junctions and aliases through to `:567`. Its function comment at `:645-646`: "Resolves an
  approved claim_request by either claiming the ghost in place (Path A) or merging the
  ghost into the claimant's existing canonical row (Path B)." `merge_log` records every
  invocation (`:648-649`). It is editor-gated through `requireEditor()` in the route
  handler, per the header comment at `:140-144`.

- **F54. The sparse-ghost empty state on a person page hides its actions from signed-out
  visitors.** `src/app/people/[id]/page.tsx:666-692`. The comment at `:666-668` names it
  "Sparse-ghost empty state (B-2)". The condition at `:669` is
  `!isCurrentUser && isInvitableNodeStatus(person.node_status) && personClaims.length === 0 && stories.length === 0 && mentions.length === 0`,
  so it fires only when the person has nothing at all. The heading "No entries yet" is at
  `:671`. The body at `:673-674` reads "{display_name} is in the graph because another
  member mentioned them. If you rode with {First}, add a story or claim to help fill in
  their history." The entire action row, the "Add a story" button at `:678-683` whose
  `onClick` is `setShowAddStory(true)` (`:679`) and the "Browse riders" link to `/people`
  at `:684-689`, sits inside `{isAuth && (` at `:676`. So a signed-out visitor gets the
  dashed box, the heading and the copy, and nothing to press. This is T7a.

### 5b. Reported context, NOT verified from code or from the database

Carried from Jay's session notes. Treat as accurate for planning and as unverified for
anything the build depends on. The Drive copies of the sponsorship proposal
(`Fundraising/Linestry-FNRad-Sponsorship-Proposal-2026-07-v5.docx` and four siblings)
are cloud-only placeholders on this machine and could not be opened through the shell,
so none of this was cross-checked against the document.

- **R1.** The sponsorship is $10,000, paid as 50,000 common shares at $0.20. Linestry is
  Season 12 presenting sponsor.
- **R2.** FNRad gives per-episode presenting callouts, an end-of-episode mention of a
  dedicated Linestry page, episode-page links in show notes and transcripts, and an FNRad
  episode about Linestry.
- **R3.** Linestry's side includes the curated FNRad hub, per-episode pages, the mentions
  mapping, chromeless `/t/` links, the transcript workflow, and a weekly community
  challenge tied to each episode. Everything on that list except the weekly challenge has
  shipped. The challenge has no brief, no queue entry and no code, which is why it is in
  this one. The original wording of the commitment named "one rider, event, place, brand or
  board per episode"; episode 1 narrows that to the guest (R8), and D5 builds for the
  narrowing rather than the general case.
- **R4.** The launch equity offer of 100,000 common shares is extended to noon Pacific
  April 30 2027 and opened to FNRad listeners and alumni, with the weekly challenge as
  the on-ramp. The dates and the pool size in R4 DO match the constants in F21.
- **R5.** Erik proposed a sticker-for-signup idea in August. Artwork exists. The idea is
  unanswered.
- **R6.** Episode 21 sits at 53 draft mentions awaiting publish.
- **R7.** Whether the Season 12 intro episode announcing Linestry has dropped is
  unconfirmed. Superseded in part by R8: the deal is announced.
- **R8.** Added September 4 evening. The FNRad deal is ANNOUNCED. Episode 1 drops in one
  to two weeks. Its community challenge asks listeners to ADD A STORY ABOUT THAT EPISODE'S
  GUEST. Jay chose "sign up first, then write" as the on-ramp, over a write-then-signup
  draft model and over anonymous moderated submission (D6). This is the single input that
  caused this revision. The episode-1 guest's identity was not stated, which is why every
  query in section 0 takes it as a parameter.
- **R9.** A companion brief, `features/signup-intent-handoff-brief.md`, is being written to
  carry a destination plus a pending action through the signup chain, and it ships BEFORE
  this one. It did not exist on disk when this revision was written. T7b is the dependency
  and the fallback.

### 5c. AUDIT, could not be checked in this session

- **AUDIT-1.** The FNRad org's actual `public_slug` and whether `public_enabled` is true.
  D3 defaults to `"fnrad"`. Prerequisite 3 is the query.
- **AUDIT-2.** How many episodes are live, and how many published (not draft) mentions
  they carry. Prerequisite 4 is the query. R6 says ep 21 is all drafts, which would mean
  the episode list renders name-less for that episode.
- **AUDIT-3.** Whether any episode has `event_guests` rows at all. **This no longer gates
  the challenge.** Revised D5 keys the card off `FNRAD_CHALLENGE.guestId` (T1), so the
  card renders with no episode record, no guest row and no `event_guests` data anywhere.
  What this audit gates is T8, the guest chips on the public episode view, which have
  nothing to render on an episode with no guests, and T9's guest branch, which falls back
  to naming the episode. Prerequisite 5 is the query.
- **AUDIT-3b.** Whether episode 1's guest has `require_tag_approval` on, and whether that
  guest's id is uuid-shaped. Those are two of the three blocking pre-flight checks in
  section 0 and neither can be answered from the repo. The third, pre-flight 3, WAS
  answered from the repo, so it is a known data fix rather than an unknown. All three stay
  AUDIT until Jay runs them.
- **AUDIT-4.** Whether `Season 12` is derivable from data. It is not, as far as the tree
  shows: there is no season column on `events` and the pass notes say the same
  ("There is NO season model anywhere"). Appendix A therefore writes "Season 12" as
  literal copy in one place only, and the episode list heading says "Episodes", not
  "Season 12", so it does not go stale in Season 13.

---

## 6. Task specs

### T1. `src/lib/fnrad.ts`, campaign constants

New file, about 45 lines, no dependencies. Exports:

```ts
/** The FNRad show's public_slug (orgs.public_slug, org_type='media'). Confirm in
 *  Supabase before trusting this; see the brief's prerequisite 3. */
export const FNRAD_SHOW_SLUG = "fnrad"

/** Ref code the hub's own CTAs carry, and the code the /r route should mint for
 *  the spoken URL once features/funnel-attribution-brief.md ships. */
export const FNRAD_HUB_REF = "fnrad"

/** Per-episode ref code pattern, e.g. fnrad-s12e04. Season is not derivable from
 *  data (see AUDIT-4), so this is a helper for minting codes by hand, not a
 *  read of anything. */
export function fnradEpisodeRef(season: number, episode: number): string {
  return `fnrad-s${season}e${String(episode).padStart(2, "0")}`
}

/** Where the challenge's "Add your story about {guest}" goes. Today: the guest's
 *  page, which already carries a pre-tagged composer for signed-in visitors
 *  (F43). When features/signup-intent-handoff-brief.md ships, swap this body for
 *  its intent builder and delete nothing else. See T7b. */
export function addStoryAboutHref(guestId: string): string {
  return `/people/${guestId}`
}

/** This week's challenge spotlight (D5). Hand-edited. The schema stores nothing
 *  about it, deliberately: there is no challenges table and this brief is not
 *  adding one. See section 14 follow-up 2 for when that stops being the right
 *  trade.
 *
 *  guestId is the ONLY required field. It is a person or profile id and it is
 *  what BOTH surfaces resolve for the spotlight: the hub and the public episode
 *  page. Null guestId means no challenge card anywhere, with no empty state
 *  (D5 render state 3).
 *
 *  episodeSlug and episodeLabel are OPTIONAL and arrive later, when the episode
 *  page exists. episodeSlug is the episode's `public_slug`, NOT its id, because
 *  the only thing it feeds is the /t/{slug} href in Appendix A
 *  [challenge-action-hub-secondary]. episodeLabel is what the
 *  [challenge-kicker-hub] line prints. Both the kicker and the secondary link
 *  are hidden when episodeSlug is null; turning them on later is an edit to
 *  these two lines and a deploy. */
export const FNRAD_CHALLENGE = {
  guestId: "<person or profile id>",   // REQUIRED. No id, no card, anywhere.
  guestName: "Ingemar Backman",        // display fallback if the node is unreadable
  episodeSlug: null,                   // OPTIONAL. The episode's public_slug. Fill in later.
  episodeLabel: null,                  // OPTIONAL. "FNRad S12 E01"
} as const
```

`guestId` is the value both of section 0's runtime pre-flight checks take as their
parameter, and it is the value `readIntent` will reject outright if it is not uuid-shaped
(T7b). Confirm it against a real row before the episode drops: what ships in the file is a
placeholder, and a placeholder resolves to nobody.

`guestName` is a DISPLAY fallback and nothing else. The card resolves `guestId` to a real
person and prints that person's `display_name`; `guestName` is what it prints if the node
read comes back empty, so the copy never renders "Add your story about undefined". It must
never become the link. The link always uses `guestId`.

One TypeScript note. `as const` narrows `episodeSlug` and `episodeLabel` to the literal
type `null`, which is the point: filling them in is an edit to this file, not something a
caller can do at runtime. If that narrowing fights the card's props (T5), widen the two
fields with an explicit annotation such as `episodeSlug: null as string | null` rather than
dropping `as const` and losing the narrowing on `guestId` along with it.

Copy lives in the page, not here.

### T2. `readShowHub()` in `src/lib/public-timeline-read.ts`

One new exported async function, appended near `readOrgStack`. It goes in this file and
not a new one because `resolveEntities` (`:266`) and `mentionSubjectName` (`:1498`) are
module-private, and re-exporting them to serve one caller is a worse trade than adding
fifty lines here.

```ts
export interface ShowHubEpisode extends PublicShowEpisode {
  /** Resolved names from this episode's PUBLISHED mentions, in read order,
   *  deduped by subject. Empty when the episode has no published mentions. */
  mentionNames: { id: string; name: string; href: string | null }[]
  /** Total distinct published-mention subjects, so the view can say "and N more". */
  mentionTotal: number
}

export interface PublicShowHubPayload {
  owner: PublicTimelineOwner
  episodes: ShowHubEpisode[]
}

export async function readShowHub(slug: string): Promise<PublicShowHubPayload | null>
```

Behaviour:

1. `const show = await readOrgStack({ slug, requireEnabled: true })`. Null in, null out.
   Take `owner` and `episodes` from it. `episodes` is already live-only and newest first
   (F8), so do not re-sort and do not re-filter.
2. Collect `liveIds = show.episodes.filter(e => e.live && e.slug).map(e => e.id)`. An
   episode with no `public_slug` has no page to link to, so it is not listed (this
   matches what `PublicShowView` already does at `public-show-view.tsx:37`). If `liveIds`
   is empty, return `{ owner: show.owner, episodes: [] }`.
3. One query for every published mention across those episodes:
   ```ts
   const { data } = await db.from("mentions")
     .select("id, episode_event_id, subject_type, subject_id")
     .in("episode_event_id", liveIds)
     .eq("status", "published")
     .order("timestamp_seconds", { ascending: true, nullsFirst: false })
     .order("created_at", { ascending: true })
   ```
   Same order as `readPublishedMentions` (F9), so the hub lists names in listening order.
   **Published only. There is no editor override on this read**, matching the deliberate
   choice in `mentions-server.ts:20-23`.
4. Bucket the subject ids by type and resolve them in ONE pass:
   `await resolveEntities(db, [], [], { person, place, event, org, board })`.
5. Per episode, map its rows through `mentionSubjectName(type, id, entities)`, dedupe on
   `subject_type + subject_id` (an entity named at three timestamps is one name in the
   list), drop any whose resolved name equals the raw subject id (F20: that is the
   unresolved fallback and it must not be printed), and compute the href with the same
   rule as D8 and T4 below. Set `mentionTotal` to the deduped count and `mentionNames`
   to the first 8.
6. Wrap the whole body so a thrown query cannot take down the page: on any error return
   `{ owner: show.owner, episodes: show.episodes.map(e => ({ ...e, mentionNames: [], mentionTotal: 0 })) }`.
   A hub with an episode list and no names is a degraded page; a hub that throws is a 500
   on a URL being read out on a podcast.

Pseudocode above is written against the real schema and the real helper signatures, but
the exact PostgREST call shape should be eyeballed against `readPublishedMentions` before
running.

### T3. `src/lib/mention-links.ts`, one shared href helper

New file, about 25 lines. Both T2 and T4 need "given a mention subject type and id, where
does it go", and duplicating it in the reader and the view is how the two drift.

```ts
export function mentionHref(
  type: MentionSubjectType,
  id: string,
  entities: PublicTimelineEntities,
): string | null
```

- `person` to `/people/{id}`
- `place` to `/places/{placeSlug(place)}` when the place resolves, else `/places/{id}`
- `event` to `/events/{eventSlug(event)}` when the event resolves, else `/events/{id}`
- `board` to `/boards/{boardSlug(board)}` when brand and model both resolve, else `/boards/{id}`
- `org` to `/brands/{orgSlug(org)}` when it resolves, else `null`
- anything unresolved: `null`

Paths are BARE and community-scoped, which is correct on a chromeless page (F19). This
mirrors `stackHref` (F18) plus the org case; do NOT refactor `stackHref` to call it
(out of scope, item 12).

### T4. Mention names become links on the public episode page

`src/components/public-timeline/public-mention-group.tsx`, the chip loop at `:66-74`.

Wrap each chip in a `next/link` when `mentionHref` returns a path, keeping the exact
existing chip classes so the visual does not change, and leaving it as the current
`<span>` when the href is null. Add a subtle affordance so a linked chip reads as
tappable: `hover:bg-white/15 transition-colors` on the link variant only.

`PublicMention` (`src/lib/public-timeline-read.ts:1107`) already carries `subject_type`
and `subject_id`, so the group has everything it needs. It does NOT carry the resolved
entities, so either pass a precomputed `href` down (preferred: compute it in
`readEventStack` where entities are in hand at `:1447-1455` and add one `href: string | null`
field to `PublicMention`), or thread `entities` into the component. Prefer the payload
field: the public views are store-free by design and adding a resolved value to the
payload is the pattern the file already follows.

Do the same for `public-mention-row.tsx:145-153` so the ungrouped twin does not drift.

### T5. `ChallengeCard`, shared by the hub and the public episode page

New `src/components/fnrad/challenge-card.tsx`. Server component. It has no interactive
part of its own: everything it does is a link, which is the whole reason the guest-story
challenge is cheaper to render than the mark-based one it replaced.

Input:

```ts
export interface ChallengeGuest {
  id: string
  display_name: string
  avatar_url: string | null
}

export function ChallengeCard(props: {
  /** The ONE person from FNRAD_CHALLENGE.guestId, already resolved by the
   *  caller. Non-optional: "no guest" is expressed by not mounting the card. */
  guest: ChallengeGuest
  mode: "hub" | "episode"
  /** Hub mode only, and OPTIONAL: the episode's public_slug, straight from
   *  FNRAD_CHALLENGE.episodeSlug. Null until the episode page exists. */
  episodeSlug?: string | null
  /** Hub mode only, and OPTIONAL: straight from FNRAD_CHALLENGE.episodeLabel.
   *  Rendered only when episodeSlug is also set. */
  episodeLabel?: string | null
}): React.ReactElement
```

`ChallengeGuest` is a structural subset of `PublicPersonLite`
(`src/lib/public-timeline-read.ts:25-30`: `id`, `display_name`, `avatar_url`,
`node_status`), so a resolved person satisfies it with no mapping and no cast. Declare the
narrow shape rather than importing the wide one, so this leaf component does not acquire a
dependency on the reader.

**Where the guest comes from.** One place, on both surfaces: `FNRAD_CHALLENGE.guestId` in
`src/lib/fnrad.ts` (D5, T1). The caller resolves that one id to one person and passes the
result in. The card never takes a list, never indexes `meta.guests`, and never picks
between candidates, so there is no helper here that chooses a guest. There is nothing to
choose between. That is what makes the hub and the episode page structurally unable to
disagree about who this week's challenge is about: they read the same constant, not two
different episodes' guest rows.

**The three D5 render states, in component terms.** All three have to be correct on day
one, and the first is the one that actually ships.

1. **`guestId` set, `episodeSlug` null or absent.** The card renders in full: the section
   label, the guest's avatar and name, the ask, the body, the primary action and the
   signup note. The "From {episode-title}" kicker and the "See the episode" secondary are
   BOTH absent, with no gap where they were and no placeholder text standing in for them.
   **This is the episode-1 launch state. Build it first, smoke it first (A8a), and treat
   the other two states as variations on it.**
2. **`guestId` set, `episodeSlug` set.** Identical, plus the kicker printing
   `episodeLabel` and the secondary linking `/t/{episodeSlug}`. `episodeSlug` is the
   switch for BOTH: render neither unless it is a non-empty string, so a label that
   arrives without a slug cannot produce a kicker naming an episode nobody can open.
   Getting from state 1 to state 2 is two lines in `src/lib/fnrad.ts` and a deploy, and
   A8b is the check that it stayed that cheap.
3. **`guestId` null.** The card is not rendered at all. Enforce this at the CALL SITE, in
   T6 step 5 and in the episode-page pass, not inside the component: the `guest` prop is
   non-optional on purpose, so "no guest" is expressed by not mounting the card. No empty
   box, no placeholder, no "check back next week". See Appendix A `[challenge-empty]`.

If `guestId` is set but resolves to nothing, print `FNRAD_CHALLENGE.guestName` as the
display name and still link the primary action to
`addStoryAboutHref(FNRAD_CHALLENGE.guestId)`. That is the only job `guestName` has (T1),
and it must never become the link.

Renders, in both modes:

- The section label "THIS WEEK'S CHALLENGE" (Appendix A `[challenge-label]`) in the small
  uppercase tracking-widest style the `/t/` pages already use for section labels
  (`public-episode-view.tsx:162`). This is always present and is not the same thing as the
  conditional hub kicker below.
- The guest's avatar and name, matching the treatment the guest chips already use on the
  same page (`GuestAvatar` at `public-episode-view.tsx:40`). Do not build a second avatar
  language.
- The ask and the lines under it, copy in Appendix A section A1, under
  `[challenge-ask]` through `[challenge-kicker-hub]`.

Then it differs:

- **episode mode:** the primary action, "Add your story about {FirstName}" (Appendix A
  `[challenge-action]`), routed per T7b, with the signup note
  (`[challenge-signup-note]`) directly under it. Then the quiet secondary "Or open their
  page" (`[challenge-action-episode-secondary]`) to `/people/{guest.id}`, bare and
  community-scoped (F19), for the visitor who wants to see who this person is before
  committing to anything.
- **hub mode:** the same primary action, plus, ONLY when `episodeSlug` is a non-empty
  string, a kicker printing `episodeLabel` and a link reading "See the episode" to
  `/t/{episodeSlug}`. The kicker names the episode so a listener who is one week behind is
  not confused about which challenge they are reading. When there is no episode yet, which
  is the launch state, both are simply absent and the card is complete without them.

**Reads, per surface.** Neither surface reads `event_guests` for the challenge:

- **The hub** resolves `FNRAD_CHALLENGE.guestId` to one person and passes it in (T6 step
  5). One read, and it does not touch the episode. It does not call `readEventStack` at
  all for this.
- **The public episode view** does the same thing, from the same constant. It already
  holds `meta.guests` in its payload for the guest header (F37, T8), and it must NOT use
  that array for the challenge. Doing so is precisely how the two surfaces start naming
  different people, and it is a build of the superseded design. A8c is the check.

**Do not render an `IWasThere` panel, a "mark" button, or any anonymous affordance here.**
A rider is not a taggable moment (F41) and this brief does not add one. See out-of-scope
items 2, 3 and 4.

### T6. `src/app/fnrad/page.tsx`, the hub

Server component. `export const metadata` per Appendix A section A3. Structure top to
bottom, copy in Appendix A section A1:

1. **Header.** Brand mark linking `/`, exactly as `public-episode-view.tsx:25-38` does it.
2. **Kicker + H1 + lead paragraph.** The one-screen answer to "what is this".
3. **Primary CTA row.** "Start your timeline" to `/onboarding?ref=fnrad`, and a quiet
   secondary "Look around first" to `/snowboarding`. Two actions maximum, the primary
   visually dominant. This is the only place on the page with two.
4. **The three-line "what is in it for you" list.** Three short lines, no icons, no
   cards. See Appendix A.
5. **This week's challenge.** `ChallengeCard` in hub mode, fed from
   `FNRAD_CHALLENGE.guestId` (D5, T1). Resolve that one person id directly, one read, and
   pass the result to the card together with `FNRAD_CHALLENGE.episodeSlug` and
   `FNRAD_CHALLENGE.episodeLabel` exactly as they stand, null included. The card decides
   what to do with a null slug (T5); this page does not branch on it.

   **The hub does NOT read the episode for this and does not need one to exist.** Do not
   call `readEventStack` here, do not derive the guest from the newest live episode, and
   do not query `event_guests` for any episode. The September 4 evening draft did all
   three; revised D5 removed the reason to, and removing that round trip is most of why
   this revision costs nothing (risk 6).

   When `guestId` is null, render nothing at all in this position: no empty box, no
   placeholder (Appendix A `[challenge-empty]`). This section is fully independent of
   `readShowHub`, so it renders even when the show slug does not resolve and the episode
   list below is absent.
6. **Episodes.** Heading "Episodes" (not "Season 12", see AUDIT-4), copy in Appendix A
   `[episodes-label]`. One row per episode from `readShowHub`: title, "Episode N", year,
   then the names line. The row title links to `/t/{slug}`, by `public_slug` and never by
   id, which is the same addressing `FNRAD_CHALLENGE.episodeSlug` uses (D5).

   The names line has two forms and both have locked copy:
   - **Names present.** Print the prefix from Appendix A `[episode-names-prefix]` ("Named
     in this one:"), then `mentionNames` as a wrapped row of links, then
     `[episode-names-more]` ("and {N} more") when `mentionTotal > mentionNames.length`.
   - **No names.** Print `[episode-no-names]` ("Not indexed yet.") in the muted style, in
     place of the WHOLE names line, prefix included. Never print the prefix with nothing
     after it. This is the ep-21 case today (R6, AUDIT-2): a live episode whose 53
     mentions are all drafts lists with no names, and one honest line reads better than a
     blank.

   When `episodes` is empty, render nothing at all (not an empty state): a listener does
   not need to be told the list is empty.
7. **Equity block.** Three sentences reading `EQUITY_POOL_SHARES`,
   `EQUITY_SNAPSHOT_LABEL`, `EQUITY_SNAPSHOT_TIME_LABEL` from `@/lib/equity-offer`, and
   a link to `/equity`. Never a literal date. See D10.
8. **Footer.** "Powered by Linestry" brand mark linking home, a link to `/word`, and the
   three legal links (`/privacy`, `/terms`, `/data-deletion`) matching
   `src/app/page.tsx:137-141`.

**Degraded render.** When `readShowHub` returns null (AUDIT-1: wrong slug, or the show is
not published), section 6 is absent and everything else renders, **section 5 included**.
The page returns 200. Never `notFound()`.

Section 5 no longer depends on the episode list, on an episode record existing, or on
`event_guests` (AUDIT-3). The only thing that removes it is `FNRAD_CHALLENGE.guestId`
being null, which is a deliberate config state rather than a data accident, and in that
state the whole card is absent rather than empty. Absent beats wrong. The hub still must
never reach back for an older episode's guest to fill space, because the podcast said
"this week" and the constant is what says which week it is.

### T7. Attribution: state the dependency, do not build it

**What this PR does:** the hub's own outbound links carry a static `?ref=fnrad` query
parameter (from `FNRAD_HUB_REF`, T1). That is a string in an href. It is inert today and
it is exactly what `/r/[code]` will preserve tomorrow.

**Codes the FNRad campaign needs**, to be minted by the attribution brief, not here:

| Code | Spoken as | Destination | Purpose |
|---|---|---|---|
| `fnrad` | "slash R slash F N Rad" | `/fnrad` | The hub code, for the on-air callout |
| `fnrad-s12e01` .. `fnrad-s12eNN` | not spoken, pasted | `/t/{episode-slug}` | One per episode, for show notes and the transcript |
| `fnrad-challenge` | optional | `/fnrad` | If the challenge ever gets its own callout |

Per-episode codes follow the pattern in `fnradEpisodeRef()` (T1), which is the same
pattern the attribution brief's own worked example uses (F23), so nothing has to be
reconciled later.

**If the attribution brief has NOT shipped when this one does**, and it may not have:

- Nothing here breaks. `/fnrad` works, the episode pages work, the CTAs work.
- `/r/fnrad` will 404 until that route exists, so **do not print `/r/fnrad` anywhere on
  the page or in any copy in Appendix A**, and tell Jay not to say it on air yet. The
  spoken URL for now is `linestry.com/fnrad`.
- Measurement degrades to PostHog pageviews on `/fnrad` and on each `/t/{episode}` page,
  which are captured automatically (F25). For a first campaign week that answers the only
  question that matters: did anyone arrive.
- When attribution does ship, wiring the hub costs one line: add `attributionProps()` to
  whatever event that brief chooses. It is not this brief's job and it is not this
  brief's PR.

### T7a. The sparse-person empty state, which is what episode 1 actually lands on

**Added September 6 2026. Jay is populating Ingemar's page from scratch and says it is
"very empty now", which makes this the day-one state, not an edge case.**

`src/app/people/[id]/page.tsx:666-692` (F54) swaps the whole feed body for a sparse empty
state when a person is invitable AND has zero claims, zero stories and zero mentions
(the condition at `:669`). Three things are wrong with it for this campaign, and all three
are visible to the first listener who arrives:

1. **Its actions are gated on `isAuth`** at `:676` (F54). A logged-out visitor gets a
   dashed box reading "No entries yet" with NOTHING to click. That is the single most
   likely first impression of the whole sponsorship: the podcast says go add your stories,
   and the page offers no way to. T2.2 of the handoff brief puts a signed-out CTA higher
   on the page, which rescues the visit, but this box still sits underneath it saying come
   back later.
2. **Its copy contradicts its own condition.** At `:673-674` it reads "{name} is in the
   graph because another member mentioned them", but the state only renders when
   `mentions.length === 0` (`:669`). It also will not be true here: Jay is creating this
   node deliberately, ahead of any mention.
3. **It self-heals, which is why it is easy to miss.** The moment the S12 E01 mentions are
   imported, `mentions.length > 0` and this state stops firing forever. So it will look
   fine in every test done after content lands, and broken only in the window that matters.

**Do:** delete the `isAuth &&` gate at `:676` so the action row renders for everyone, and
route the primary action through the same `addStoryAboutHref` (T1, T7b) that the challenge
card and T9 use, so there is exactly one place in this feature where the destination is
decided. Signed in, the button keeps the behaviour it has today, opening the composer
directly through `setShowAddStory(true)` (`:679`, and the composer is already pre-tagged,
F43). Signed out, it is a link to `addStoryAboutHref(resolvedId)`. Rewrite the copy so it
does not assert a mention that is not there. Keep "Browse riders" as the secondary for
everyone. Copy is in Appendix A under `[sparse-empty]`, and A12e is the check.

**Do not:** remove the state, change when it fires, or open anything else in this file.
T7b's prohibition still stands over the signed-out CTA button row that the handoff brief's
T2.2 owns; this block is a different block, lower down, inside the feed body. An empty page
needs an empty state; this one just needs to work for the people it was hiding from.

---

### T7b. The signup intent handoff: the dependency, and what ships without it

**The companion brief `features/signup-intent-handoff-brief.md` is the critical path and it
ships BEFORE this one.** It landed on disk after this revision started, so its contract is
read and cited below rather than guessed. It is 979 lines, it has its own D1 to D11 and its
own T1 to T6, and its section 1 states the same deadline this brief does.

**Why it exists.** The signup chain drops the destination at every hop. A signed-out visitor
on a person page does not even see an add-story button (F43 is the signed-in branch, gated at
`page.tsx:415`). `/auth/signin` carries `returnTo` through every method it has except the
bare `<Link href="/onboarding">` that a first-timer clicks, and the FTUE OAuth and magic-link
calls each drop it again (F44). `/auth/complete` then falls back to the new member's own
empty profile. That brief closes all of it.

**Its contract, as of the version on disk.** Cited so this brief's surfaces match it exactly:

- The wire format is a plain internal URL with reserved query params:
  `/people/<personId>?intent=add-story&subject=<personId>`, and that whole string is what gets
  URL-encoded into `?returnTo=`. There is no second transport (its D1).
- `src/lib/intent.ts` exports `encodeIntent({ path, action, subject })`, `readIntent`,
  `stripIntent` and `INTENT_ACTIONS = ["add-story"] as const` (its T1). `add-story` is the only
  action in v1 (its D2).
- The href a caller emits is built in two steps, per its T2.2:

  ```ts
  const intentHref = encodeIntent({ path: `/people/${id}`, action: "add-story", subject: id })
  const signupHref = `/auth/signin?returnTo=${encodeURIComponent(intentHref)}`
  ```

  Destination is `/auth/signin`, NOT `/onboarding`, and that is load-bearing: signin serves a
  returning member and a first-timer from one href, while the FTUE save step has no sign-in
  affordance at all (its D5).
- Its **T2.2 puts that exact link on `/people/[id]` itself**, for signed-out visitors, labelled
  "Add your story about {First}". So once it ships, the guest's page IS the on-ramp.
- Its **T5 replays on arrival**: on the person page, when the viewer is authed and
  `readIntent(...).subject === resolvedId`, it clears the params with `router.replace` and
  opens the composer, which already passes `riderIds: [resolvedId]` (F43).
- **`readIntent` rejects a `subject` that is not uuid-shaped** (its T1, the same regex as
  section 0 pre-flight 2). A non-uuid guest therefore loses the intent silently and degrades
  to a plain navigation. That is a THIRD independent reason to run pre-flight 2, and it is the
  one that fails most quietly of the three.

**This brief is NOT blocked by it.** The FNRad surfaces are built once, against one helper in
`src/lib/fnrad.ts` (T1), and that helper degrades:

```ts
/** Where "Add your story about {guest}" goes.
 *  Today: the guest's page. Once features/signup-intent-handoff-brief.md has
 *  shipped, that page carries the intent CTA itself (its T2.2) and the replay
 *  (its T5), so this body may stay as it is, or short-circuit by emitting the
 *  intent directly. See this brief's T7b. */
export function addStoryAboutHref(guestId: string): string {
  return `/people/${guestId}`
}
```

- **If the handoff has NOT shipped:** the call to action goes to `/people/{guestId}`. That page
  already carries the guest's name, their claim affordance ("This is me", F34), and, the moment
  the visitor is signed in, an "Add story about {FirstName}" button that opens the composer
  pre-tagged with `riderIds: [guestId]` (F43). The listener lands in exactly the right place;
  they just have to make an account in between, and the copy says so plainly rather than
  pretending otherwise (Appendix A1, `[challenge-signup-note]`). This path works today, it
  404s for nobody, and it needs no new code beyond the href.
- **If the handoff HAS shipped:** nothing here has to change at all, because its T2.2 puts the
  intent link on the destination page. Optionally short-circuit one hop by returning
  `/auth/signin?returnTo=...` from `addStoryAboutHref` directly, using `encodeIntent` from
  `@/lib/intent`. One function body, no surface changes, no copy changes. Do that only after
  its PR is merged, and re-read its T1 first in case the param names moved.

**Do not build any part of the handoff in this PR.** Not a `returnTo` on `/onboarding`, not
`src/lib/intent.ts`, not a change to `save-step.tsx`, `sign-in-prompt.tsx` or `proxy.ts`, and
not `/people/[id]`'s SIGNED-OUT CTA BUTTON ROW, which is the handoff brief's T2.2 and is its
to build. That is the other brief's work and it has its own security section (its section 10)
and its own auth-path review.

**One carve-out, and it is precise.** T7a of THIS brief DOES change
`src/app/people/[id]/page.tsx`, and that is in scope here. The two do not collide because
they are different blocks in different parts of the page. T2.2 adds a signed-out CTA in the
page's action area, near the claim affordance. T7a un-gates and rewrites the sparse-ghost
empty state at `:666-692` (F54), which sits inside the feed body and renders only when the
person has zero claims, zero stories and zero mentions. **T7a's sparse-empty-state block is
IN SCOPE in this PR; the signed-out CTA button row is not.** The two share exactly one thing,
on purpose: `addStoryAboutHref` (T1), so the destination is decided once. If the handoff has
already merged when T7a is built, read its T2.2 first and match its label and its href rather
than inventing a second spelling of the same link. Apart from T7a, this brief's entire contact
with the handoff is the one function above. A16 and A12e are the checks.

**If this brief somehow ships FIRST**, which it should not, nothing breaks: every listener still
reaches the guest's page, and the conversion is worse until the handoff lands.

The companion brief's section and task numbers above were read from the version on disk,
979 lines as of September 6 2026, and they are correct as cited, so the AUDIT hedge that
stood on this line is struck (prerequisite 6). They can still move before it merges, so
re-read it before building T5, T7a and T9.

### T8. Guest chips become links on the public episode view

`src/components/public-timeline/public-episode-view.tsx`, the guest block at `:121-135`.

Today each guest is a plain `<div>` with an avatar and a name and no href (F39), while the
in-app twin has been a `next/link` to `/people/{id}` the whole time (F38). Close the gap:
wrap each chip in a `next/link` to `/people/{g.id}`, keeping the exact existing chip
classes so the visual does not change, and adding `hover:bg-white/10 transition-colors` so
a linked chip reads as tappable. Bare community-scoped path, per F19 and the same rule T3
and T4 follow.

Give the link an accessible label, because the visible text is a bare name and a screen
reader arriving at it out of context gets nothing useful: emit `aria-label` from Appendix A
`[episode-guest-link-label]` ("{Guest}, on Linestry"). The visible text does not change.

There is no unresolved case to guard: `readEventStack` already drops any guest id that
does not resolve to a person before it reaches `meta.guests` (F37), so every chip that
renders has a real person behind it. Note that `meta.guests` is the right source HERE and
only here: this block is the episode's own guest header, not the challenge, and revised D5
explicitly leaves it alone.

This is five lines and it is the difference between a listener reaching the guest and not.

### T9. The in-app logged-out CTA learns where the visitor is standing

`src/components/events/episode-page.tsx:426-430`.

Today: "Join Linestry to add what you know about this episode", linking to `/` (F42). It
knows the episode. It knows the guests. It sends the visitor to the front door with none
of it.

Change it to point at the challenge, using the same `addStoryAboutHref` helper from T7b,
with the guest taken from that page's already-loaded `guests` array. Copy in Appendix A
section A2b. When the episode has no guest, keep a sentence naming the episode and link to
the episode's own public page rather than to `/`, so the fallback is still specific.

Keep the change inside that one paragraph. Do not touch `isAuth`, the guest chips, the
editor controls or anything else in the file. Out-of-scope item 10 draws the line and this
task is its only exception.

---

## 7. Surface pairing (playbook check 12)

| Thing | Trigger | Affordance | Lands where |
|---|---|---|---|
| `/fnrad` hub | Spoken callout on air, or an FNRad bio link | Whole page | New route, T6 |
| Hub primary CTA | Reading the first screen | "Start your timeline" button | `/onboarding?ref=fnrad` |
| Hub secondary CTA | Not ready to sign up | "Look around first" link | `/snowboarding` |
| Hub challenge card | Scanning for this week's ask | The ask + "Add your story about {Guest}" | `addStoryAboutHref(FNRAD_CHALLENGE.guestId)`, T7b |
| Hub challenge card, secondary | Wants the episode first | "See the episode" link, ABSENT until there is an episode | `/t/{FNRAD_CHALLENGE.episodeSlug}` |
| Hub episode row title | Looking for a specific episode | Link | `/t/{episode-slug}` |
| Hub mention name | Heard a name, scanning for it | Link | `/people/{id}`, `/places/{slug}`, `/events/{slug}`, `/boards/{slug}`, `/brands/{slug}` |
| Hub equity block | Wondering what the shares thing was | "How the share pool works" link | `/equity` |
| Episode listener strip | Arrived mid-listen from show notes | One sentence + "Start your timeline" | `/onboarding?ref=fnrad` |
| Episode challenge card | Same visitor, further down | "Add your story about {Guest}", the same person as the hub's | `addStoryAboutHref(FNRAD_CHALLENGE.guestId)`, T7b |
| Episode challenge card, secondary | Wants to see who the guest is | "Or open their page" link | `/people/{guest-id}` |
| Episode guest chip | Heard the guest's name, sees their face | Link (new, T8) | `/people/{guest-id}` |
| Episode mention name | Heard a name in this episode | Link (new, T4) | Same five entity routes |
| Episode footer CTA | Reached the bottom | "Start your timeline" (was "Explore the snowboarding graph") | `/onboarding?ref=fnrad` |
| In-app episode CTA, logged out | Arrived at the app-side episode page | "Add your story about {Guest}" (was "Join Linestry", pointing at `/`) | `addStoryAboutHref(guestId)`, T9 |
| Guest's page, signed out | Followed the challenge, no account yet | "This is me" claim, plus the signup entry | `/people/{id}` claim path (F34) |
| Guest's page, signed in | Followed the challenge, has an account | "Add story about {FirstName}" (already ships, F43) | `AddStoryModal` pre-tagged `riderIds: [guestId]` |
| Guest's page, sparse and signed out | Followed the challenge to a page with nothing on it yet, which is episode 1's actual state | "Add your story about {First}" in the empty state, now rendered for everyone (new, T7a) | `addStoryAboutHref(guestId)`, T7b |
| Guest's page, sparse and signed in | Same page, has an account | Same action, opens the composer directly (F43) | `AddStoryModal` pre-tagged `riderIds: [guestId]` |

No new endpoints. Every row above is either a link or an already-shipped affordance, which
is the whole point of D5 through D7.

Every row that names a guest names the SAME guest, `FNRAD_CHALLENGE.guestId`, which is
what makes this table checkable at acceptance: if two surfaces ever name different people,
one of them is deriving the guest from `meta.guests` and revised D5 says neither should
(A8c). The one row that is not yet as short as it should be is the signed-out listener's,
and shortening it is the companion brief's job (T7b), not this one's.

---

## 8. Acceptance criteria

- **A1.** `npx tsc --noEmit` clean. ESLint clean.
- **A2.** `/fnrad` returns 200 signed out, in a private window, with no console errors.
- **A3.** The first screen at 375px width answers all four questions without scrolling
  past the primary CTA: what this is, why a snowboarder should care, what is in it for
  them, and what to do next. Check on a real 375px viewport, not a desktop resize alone.
- **A4.** 0px horizontal overflow at 375px, 414px and 1440px on `/fnrad` and on a public
  episode page.
- **A5.** The episode list shows only live episodes. Verify by temporarily setting one
  episode's `publish_at` to a future timestamp through the episode page's schedule
  control, reloading `/fnrad`, confirming it disappears from the list AND from the page
  source (view source, search the title), then restoring it.
- **A6.** No draft mention name appears anywhere on `/fnrad` or on a public episode page,
  signed out OR signed in as an editor. Use the ep-21 drafts (R6) as the test set.
- **A7.** Every mention name rendered on `/fnrad` and on a public episode page either
  links to a real page that returns 200, or is unlinked plain text. Click at least one of
  each of person, place, board and brand. No name renders as a raw generated id
  (`evt_...`, `org_...`).
- **A8a. THE LAUNCH STATE. Smoke this one first, before A8b and A8c.** With
  `FNRAD_CHALLENGE.guestId` set to a real person and `episodeSlug` and `episodeLabel`
  BOTH null, the challenge card renders in full on `/fnrad` AND on a public episode page,
  and both name the SAME person, read from the constant. The "From {episode-title}" kicker
  is absent and the "See the episode" secondary is absent, with no gap and no placeholder
  where they were (D5 state 1; Appendix A `[challenge-kicker-hub]` and
  `[challenge-action-hub-secondary]`). The ask, the body, the primary action and the
  signup note are all present, and the primary action goes to
  `addStoryAboutHref(FNRAD_CHALLENGE.guestId)`. Confirm the card renders with NO episode
  record for that guest and NO `event_guests` row naming them anywhere: that is the actual
  state in September and it must not blank the card.
- **A8b. Adding the episode later costs two lines.** Set `episodeSlug` to a live episode's
  `public_slug` and `episodeLabel` to its label, change nothing else, and reload. The
  kicker now prints the label and the secondary now links `/t/{episodeSlug}` and returns
  200 (D5 state 2). Confirm the diff between A8a and A8b is TWO LINES in
  `src/lib/fnrad.ts` and nothing else: no component change, no migration, no read added.
  Then set `episodeLabel` while leaving `episodeSlug` null and confirm that NEITHER the
  kicker nor the secondary appears, because `episodeSlug` is the switch for the pair (T5,
  D5). Restore both to null afterwards.
- **A8c. No guest, no card. And the card does not follow `event_guests`.** Set `guestId`
  to null and reload: the challenge card is absent from the hub and from every public
  episode page, with no empty box, no placeholder and no "check back next week" (D5 state
  3, Appendix A `[challenge-empty]`). Everything else on both pages still renders and both
  still return 200. Restore the real id afterwards. Then, with the real id restored,
  reorder and remove an episode's guests through the editor path behind
  `PUT /api/events/[id]/guests` (F36) and confirm the challenge card changes on NEITHER
  surface. A card that follows a guest reorder is a build of the superseded design and it
  fails this criterion. The episode page's own guest CHIPS should change, because those
  are T8 and they still read `event_guests`.
- **A9. The episode-1 listener path, end to end, signed out, in a private window.** This
  is the contractual loop and the one criterion that matters most. It must be exercised,
  not assumed. Walk it exactly as a listener would, with a throwaway email:
  1. Start at `linestry.com/fnrad`, as if the callout was just read on air. Read the
     challenge card. It names a real person and asks for a story about them.
  2. Press "Add your story about {Guest}". Confirm where you land: the guest's page if the
     handoff has not shipped, the pre-tagged composer if it has (T7b). Either is a pass;
     landing on `/`, on a community feed, or on a 404 is a fail.
  3. Separately, start at the PUBLIC episode page `/t/{episode-slug}`, as if arriving from
     show notes. Confirm the guest's name and face are there, that the chip is a LINK
     (T8), and that the challenge card's call to action is present. If the S12 E01 episode
     record does not exist yet, which is the expected state in September, run this step
     against any live episode: the challenge card reads the constant, so it renders on
     every public episode page regardless of who that episode's own guests are (D5, A8a).
  4. Create an account from that point and get all the way to a published story tagged to
     the guest. Note honestly how many screens it took and whether the guest was still
     pre-tagged on arrival. If the handoff has not shipped, expect the intent to be lost
     in the middle: record that, do not paper over it.
  5. Open the guest's page `/people/{guestId}` signed out, in a fresh private window, and
     confirm the story is VISIBLE there with no approval step. If it is not, the guest has
     `require_tag_approval` on and pre-flight 1 was skipped (section 0, F46).
  6. Confirm the story's rider tag actually landed rather than silently failing, which is
     what pre-flight 2 guards (section 0, F51).
- **A9b.** Nothing in the diff writes a story, a tag or any row from an unauthenticated
  request. Grep the diff for `requireAuth`, for `/api/public/tag`, and for `fetch(` inside
  the new components: there should be no write call anywhere in this feature. D6.
- **A10.** With `FNRAD_SHOW_SLUG` deliberately set to a nonexistent value, `/fnrad` still
  returns 200 and still renders the explainer, the CTA, the equity block and the footer.
  Restore the value afterwards. This is the D3 failure mode and it is the single most
  important test in this list.
- **A11.** The equity block prints 100,000, "April 30, 2027" and "12:00 noon Pacific"
  read from `@/lib/equity-offer`. Grep the diff: no literal "2027" and no literal
  "100,000" in the page file.
- **A12.** The listener strip renders on every public episode page, and the footer CTA
  there now reads "Start your timeline".
- **A12b.** Every guest chip on the public episode page is a link to `/people/{id}` that
  returns 200 and shows the right person (T8). Check an episode with two or more guests
  and an episode with one. Compare against the in-app episode page, which has always
  linked them (F38): the two surfaces must now agree.
- **A12c.** Signed out on the IN-APP episode page, the call to action no longer reads
  "Join Linestry to add what you know about this episode" and no longer links to `/` (T9,
  F42). It names the guest and carries the destination. On an episode with no guest it
  names the episode and links to that episode's public page, never to `/`.
- **A12d.** No file under `src/components/public-timeline/stack-entry-card.tsx`,
  `i-was-there.tsx` or `stack-view.tsx` is modified. The existing anonymous "I was there"
  marks on place, event and story entries still open, still submit and still reach the
  "check your email" state on an episode that has such an entry. This feature sits beside
  that loop and must not disturb it. Out-of-scope item 4.
- **A12e.** Signed out, in a private window, on a SPARSE person page (a person with no
  claims, no stories and no mentions, which is Ingemar's page today), the empty state shows
  an action row rather than a dead dashed box (T7a, F54). The primary action reads "Add
  your story about {First}" and goes to `addStoryAboutHref(personId)`, the same destination
  the challenge card and T9 use. "Browse riders" is still there for everyone and still goes
  to `/people`. The copy no longer says the person "is in the graph because another member
  mentioned them", which was never true in this state (Appendix A `[sparse-empty]`). Then
  open the same page signed in and confirm nothing regressed: the primary still opens the
  composer pre-tagged with `riderIds: [personId]` (F43). Note that this state self-heals
  the moment any mention lands on that person, so test it BEFORE importing the S12 E01
  mentions or you will not be able to see it at all.
- **A13.** No em dashes and no en dashes anywhere in the diff, page copy included.
  `grep -nP "[\x{2014}\x{2013}]" <changed files>` returns nothing (the pattern is
  written as escapes on purpose, so this brief itself stays clean).
- **A14.** Dark ground renders correctly with the app theme toggle in BOTH positions
  (the hub is force-dark, so it must not change appearance).
- **A15.** `/fnrad` has a title, a description and an OG description in view-source, and
  the OG image resolves (inherited from the root, F32).
- **A16.** No file under `src/app/api/` is modified in this PR. No file under
  `supabase/migrations/` is added. No file under `src/app/onboarding/`,
  `src/components/onboarding/` or `src/app/auth/` is modified: the signup chain belongs to
  the companion brief (T7b). `src/app/people/[id]/page.tsx` IS expected in the diff, for
  T7a's sparse block only (`:666-692`, F54); read that one file's diff by hand and confirm
  it does not reach the signed-out CTA button row, which is the handoff brief's T2.2.
  Check the rest with `git diff --stat`.
- **A17. All three pre-flight checks in section 0 have been run against the episode-1
  guest and all three passed**, and the result is recorded in the PR description with the
  date they were run. This is not a code check and it is not the build's to fix, but the
  PR does not merge with it unanswered: the whole feature is inert if pre-flight 1 or 2
  fails, and pre-flight 3 puts a misspelled name in front of the guest on the page the
  podcast just sent people to.

---

## 9. Migration

**There is no migration this session.** No `CREATE TABLE`, no `ADD COLUMN`, no index, no
RLS policy, no view rebuild, no backfill, no manual SQL of any kind.

Gate classification under the repo risk gate: **not applicable**, because there is
nothing to classify. Neither SAFE nor GATED, because no SQL runs.

Consequences for the ship sequence:

- The migrate-first ordering rule does not apply.
- The Group F hard pre-merge gate (playbook check 23) does not apply: no write path in
  this PR sends a new column.
- The `_public` view rebuild rule (playbook check 24) does not apply: no publicly-read
  column is added to `claims` or `story_riders`.
- The `SHIP-LOG.md` entry must record `migration: none` explicitly, so the daily
  reconcile does not go looking for one.

The two SQL statements in section 2 (prerequisites 3 and 4) are **read-only diagnostic
selects**, not migrations. Run them in the Supabase dashboard; they change nothing.

---

## 10. Risks and gotchas

1. **The show slug is the single point of failure, and it is unverified.** AUDIT-1. If
   `FNRAD_SHOW_SLUG` is wrong, the hub silently loses its episode list and its challenge,
   which is exactly the content the campaign is about. Run prerequisite 3 first, and
   build A10 as a test rather than as an afterthought.

2. **The `/t/` namespace is shared and resolution is ordered.** F29: profile, then
   episode, then show. If a member ever mints the public slug `fnrad` for their own
   profile, they win the `/t/fnrad` race and the show page becomes unreachable. This does
   not affect `/fnrad` (a different route), but it is why the hub reads the show through
   `readOrgStack({ slug })` and not through a `/t/` fetch.

3. **`EVENT_STACK_COLS` is an explicit select and it 404s the whole read on a missing
   column** (F11). This is not a risk in this PR because this PR adds no column. It IS a
   risk for anyone who reads D5's rejected alternative A and decides to do it anyway.

4. **Drafts must never leak.** The mentions table's whole safety model is that import
   lands rows as `draft` and publishing is a manual editor action. `readShowHub` filters
   `status = 'published'` with no editor override, deliberately, matching
   `readPublishedMentions` (F9). Do not add an `include_drafts` escape hatch to the hub
   "for previewing". Ep 21's 53 drafts (R6) make this concrete today, not hypothetical.

5. **The hub's challenge and the episode page's challenge must not disagree.** Under
   revised D5 they structurally cannot: both resolve the single `FNRAD_CHALLENGE.guestId`
   constant (T1) rather than each deriving a guest from whichever episode it happens to be
   looking at. Removing that class of disagreement is most of what the inversion bought.

   The risk that replaces it is the config going STALE. Nothing in the build knows which
   week it is, so if `guestId` is not updated when the challenge changes, both surfaces
   confidently show last week's ask, and they agree with each other while doing it. That is
   a one-line fix and it is a calendar problem rather than a code problem, which is the
   right place for it to live for one season; section 14 follow-up 2 is where it stops
   being right. The hub still must never reach back for an older episode's guest to fill
   space: stale is worse than absent here, because the podcast said "this week".

6. **The hub's challenge read is now a single person lookup, and it must stay one.**
   Revised D5 removed the extra `readEventStack` the September 4 draft made for the newest
   live episode, so the hub does one show read (T2) and one person read (T6 step 5). If
   someone later loops a per-episode challenge over every listed episode, the hub becomes
   N+1 reads against a page that takes a traffic spike the moment it is read out on air.
   Section 14 follow-up 5 records the right shape if that is ever wanted.

7. **Bare community paths depend on the proxy 301.** F19. `/places/{slug}` works because
   `COMMUNITY_ROUTES` catches it and redirects to `/snowboarding/places/{slug}`. That
   means every mention link costs an extra hop. It is the established pattern on the
   chromeless pages and this brief inherits it rather than inventing a second one. Do not
   "fix" it by hardcoding `/snowboarding` into the links.

8. **`mentionSubjectName` returns the raw id for an unresolved subject** (F20). On the
   in-app surfaces that is a tolerable debugging artifact. On a page being advertised on a
   podcast, "evt_1782850803307_a1b2c3" as a visible name is a credibility problem. T2 step
   5 drops those rows. Verify with A7.

9. **Two dark surfaces, one of which is theme-independent.** The hub is force-dark like
   the homepage (F6) and the `/t/` pages are unconditionally dark (F5). A viewer with the
   light theme on will see a dark hub and a dark episode page, then a light app when they
   click through to `/places/...`. That transition is already how the product behaves from
   `/t/` pages and from the homepage. Do not try to smooth it in this PR.

10. **Copy is the deliverable, and it gets read out loud.** Appendix A is locked text.
    Build from it verbatim. If a line is wrong, change it deliberately and tell Jay which
    line changed, rather than paraphrasing it into something safer while wiring it up.

11. **No exclamation marks, no em dashes, no en dashes, no aphorisms.** F33 and the
    standing rule. A campaign page is exactly where marketing throat-clearing creeps in.
    A13 is the check.

12. **Superseded: the curated-stack spotlight and the anonymous mark.** Recorded here so
    the reasoning is not lost and nobody re-proposes it in three weeks.

    The morning draft of this brief derived the weekly challenge from the episode's FIRST
    `public_stack_entries` row, curated through the existing `StackCurateModal`, and paired
    it with the anonymous `POST /api/public/tag` loop: a visitor "marked their spot" from
    the episode page without an account. It was a genuinely good trade at the time. It
    reused an editor surface that already shipped, it needed no migration, it needed no
    auth, and it converted a listener in one tap with no signup wall.

    Two things killed it, both from the same fact: episode 1's challenge asks for a story
    about the episode's GUEST, and a guest is a person.

    First, a person cannot be marked anonymously. `TAGGABLE` is exactly
    `["story", "place", "event"]`, with a comment stating that board, rider and
    category_summary entries get no "I was there" affordance (F41), and the tag route
    accepts the same three moment kinds and nothing else (F14). There is no rider moment.
    Making one is an anonymous write-path change with its own abuse review, which is
    follow-up 4 and is not a landing-page PR.

    Second, adding a story is authenticated only, unconditionally: `POST /api/stories`
    calls `requireAuth()` before it reads the body (F40). So the challenge is an
    authenticated action no matter how the spotlight is derived, and the anonymous loop the
    old D5 through D7 were built on does not apply to it at all.

    Given that, the curated stack stopped paying for itself. Position 1 could hold a place
    or a board just as easily as the guest, so it could not reliably express "the guest",
    and the ordering was implicit enough to need two mitigations. `event_guests` says the
    guest explicitly, is already editor-managed, is already read, and is already resolved
    into the public payload (F35, F36, F37). The right answer got cheaper, not more
    expensive, which is the only reason this revision did not cost hours.

    What survives from the old design: nothing in the tag loop was touched. The
    `IWasThere` panels on place, event and story stack entries work exactly as they did.
    Out-of-scope items 2, 3 and 4 exist to keep it that way.

13. **The challenge now has a signup wall in front of it, and that is a real cost.** The
    old mechanic converted in one tap. This one asks a stranger who just heard a podcast to
    make an account before they can do the thing. Jay chose it deliberately over
    write-then-signup and over anonymous moderated submission (D6), and the mitigation is
    the companion brief (T7b), not a change here. Expect episode 1's conversion to be worse
    than the tap-based number would have been, and measure the drop-off between the CTA
    press and the published story rather than assuming it.

14. **All three pre-flight checks fail silently, which is why they are section 0.** If the
    guest has `require_tag_approval` on, every listener story is written successfully and
    then shown to nobody (F46). If the guest's id is not uuid-shaped, `POST /api/stories`
    returns a raw 500 with a Postgres message (F51), the connections path returns "Unknown
    rider" (F52), and the guest's page would not have read the story anyway (F47). In all
    three cases the FNRad page looks perfect. Pre-flight 3 fails somewhere else entirely:
    the page is fine and the CATALOG is wrong, so a listener searching "Ingemar" does not
    find his own pro model and the guest sees his name misspelled on the page the podcast
    just sent people to. Nothing in the build can detect any of the three. Run section 0.

15. **`event_guests.person_id` is text and `story_riders.rider_id` is uuid.** These two
    columns are the same person and disagree about their type (F35, F49). The junction was
    made text on purpose, to hold mixed-type catalog ids; the story tag was left uuid on
    purpose, when the profiles FK was dropped for ghost tagging (F50). Nothing in this
    brief reconciles them and nothing should: pre-flight 2 checks one guest at a time,
    which is the right size of answer for one episode. If the challenge runs every week for
    a season, the sweep query in section 0 pre-flight 2 is worth running once against every
    guest rather than one at a time.

16. **The two write paths disagree about validation and this brief does not fix it.**
    `POST /api/stories` accepts any string as a rider id and 500s in Postgres (F51);
    `POST /api/stories/[id]/connections` tests the uuid shape first and returns a clean 400
    (F52). A guest-story challenge sends real traffic down the first one. Adding the same
    guard to `POST /api/stories` is one line and it is genuinely tempting while reading
    this. It is an API change (out-of-scope item 6 and A16), so it is section 14 follow-up
    10, not this PR.

---

## 11. Rollback

Cheap in every direction, which is a consequence of no migration and no API change.

- **Whole feature.** Revert the PR. `/fnrad` 404s, the episode page returns to its
  current render. Nothing else in the product referenced any of it, because nothing links
  to `/fnrad` from inside the app in this PR (deliberate: see section 14).
- **Hub only, keeping the episode-page pass.** Delete `src/app/fnrad/`. The remaining
  additions (`mention-links.ts`, the `href` field on `PublicMention`, the listener strip,
  the challenge card) stand alone.
- **Challenge only.** Stop rendering `ChallengeCard` in both places. It is a leaf
  component, it holds no state, and nothing reads from it.
- **Guest links only.** Revert `public-episode-view.tsx:121-135` to plain `<div>` chips
  (T8). The page returns to its current dead end and nothing else notices.
- **In-app CTA only.** Restore the one paragraph at `episode-page.tsx:426-430` (T9). One
  string and one href.
- **Sparse empty state only.** Restore the `isAuth &&` gate at
  `src/app/people/[id]/page.tsx:676` and the original copy at `:673-674` (T7a, F54). The
  block returns to rendering its actions for signed-in visitors only, exactly as it does
  today. One conditional and one paragraph. It shares no state with anything else in the
  PR, and reverting it does not touch `addStoryAboutHref`, which the challenge card and T9
  still use.
- **Challenge spotlight only, without a revert.** Set `FNRAD_CHALLENGE.guestId` to null in
  `src/lib/fnrad.ts` and deploy. The card disappears from every surface and everything else
  on both pages keeps working (D5 state 3, A8c). This is the fastest rollback in the brief
  and it is one line, which is worth knowing on the day the episode drops.
- **Nothing here touches the anonymous tag loop**, so there is no rollback to consider for
  it: `POST /api/public/tag`, `StackEntryCard` and `i-was-there.tsx` are not in the diff
  (A12d, A16).
- **Mention links only.** Revert `public-mention-group.tsx` and `public-mention-row.tsx`
  to spans. The `href` field on `PublicMention` becomes unread, which is harmless.
- **Data rollback:** none exists to do. Nothing in this PR writes anything.

---

## 12. Suggested order

**Before step 1: section 0, all three pre-flight checks**, and prerequisite 5's guest
query. They are Jay's to run and they are blocking. Finding out after episode 1 airs that
the guest gates their tags is the worst outcome available in this brief.

1. **Prerequisites 3 and 4**, in the Supabase dashboard. The answers change what you can
   see for the rest of the session, and finding out at hour four that no episode has a
   guest row is a bad way to spend hour four.
2. **T1** (`src/lib/fnrad.ts`). Five minutes, and it makes both the show slug and
   `FNRAD_CHALLENGE` explicit before anything depends on either. Everything downstream in
   this list reads from this file, which is the point of writing it first.
3. **T3** (`mention-links.ts`). Pure function, no dependencies, testable by reading it.
4. **T2** (`readShowHub`). Verify it with a throwaway `console.log` from the hub page
   before any markup exists. Confirm the episode list is live-only and the names are
   published-only against the prerequisite-4 query output.
5. **T6 sections 1 to 4 and 7 to 8** (header, copy, CTAs, equity, footer). This is the
   part that must work when everything else degrades, so build it before the
   data-dependent parts and test A10 here, while it is trivially true.
6. **T6 section 6** (episode list, both names-line forms), then **T5 + T6 section 5**
   (challenge card, hub mode). Build `addStoryAboutHref` (T1, T7b) before the card, so
   there is exactly one place the destination is decided. Build the card in the D5 state 1
   shape first, with `episodeSlug` null, because that is what ships.
7. **T8** (guest chips become links) FIRST in the episode-page pass, because it is four
   lines and it is the one change that makes the rest of the pass reachable. Then **T4**
   (mention links), then the listener strip, the challenge card in episode mode, and the
   footer CTA copy.
8. **T9** (the in-app logged-out CTA), then **T7a** (the sparse-person empty state). Do
   these two last of the code tasks and do them together: they are the only two that open
   an authenticated surface, so a reviewer should be able to see both diffs side by side
   and confirm nothing else was touched. Keep T9 inside its one paragraph and keep T7a
   inside the sparse block at `src/app/people/[id]/page.tsx:666-692` (F54), well away from
   the signed-out CTA button row the handoff brief owns (T7b). Both route through
   `addStoryAboutHref` from step 6, which is why they come after it.
9. **Responsive and theme pass** at 375, 414, 1440, with the theme toggle in both
   positions.
10. **A8a, then A8b, then A8c**, the three render states, in that order. A8a is the launch
   state and the one that has to be right; the other two are two-line config flips from it
   and take a minute each. Do this before the listener walk, so the walk exercises the
   state that will actually be live.
11. **A9 last**, the full episode-1 listener walk, because step 4 writes a real account and
   a real story to production and you only want to do it once. Do it with a throwaway email
   and against a test episode's guest if one is available, not against episode 1's real
   guest, so the guest's public page is not carrying a test story when the episode drops.
   Include a signed-out stop on a sparse person page (A12e), because that is the page
   episode 1 actually lands on, and test it before any S12 E01 mentions are imported: the
   state self-heals the moment one lands.
12. `tsc`, PR, merge.

Rationale for the shape: the degraded page is built first and the data-dependent parts
are layered on, so at no point is there a version of `/fnrad` that only works when the
data is right.

---

## 13. Ship sequence

1. Branch `feat/fnrad-listener-landing`. Push, open the PR, state the number.
2. **No migration this session.** Say it explicitly in the PR description so the record
   is unambiguous. Section 9 is the reference.
3. There is no migrate-before-merge gate, so ordering is free.
4. Nothing to apply.
5. Nothing gated.
6. **Merge it yourself** with `gh pr merge` once `npx tsc --noEmit` is clean and A1 to
   A17 pass, including **A8a** (the launch render state, which is the one that ships),
   **A12e** (the sparse person page signed out, T7a) and **A17**: all three section 0
   pre-flight checks run and recorded in the PR description with the date. No exception
   applies: this PR touches no payment path, no Stripe, no auth flow, and no data-deletion
   path, and it modifies no API route and no file in the signup chain (A16).
   `src/app/people/[id]/page.tsx` IS in the diff, for T7a, and that is expected: A16
   forbids the signup chain and the API routes, not that file. Confirm in chat
   that Vercel will auto-deploy `main`.
7. Write the `bugs/SHIP-LOG.md` entry with the real PR number, `migration: none`, and
   `status: merged`. Then tell Jay four things he has to do outside the repo:
   - Confirm the show slug (prerequisite 3) if it differed from the default.
   - **Set `FNRAD_CHALLENGE.guestId` to Ingemar's real person or profile id** (T1, D5).
     What ships in the file is a placeholder and a placeholder resolves to nobody, which
     under D5 state 3 means no challenge card anywhere. This is the one config value the
     whole feature turns on.
   - Correct the misspelled board model name (pre-flight 3), which is a data fix outside
     this PR.
   - Publish ep 21's drafts (R6) if he wants that episode's names on the hub; otherwise it
     lists with "Not indexed yet." (T6 step 6).

   Note for later, so nobody books a session for it: adding the episode link when the S12
   E01 page exists is a two-line edit to `src/lib/fnrad.ts` and a deploy, not a session
   (D5 state 2, A8b).

---

## 14. Follow-ups, NOT this session

1. **Link `/fnrad` from inside the product.** This PR ships an unlinked page on purpose:
   it exists to be arrived at from outside. Once it has proven itself, the natural homes
   are a line on the homepage and a link on the FNRad brand page. One line each, and it
   makes rollback less clean, which is why it waits.
2. **A real challenge record.** The upgrade is an explicit spotlight on `events` plus a
   picker in the editor, so the week's spotlight is a stored, editable row instead of a
   constant. It is a hard pre-merge gate because of `EVENT_STACK_COLS` (F11), so it wants
   its own session.

   **Revised D5 makes this wanted MORE, not less.** The September 4 evening draft of this
   line said the opposite, because it was written against a design where the spotlight was
   derived from `event_guests` and the schema therefore already stored it. That is no
   longer true. Under revised D5 the spotlight is a hand-edited constant in
   `src/lib/fnrad.ts` that the schema stores nothing about: changing the week's guest is a
   code edit and a deploy by whoever holds the repo, there is no record anywhere of what
   the challenge was in a given week, and nothing but somebody remembering keeps it current
   (risk 5). That is the correct trade for one episode and the wrong one for a season. If
   the challenge is still running weekly past episode 4 or so, promote it.
3. **Challenge participation count.** "9 riders have added theirs" under the challenge
   card. The data is a count of `story_riders` rows for that guest since the episode's
   publish date, so it is a read, not a schema change. Deliberately not in v1: a public
   zero is worse than no number at all in week one, and week one is episode 1.
4. **Anonymous tagging for riders.** Still the biggest gap, and now the gap the challenge
   walks around rather than through (D6, risk 12). It means a new moment kind in
   `POST /api/public/tag` (a `rode_with` shape for a person) and it is an anonymous
   write-path change, so it is its own brief with its own abuse review. If it ever ships,
   the FNRad challenge gets a one-tap variant beside the story ask, not instead of it.
5. **A challenge per episode on the hub**, rather than the one from config. It needs a
   spotlight per episode, which is follow-up 2's stored record, or the guests for every
   listed episode, in which case the right shape is extending `readShowHub` to load
   `event_guests` for all listed episode ids in one `.in()` query rather than looping
   `readEventStack` (risk 6). Either route is a bigger change than it looks, because it
   also has to answer which of several challenges on screen is "this week's".
6. **Show the guest's existing stories on the challenge card.** "Three people have already
   added theirs" with two names, read from `story_riders_public` for that guest. Makes the
   ask feel joinable rather than empty. Same caution as follow-up 3 about week one.
7. **A dedicated `/fnrad` OG card.** Inherits the site card today (F32). A card carrying
   the FNRad name would share better into the podcast's own channels. `next/og` route,
   same pattern as `t/[slug]/opengraph-image.tsx`.
8. **Campaign analytics.** If pageviews stop answering the question, add a `campaign`
   value to `AnalyticsCategory` (F24) and fire `campaign_landed`, `challenge_viewed`,
   `challenge_marked`. Types change plus a server allowlist change; small, but not free,
   and not needed for week one.
9. **The sticker programme** (D13, R5). Ops, fulfilment and a privacy-policy question
   about collecting postal addresses. Answer Erik first, then scope it.
10. **An episode-page transcript surface.** Excerpts already render inside mention cards;
   full transcripts are a different feature with a different page.
11. **Make `POST /api/stories` validate the rider id shape.** Risk 16. It is one
    `UUID_RE.test` and an early 400, copied verbatim from
    `src/app/api/stories/[id]/connections/route.ts:113-115` (F52), turning a raw Postgres
    500 into a readable rejection. It is an API change so it stays out of this PR, but it
    is small, it is obviously correct, and the guest-story challenge is what makes it
    matter. Worth doing before the season, not after.
12. **A guest-facing heads-up before an episode airs.** If the challenge points listeners
    at a person every week, that person should know, and should be told what
    `require_tag_approval` does before their inbox fills up rather than after (section 0,
    pre-flight 1). Ops, not code, but it belongs on this list so it is not forgotten.

---

## 15. Questions for Jay

None of these block the build. Every one has a default already in the brief.

1. **What is the FNRad show's `public_slug`, and is its public link ticked on?**
   (AUDIT-1.) Default assumed: `fnrad`, enabled. Prerequisite 3 is the query. If the show
   is not published, the hub renders degraded until it is, and that is a two-second fix in
   the app, not a code change.
2. **All three pre-flight checks in section 0, as soon as the episode-1 guest is known.**
   These are the three that are yours and that block, and none of them takes a minute.
   Does the guest have `require_tag_approval` on, is their id uuid-shaped, and has the
   misspelled "Ingmar Backman" board row been corrected? Everything else in this list can
   wait; these cannot.
3. **What is Ingemar's person or profile id?** (D5, T1.) That one value goes into
   `FNRAD_CHALLENGE.guestId` in `src/lib/fnrad.ts` and it IS the challenge: no id, no
   challenge card, on any surface. It does NOT come from `event_guests` and no episode
   record has to exist for it to work, which is the whole point of the September 6
   revision. Prerequisite 5's query is one way to read an id off an episode if one exists;
   a lookup by name in the dashboard is the other. Separately, and NOT blocking: whether
   episode 1's `event_guests` row is set, which is what T8's guest chips render (AUDIT-3).
4. **The companion brief `features/signup-intent-handoff-brief.md` ships first** (T7b).
   Confirm that is still the plan. If it slips past episode 1, this feature still works and
   the listener does two extra screens: they land on the guest's page, make an account, and
   press the button that is already there (F43). Worse, not broken.
5. **Ep 21's 53 mentions are drafts** (R6). Publish them before the hub goes live, or the
   episode lists with no names against it. Your call on whether that episode is ready.
6. **Has the Season 12 intro episode dropped?** (R7, R8.) It changes nothing in the code. It
   changes whether the page needs to be live this week or next.
7. **Erik's sticker idea has been unanswered since August** (R5, D13). Out of scope here.
   Worth a yes or a no to him either way.
8. **The spoken URL is `linestry.com/fnrad`, not `/r/fnrad`,** until the attribution brief
   ships (T7). Do not read the `/r/` form on air before then; it will 404.
9. **Appendix A is the copy of record and it gets read by strangers who just heard your
   sponsor's name.** Read it before the build starts, not after. Any line you change is a
   one-string edit at code time. The challenge copy in A1 changed completely in this
   revision, so read that section even if you read the morning draft.
10. **Does the episode-1 guest know they are the challenge?** Not a build question. They
   are about to be the most-tagged person in the graph for a week, and pre-flight 1 is a
   conversation with them as much as a query. Section 14 follow-up 12.

---

# Appendix A: copy of record

Locked text. Build from this verbatim. Voice: plain, warm, specific to snowboarders. No
marketing throat-clearing, no hype, no exclamation marks, no em dashes, no en dashes. The
frame is scatter-to-connection (F33): the reader holds a piece that is needed, and the
problem is that the pieces have not been put together yet.

## A1. `/fnrad`, the listener hub

### Kicker `[kicker]`

> FNRAD SEASON 12 · PRESENTED BY LINESTRY

### Heading `[h1]`

> You were there too. Connect your stories.

SETTLED September 6 2026 by Jay, against the alternate. The reason is message match:
Erik's spoken callout is "go to linestry.com/fnrad to connect your stories", and a
listener who half heard the URL uses the headline to know they landed in the right place.
The superseded line was "Everything they talk about, written down." It explained what
Linestry is to a stranger; the lead below now carries that job instead.

### Lead `[lead]`

> Guests of FNRad have been sharing their stories with us, calling out the riders, hills,
> brands, events and sessions they were part of. Linestry connects those stories together,
> and it is where you connect yours to a shared timeline of snowboarding.

Jay's copy, September 6 2026, lightly tightened from his dictation. Do not rewrite it.

### Primary call to action `[cta-primary]`

> Start your timeline

Links to `/onboarding?ref=fnrad`.

### Secondary call to action `[cta-secondary]`

> Look around first

Links to `/snowboarding`.

### What is in it for you `[value]`

Three lines, in this order, no icons, no cards.

> Find the rider, the hill or the board you just heard about.
>
> See who else was there, and when your lines crossed theirs.
>
> Add your half of the day. Most of this history is still in people's heads.

### This week's challenge, section label `[challenge-label]`

> THIS WEEK'S CHALLENGE

### Challenge ask `[challenge-ask]`

One line, the same on the hub and on the episode page. `{Guest}` is the guest's full
display name, `{First}` their first name only. There is no per-type variant any more:
the spotlight is always a person (D5).

> {Guest} is the first guest of Season 12. Add your stories connected to {First}.

For every episode after the first, drop the season framing:

> {Guest} was on this week's episode. Add your stories connected to {First}.

### Challenge body `[challenge-body]`

Two sentences under the ask. This is the whole explainer for someone who has never heard
of Linestry and just heard a name on a podcast, so it says what the thing is and what
happens to what they write.

> Your stories and photos of their boards, the events, the videos. If you were there, or
> you watched it happen, write it down. {First} would love to see them.

Jay's copy, September 6 2026. Two things it changes from the superseded version. It asks
for PHOTOS as well as text, which the composer already supports and which is the likeliest
thing a listener actually has to hand. And it names the categories of thing rather than
explaining what Linestry is, which the lead now does.

The episode-1 instance adds one category Jay named for Ingemar specifically:

> Your stories and photos of his boards, the events, the videos, or from King of the Hill.
> If you were there, or you watched it happen, write it down. Ingemar would love to see them.

AUDIT, before this ships: "Ingemar would love to see them" states what a real, named person
wants, on a public page. Jay's line and Jay's relationship, but confirm he is happy with it
attributed to him that way. Also unverified from here: Ingemar's connection to King of the
Hill. Verified and safe to state: the Riksgransen backside air of May 1996, the Diesel 55
DSL contest, the Atlantis board, the later move to Allian.

### Challenge primary action `[challenge-action]`

> Add your story about {First}

Links to `addStoryAboutHref(guest.id)` (T1, T7b).

### Challenge signup note `[challenge-signup-note]`

Sits directly under the primary action, small and quiet. It is here because the honest
thing to do with a signup wall is to name it before someone hits it, not after.

> You will need an account. It takes a minute and it is free.

### Challenge secondary action, episode mode `[challenge-action-episode-secondary]`

> Or open their page

Links to `/people/{guest.id}`.

### Challenge secondary action, hub mode `[challenge-action-hub-secondary]`

> See the episode

Links to `/t/{FNRAD_CHALLENGE.episodeSlug}`, by `public_slug` and never by id, which is
exactly why that config field holds a slug (D5). ABSENT entirely when `episodeSlug` is
null, which is the launch state.

### Challenge kicker, hub mode only `[challenge-kicker-hub]`

Under the section label, naming which episode this week's challenge belongs to, so a
listener who is an episode behind is not confused. `{episode-title}` is
`FNRAD_CHALLENGE.episodeLabel`, printed verbatim, for example "FNRad S12 E01". ABSENT
entirely when `episodeSlug` is null, which is the launch state, and also absent when
`episodeLabel` is set but `episodeSlug` is not (D5, T5).

> From {episode-title}

### Challenge, no guest `[challenge-empty]`

There is no copy for this state. When `FNRAD_CHALLENGE.guestId` is null, the whole card is
absent from every surface. Do not write an empty state for it. See D5 render state 3, T5
and A8c.

A missing EPISODE is a different thing and is NOT this state. With `guestId` set and
`episodeSlug` null the card renders in full, minus the kicker and the secondary. That is
D5 render state 1 and it is the launch state.

### Sparse person page, empty state `[sparse-empty]`

Replaces the copy at the sparse-ghost block, `src/app/people/[id]/page.tsx:666-692` (T7a,
F54). Shown to everyone, signed in or not. A12e is the check.

Heading:

> Nothing here yet

Body:

> {First}'s page is new. If you rode with {First}, or you were there watching, you can be
> the first to put something on it.

Primary action, for everyone:

> Add your story about {First}

Secondary, for everyone:

> Browse riders

### Episodes, section label `[episodes-label]`

> EPISODES

### Episode row, names line `[episode-names-prefix]`

Rendered by T6 step 6 on each hub episode row, immediately before the wrapped row of
linked names. Omitted entirely when there are no names; see `[episode-no-names]`.

> Named in this one:

### Episode row, overflow `[episode-names-more]`

> and {N} more

### Episode list, no names on an episode `[episode-no-names]`

Rendered by T6 step 6 in place of the WHOLE names line, prefix included, when an episode's
`mentionNames` is empty. That is the ep-21 case today (R6, AUDIT-2). Muted style.

> Not indexed yet.

### Equity block, heading `[equity-heading]`

> There is a share pool, and it closes at the end of the season.

### Equity block, body `[equity-body]`

Reads `EQUITY_POOL_SHARES`, `EQUITY_SNAPSHOT_LABEL` and `EQUITY_SNAPSHOT_TIME_LABEL` from
`@/lib/equity-offer`. Never hardcode the numbers.

> Lineage Community Technologies has set aside {EQUITY_POOL_SHARES} common shares for the
> people who build this thing out. Adding history earns tokens, and tokens are how the
> pool gets split. It is open to everyone, including the free tier, and nothing is bought.
>
> Balances are recorded at {EQUITY_SNAPSHOT_LABEL}, {EQUITY_SNAPSHOT_TIME_LABEL}, which is
> the end of FNRad Season 12.

### Equity block, link `[equity-link]`

> How the share pool works

Links to `/equity`.

### Footer, word link `[footer-word]`

> linestry, noun. Read the definition.

Links to `/word`.

### Footer, legal `[footer-legal]`

Three links matching the homepage: Privacy, Terms, Data deletion. Then:

> Lineage Community Technologies Inc.

## A2. The public episode page additions

### Listener strip `[episode-strip]`

Sits directly under the episode header, above the featured set. One sentence and one
action.

> New here? Linestry is a shared timeline of snowboarding, kept by the people who were
> there. Everyone named in this episode has a spot on it, and so do you.

Action, styled as the page's primary button:

> Start your timeline

Links to `/onboarding?ref=fnrad`.

### Footer call to action `[episode-footer-cta]`

Replaces the current "Explore the snowboarding graph →" at
`public-episode-view.tsx:216-218`.

> Start your timeline →

Links to `/onboarding?ref=fnrad`. The "Powered by Linestry" brand-mark link above it
stays exactly as it is.

### Guest chip, accessible label `[episode-guest-link-label]`

T8 turns each guest chip into a link. The visible text stays the guest's display name,
exactly as it renders today. The link needs a label for anyone not reading it visually,
emitted as `aria-label` on the link element (T8):

> {Guest}, on Linestry

## A2b. The in-app episode page, logged out

### Call to action, episode has a guest `[episode-inapp-cta-guest]`

Replaces "Join Linestry to add what you know about this episode" at
`episode-page.tsx:426-430` (T9, F42).

> Rode with {First}, or watched them ride? Add your story about {First}.

"Add your story about {First}" is the link, to `addStoryAboutHref(guest.id)`.

### Call to action, episode has no guest `[episode-inapp-cta-noguest]`

The fallback. Still specific, still not `/`.

> Know something about this episode? Add what you have to {episode-title}.

"{episode-title}" is the link, to that episode's public page.

## A3. `/fnrad` metadata

```ts
const META_DESCRIPTION =
  "Every rider, hill, contest and board named on the FNRad snowboarding podcast, written down on a shared timeline of snowboarding. Linestry is the Season 12 presenting sponsor."

export const metadata: Metadata = {
  title: "FNRad on Linestry",
  description: META_DESCRIPTION,
  alternates: { canonical: "/fnrad" },
  openGraph: {
    type: "website",
    url: "/fnrad",
    siteName: "Linestry",
    title: "FNRad on Linestry",
    description: META_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "FNRad on Linestry",
    description: META_DESCRIPTION,
  },
}
```

---

## SHIP-LOG entry to write at wrap

```
type: feature
pr: #<number>
branch: feat/fnrad-listener-landing
ids: none
scope: fnrad-listener-landing
migration: none
status: merged
tsc: clean
```
