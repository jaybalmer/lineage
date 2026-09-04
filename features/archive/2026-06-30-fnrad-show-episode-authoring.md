# Build Brief: FNRad Show + Episode Authoring (editor self-serve)

> Build-ready Claude Code handoff. Queued June 30, 2026 after FNRad Featured
> Timelines Phases 1 to 4 shipped (PR #139 / #140 / #142 / #143). This is the §8
> fast-follow ("a scoped editor authoring role") narrowed to the immediate need:
> let an editor create a media show + its episodes from the UI, with no SQL.
> No em dashes anywhere (standing rule).

---

## 1. Why

The FNRad feature is complete and works end to end, but the two *catalog rows* a
show needs (the media Org + each episode Event) can only be created via direct
SQL today: the in-app add forms whitelist the old org/event types and have no
field for the episode linkage. That is fine for a one-off seed, but the FNRad
cadence is recurring (new season, many episodes), so creation should be
self-serve for an editor. Everything *after* the rows exist (guests, featured
set, publish, connections) is already in-app from Phases 2 to 4.

## 2. The gap (verified facts, provenance)

1. `AddEntityModal` org-type list `ORG_TYPES` has no `media` (`src/components/ui/add-entity-modal.tsx:28`); its event-type list `EVENT_TYPES` has no `episode` (line 29). No inputs for `show_org_id` / `media_url` / `episode_number` anywhere.
2. The member create route `POST /api/catalog/entity` validates `org_type` against a hardcoded set (`src/app/api/catalog/entity/route.ts:30`) and `event_type` against another (line 28), so it rejects `media` / `episode`. It is `requireAuth` (any member) and does NOT write community junctions.
3. The editor route `POST /api/admin` is `requireEditor` and does broad table ops (used by the store's `updateCatalogEntity`). Editor = `is_editor` OR founding (`requireEditor` in `src/lib/auth.ts`).
4. Rendering already works once rows exist: `org_type='media'` -> `ShowHubView` (branch in `brands/[slug]/page.tsx`); `event_type='episode'` -> `EpisodeView` (branch in `events/[id]/page.tsx`). Episode columns + `event_guests` + the `public_slug/public_enabled` columns all exist (Phase 1 migration `20260629000002`). No new migration is needed for this brief.
5. Community linking: `community_orgs (community_id, org_id)` and `community_events (community_id, event_id)`; `communities` has `slug`. Catalog loads `orgs`/`events` globally (`src/store/lineage-store.ts:186,188`), so a new row resolves at its URL immediately; the junctions only drive the community LIST pages. The active community slug default is `"snowboarding"` (`lineage-store.ts:916`).
6. Catalog ids are client-supplied text (`/api/catalog/entity` takes `data.id`); orgs.id / events.id are text.

## 3. DECISIONS (review before building; defaults chosen)

- **D1 — Surface (default: on the show hub).** Media-org creation: add `media` to the `AddEntityModal` org-type list but gate the option to editors, and route the actual write through an editor endpoint (member route still rejects it). Episode creation: an **"Add episode"** button on `ShowHubView` (editor-only) opening a small `EpisodeCreateModal`. Alternative considered: a dedicated `/admin/shows` surface; rejected as heavier than needed.
- **D2 — Write path (default: one editor route).** Add `POST /api/admin/show-episode` (or reuse `POST /api/admin`) `requireEditor`, accepting either `{ kind: 'show', name, description?, logo_url? }` or `{ kind: 'episode', show_org_id, name, start_date, year?, episode_number?, media_url?, description? }`. It inserts the row (server-generated text id) AND the matching community junction for the active community. Keep `/api/catalog/entity` untouched.
- **D3 — Community (default: auto-link active community).** New show/episode auto-add to the community the editor is in (mirrors what the seed SQL did by hand), so they appear in the `/[community]/brands` and `/events` lists without a second step.
- **D4 — Edit (default: include minimal edit).** Teach `EditEventModal` the `episode` type + the three episode fields (show picker, `media_url`, `episode_number`) so an existing event can be converted to an episode or fixed. Small, and avoids a second SQL escape hatch.
- **D5 — Guests/featured (default: hand off).** After creating an episode, deep-link the editor to the episode page where the Phase 2 curate modal handles guests + featured set. Do not rebuild that here.

## 4. Scope

1. Editor write route(s) per D2: create media org, create episode (event_type='episode', show_org_id), each + its community junction. `requireEditor`.
2. `AddEntityModal`: surface `media` in the org-type list for editors (and wire its submit to the editor route when the type is `media`).
3. `ShowHubView`: an editor-only "Add episode" button -> `EpisodeCreateModal` (name, date, episode_number, media_url, optional description); on save, refresh the episode list and offer "Curate now" deep-link to the new episode page.
4. `EditEventModal` (D4): add `episode` to its type list + the three episode fields.
5. Verify non-editors never see the affordances and the route 403s them.

## 5. Acceptance

- An editor creates a media show from the UI (no SQL) and it renders as the show hub.
- An editor adds an episode from the show hub and it renders as the episode page with the show back-link; the Phase 2 curate modal then sets guests + featured set.
- New show + episode appear in the active community's brands/events lists.
- Non-editors cannot create or see the affordances; the editor route 403s them.
- tsc + eslint clean. No migration (Phase 1 already added every column).

## 6. Suggested order

Editor write route -> AddEntityModal media option -> EpisodeCreateModal on the hub -> EditEventModal episode support -> verify gating.

## 7. Pre-flight

- Confirm `community_orgs` / `community_events` insert shape (`community_id`, `{org_id|event_id}`) and that the active-community id is resolvable server-side (or pass the community slug from the client).
- Confirm the id-generation convention for a new org/event (client-supplied text id; mirror `AddEntityModal`'s existing id generation).
- No DB migration. The `media` OrgType and `episode` EventType unions already exist (Phase 1).
