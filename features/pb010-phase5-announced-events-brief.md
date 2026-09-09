# PB-010 Phase 5 (Announced / Future Events) — Claude Code handoff brief

**Drafted:** June 16, 2026 by Cowork. **Target:** one Claude Code session, ~3 to 4 hr.
**Builds on:** PB-010 Phases 1 to 4 (MVP complete, PRs #77/#78/#81/#82/#83). **Source spec:** `Product/PB-010-Public-Timeline.docx` ("Future events — forward timeline").
**Pre-flight:** 24-check playbook applied against `~/lineage` post-Phase-4. Verified facts in §4.

---

## §0. What this is

The MVP public timeline is retrospective. Phase 5 makes it **forward-facing**: the same spine carries completed moments and **announced/upcoming events** (a tour, a board drop, a contest calendar). Announced events render distinctly (outlined, countdown chip), auto-roll to historical when their date passes, and a visitor can "mark interest" using the Phase 4 tag-to-claim loop. This is the first post-MVP PB-010 phase and the first PB-010 migration since Phase 1.

---

## §1. Prerequisites

- P1. Branch off current `main`. One PR; Jay merges.
- P2. `npx tsc --noEmit` + eslint clean before commit.
- P3. Smoke against the dev server started from the session working directory (stop any stale `~/lineage` server). Test `/t/{slug}` signed-out with at least one future-dated announced event and one past event on the same owner.
- P4. No em dashes anywhere written. Standing user rule.
- P5. **Apply the migration to prod before merge** if the public read selects the new columns unconditionally (it will). The two columns are additive and nullable/defaulted, so the window risk is low, but treat migration-before-merge as the safe order (Group F check #23).

---

## §2. Scope

1. **Migration** adding two event columns: `events.is_announced boolean not null default false` and `events.rsvp_url text`. Plus the matching `Event` type fields (the type already carries `visitor_display_override`; add these two).
2. **Public read:** `src/lib/public-timeline-read.ts` selects the two new columns wherever it reads `events`, and the payload exposes whether an event is upcoming (computed: `is_announced=true AND start_date in the future`).
3. **Render an "Upcoming" section** at the top of the public timeline (and an upcoming block/cards in the stack) using a NEW decoupled announced-event card in `src/components/public-timeline/` (the in-app `timeline-event-card.tsx` is store-coupled, fact 3). Announced events are styled distinctly: outlined rather than filled, a countdown chip ("14 days away"), the host place, and an optional RSVP/ticket link (external, `rsvp_url`). Past events stay in the historical flow as today.
4. **Auto-roll** is render-time, not a job: an event with a now-past `start_date` renders historical regardless of `is_announced` (no cron; decision D3).
5. **Mark interest** ("I'll be there"): reuse the Phase 4 `POST /api/public/tag` with the future event as the moment. The same ghost + claim + tag_event + magic-link loop, with the interest preserved through the event date. The card affordance reads "I'll be there" for upcoming events vs "I was there" for past ones (decision D4 covers whether this ships in Phase 5 or defers).
6. **Owner authoring:** let an owner mark an event announced and set `rsvp_url` + a future date. Add the two fields to the existing event-create path (`AddEntityModal` / `addUserEvent`) and link it to the owner's public timeline via the existing event predicate (`organized_at` / `competed_at` / `spectated_at`). Keep this minimal; reuse the catalog event flow rather than building a new authoring surface.

---

## §3. Out of scope

- Versioned reschedule notifications ("tour date moved, notify everyone who marked interest") (later).
- Any embed/subdomain/theming/analytics (Phase 6).
- A scheduled job for anything; auto-roll is render-computed.
- Reworking how historical events render on the public timeline (they stay story-first as shipped; this phase adds the forward section, it does not un-hide historical event claim cards).

---

## §4. Verified facts (checked against `~/lineage` post-Phase-4, June 16)

1. **`Event` has `start_date`, `end_date`, `event_type`, `place_id`, `year`, `website_url`, `image_url`, `visitor_display_override`, but NO `is_announced` and NO `rsvp_url`.** Phase 5 adds the two columns (real migration; the first PB-010 migration since Phase 1).
2. **Events are not behind a `_public` view.** Only `claims` and `story_riders` have `_public` views; catalog events are read directly. So no view rebuild is needed (Group F #24 does not apply here); just select the new columns in `public-timeline-read.ts`.
3. **`timeline-event-card.tsx` is store-coupled** (`useLineageStore`, `CommunityLink`), so it cannot render on the chromeless public route. Build a decoupled announced-event card in `src/components/public-timeline/`, fed by the payload, matching the Phase 2/3 store-free pattern.
4. **The public timeline hides event claim cards today** (`HIDDEN_CLAIM_OBJECT_TYPES = place, event` in `public-timeline.tsx`, story-first). So announced events must surface in a dedicated "Upcoming" section, not by un-hiding event claims. The owner links to an event via `competed_at` / `spectated_at` / `organized_at` (the `EVENT_PREDICATES` set).
5. **The Phase 4 tag endpoint already handles event moments** (`spectated_at`/`competed_at`). "Mark interest" reuses it directly; the only new bit is the future-date preservation and the CTA label.
6. **Per-moment visitor-display override already exists** on `Event` (`visitor_display_override`), consistent with the deferred aggregate display; not needed for Phase 5 rendering.

---

## §5. Migration

`supabase/migrations/<date>_pb010_phase5_announced_events.sql`:

```sql
alter table events
  add column if not exists is_announced boolean not null default false,
  add column if not exists rsvp_url text;
```

Additive and safe. Then add `is_announced?: boolean` and `rsvp_url?: string` to the `Event` interface and pass them through the event create/update path and the public read select.

---

## §6. Decisions (defaults ship if not overridden)

- **D1. Where announced events render.** Default: a dedicated **"Upcoming" section pinned above** the historical timeline on `/t/{slug}`, and an upcoming block at the top of the stack. Recommend pinned-top.
- **D2. How an owner flags announced.** Default: **two fields on the existing event create/edit** (`is_announced` toggle + `rsvp_url`), linked to the owner via the normal event predicate. No new authoring surface. Recommend.
- **D3. Auto-roll.** Default: **render-time** (past `start_date` renders historical; no cron). Recommend.
- **D4. Ship "mark interest" in Phase 5 or defer.** Default: **ship it** (it is mostly free, reusing Phase 4); the only addition is the future-preserved tag + the "I'll be there" label. Alternative: render announced events read-only in Phase 5 and add interest in a follow. Recommend ship it.
- **D5. Countdown granularity.** Default: days ("14 days away"), switching to "today" / "this week" near the date. Recommend days.

---

## §7. Acceptance criteria

1. `tsc` + eslint clean. Migration applies to prod; `events` has `is_announced` (default false) + `rsvp_url`.
2. An owner can flag an event announced with a future date + RSVP link, and it appears in the "Upcoming" section on their `/t/{slug}` (and stack), outlined with a countdown chip and the RSVP link; a past event does not appear there.
3. When an announced event's `start_date` passes, it renders historical on next load (no manual step).
4. The announced-event card has zero `useLineageStore` imports (store-free, like the rest of `public-timeline/`).
5. If D4 = ship: "I'll be there" on an upcoming event runs the Phase 4 loop (ghost + tag_event + claim-your-spot email), and the tag lands in the owner's `/me/tags` Embed inbox.
6. `bugs/SHIP-LOG.md` entry (type: feature, scope: pb010-phase5, status: pending).

---

## §8. Suggested build order

1. Migration + `Event` type + select the columns in `public-timeline-read.ts` (payload exposes `upcoming`).
2. Decoupled announced-event card + the "Upcoming" section on the timeline and stack (render only).
3. Owner authoring fields on the event create/edit path.
4. Mark-interest wiring (reuse `/api/public/tag`; future-date + label) if D4 = ship.

Render before authoring before the interest write, so the activating write lands last.

---

## §9. Data-quality questions for Jay

1. **Confirm the owner-to-announced-event predicate.** For a creator announcing their own tour, is the link `organized_at` (they run it) or `competed_at` (they headline it)? Default: accept any `EVENT_PREDICATES` link and show it as upcoming; the owner picks the predicate when they add the event.
2. **Confirm "mark interest" ships in Phase 5** (D4). Default: yes.
3. **Any existing events with future `start_date`** that should auto-surface as upcoming once `is_announced` defaults false? Default false means nothing surfaces until an owner flags it, which is the safe default; confirm that is wanted vs auto-flagging future-dated events.

---

## §10. Rollback

Single-PR revert plus `alter table events drop column if exists is_announced, drop column if exists rsvp_url;`. The new column is read on the public surface but defaulted, so a revert leaves events rendering historically as before. Mark-interest tags created via the Phase 4 loop are harmless and owner-moderatable after a revert.
