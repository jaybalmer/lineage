# Feature Brief: Admin User Archive (soft hide)

Claude Code handoff. Build-ready. Drafted July 5, 2026 with the 24-check pre-flight playbook applied against the live repo at `~/lineage`.

Immediate trigger: Jay wants to remove the test account **Cy 3**. Rather than a one-off SQL delete, this ships a reusable admin capability to archive (soft-hide) any user, and Cy 3 gets archived through that new tool as the first real use.

---

## 0. Size and shape

Small-to-medium single-PR feature. One additive migration (one column), one new admin page, one new admin API route, plus archived-exclusion filters at two read layers. No hard delete, no cascade, no data loss. Fully reversible. Estimated 2 to 3 hours build plus deploy.

This brief trims the full 24-check playbook to the checks that matter here (migration gating, read-path inventory, owner-self visibility invariant, `_public` view freeze). It is not a schema-heavy phase.

---

## 1. Goal

Give an editor/admin the ability to **archive** (soft-hide) a user account, and to un-archive it. An archived account:

- Disappears from every **public** surface: the `/people` directory, connections, compare, entity rosters and chips, the community feed/timeline, search, and any leaderboard/contributor list.
- Remains fully intact in the database. No rows are deleted. The flag is reversible.
- Is still visible to **the account holder themselves** when they are logged in: their own profile, their own timeline, their own claims and stories all render for them exactly as before. Archive hides them from *others*, not from *themselves*.

Out of scope (explicit): hard delete, cascade deletion, account lockout/suspension (an archived user is NOT signed out or blocked from the app), and bulk archive. Those are separate future asks. See §9.

---

## 2. DECISIONS (review before building)

Each has a recommended default. Jay reviews; if he does not override, build the default.

**D1. Column name and shape.**
Recommended: `profiles.is_archived boolean NOT NULL DEFAULT false`. Simple boolean, mirrors the existing `require_tag_approval` pattern. (Alternative considered: an `archived_at timestamptz NULL` for audit. Recommended default keeps the boolean and adds `archived_at` and `archived_by` as nullable companions for a lightweight audit trail, since they are cheap and help answer "who hid this and when" later. Final recommendation: ship all three.)

**D2. Who can archive.**
Recommended: `requireEditor()` (is_editor OR founding), matching the membership editor. Not `requireModerator()` (that is the stricter is_editor-only gate used for tag moderation). Archiving a user is a membership-admin action, so `requireEditor` is the right tier.

**D3. Archived user's claims on entity rosters.**
An archived person can still be the subject/object of claims that render on OTHER pages (e.g. an event roster "who rode here", a rode_with companion on someone else's timeline). Because the archived person is removed from `catalog.people` (see §4), the claim card cannot resolve them and should render nothing / skip them.
Recommended default: rely on the catalog exclusion. Verify the claim-card and roster components degrade gracefully when a referenced person id is absent from `catalog.people` (skip the row / hide the chip, do not crash or show a blank card). Do NOT attempt to filter archived subjects inside `claims_public` / `story_riders_public` (those views are keyed on text `subject_id` and gate on tag status via a SECURITY DEFINER helper; adding an archived-person join there is out of scope and risky). If graceful degradation does not already hold, add the guard in the card/roster component, not the view. Flag anything you find here rather than expanding scope silently.

**D4. Archived user's authored stories in the public feed.**
Recommended: hide them from public reads. A story by an archived author should not appear in the community feed/timeline or on entity Stories tabs to other viewers. The author still sees their own stories (the existing `ownAuthorList` / `author_id === viewer` branch in `/api/stories` already surfaces the author's own non-public content, so archiving must NOT break the author's own view).

**D5. Cy 3 handling.**
Recommended: after the feature is live and smoke-tested, archive Cy 3 through the new admin UI (not by raw SQL). This is the acceptance proof that the tool works end to end. A fallback SQL snippet is in §7 in case Jay wants it archived by hand first, but the intended path is the UI.

**D6. Admin surface placement.**
Recommended: a new `/admin/users` page listing all profiles with a search box, an Archived filter toggle, and a per-row Archive / Un-archive button with a confirm step. (Alternative: bolt the toggle onto the existing `/admin` membership editor. Recommended default is a dedicated `/admin/users` page so user lifecycle actions have a clear home and the membership editor stays focused on tiers/tokens.)

---

## 3. Verified facts (from live-repo pre-flight)

Provenance in parentheses. Verify anything marked (assumed) before relying on it.

1. **No existing status flag on profiles covers this.** `node_status` is a catalog classification (catalog | unclaimed | claimed | verified), NOT a user-visibility flag. `is_deceased` exists but is unrelated. There is no `is_archived` / `is_hidden` / `is_active`. (`src/types/index.ts` ~L244-293; grep.)

2. **profiles is read directly with the anon key in the catalog load**, selecting a fixed column list, then merged into `catalog.people`:
   `supabase.from("profiles").select("id, display_name, birth_year, riding_since, privacy_level, bio, links, home_resort_id, membership_tier, node_status, avatar_url, card_bg_url")` (`src/store/lineage-store.ts` ~L196-198). The merge that builds `profilePeople` is ~L248-264. **This is the single highest-leverage filter point**: almost every public people surface (directory, compare, connections, profile cards, entity chips) reads from `catalog.people`.

3. **The `_public` views do NOT need changing.** `claims_public` and `story_riders_public` are `SELECT c.* / sr.*` with `security_invoker = true`, gating tag status through `public.tag_event_publicly_visible(uuid)` (a SECURITY DEFINER helper added in `20260616000001_bug060_tag_visibility_definer.sql`; `claims_public` was last rebuilt in `20260617000001_bug066_rode_with_parent_claim.sql`). Adding a plain column to `profiles` does not touch these views (they do not select profiles' column list), so **no view rebuild is required** by this migration. Do not touch them.

4. **Admin API pattern to mirror:** `GET /api/admin/memberships` (`src/app/api/admin/memberships/route.ts`) calls `requireEditor()` (returns `{ response }`, early-return on `response`), then `getServiceClient()`, then `client.from("profiles").select(...)` and pulls emails via `client.auth.admin.listUsers({ perPage: 1000 })`, joining `emailById`. Reuse this exact shape for the users list.

5. **Admin gating:** `src/app/admin/layout.tsx` calls `requireEditorPage()` for the whole `/admin/*` tree; a new `/admin/users` page inherits that gate automatically. Mutating routes still enforce their own `requireEditor()`. (`src/lib/auth.ts` L56, L92, L130.)

6. **Owner-self visibility already has a hook.** `src/app/people/[id]/page.tsx` renders the owner's own profile via a branch that fires BEFORE the `notFound()` guard: `if (isAuthUser(activePersonId) && resolvedId === activePersonId) { ...render from self/override... }` (~L119, ~L196-200). This owner branch reads from `profileOverride` / self state, so it does NOT depend on the person being present in `catalog.people`. That means excluding an archived owner from `catalog.people` should still leave their own `/people/[id]` self-view working. **Verify this holds** for an archived owner (their own timeline, claims, stories still render for them).

7. **Self data endpoint exists:** `GET /api/me` reads the caller's own `profiles` row via service role (`src/app/api/me/route.ts` L46, L75). The account holder's own surfaces (`/me/timeline`, `/me/*`) resolve self through this path, not through the anon catalog read, which is what makes owner-self visibility clean.

8. **Stories read path:** `GET /api/stories` joins `author:profiles!author_id(display_name, avatar_url)` (~L68) and applies visibility filters at ~L83-88, with an `ownAuthorList` branch (`!storyId && !!viewerId && authorId === viewerId`, ~L79) that lets an author see their own non-public stories. Archived-author exclusion must be added to the PUBLIC list path only and must NOT strip the author's own view.

9. **"Cy 3" is a real production profile**, not mock/seed data (no match in `src/`; the `cy_2` slug appears in a migration comment, confirming the Cy accounts are prod test profiles). Look it up by `display_name = 'Cy 3'`. (assumed there is exactly one such row. Confirm with the §7 precheck; if there are duplicates, archive by `id`.)

10. **No global search / Cmd-K exists yet** in the codebase. Nothing to filter there today. Note it for whoever builds search later (see §9).

---

## 4. Scope of work

### 4a. Migration (one file, additive, idempotent)
Add `is_archived` (plus `archived_at`, `archived_by` per D1) to `profiles`. See §7 for the exact SQL.

- Not sent by any write path unconditionally, so this is **NOT a hard pre-merge migration gate**. Default apply order (migrate then merge) is safe.
- No `_public` view rebuild (per §3.3).

### 4b. Catalog exclusion (the primary lever)
In `src/store/lineage-store.ts` `loadCatalog()`:
- Add `is_archived` to the profiles `.select(...)` column list (~L196-198).
- In the `profilePeople` merge (~L248-264), exclude rows where `is_archived === true`.
- Owner-self carve-out: the merge runs with the anon client and may not know `activePersonId` reliably at load time. Recommended: exclude ALL archived rows from `catalog.people` and rely on the owner-branch in `people/[id]` (§3.6) + `/api/me` (§3.7) for the holder's own view. If pre-flight shows any owner-self surface DOES depend on the archived holder being in `catalog.people`, prefer fixing that surface to read self-state over re-including archived rows in the public catalog. Flag it if found.

### 4c. Story feed exclusion (D4)
In `GET /api/stories` public list path, exclude stories whose author is archived, WITHOUT breaking the `ownAuthorList` / `author_id === viewer` branch. Implementation options (pick per pre-flight): resolve archived author ids and `.not("author_id", "in", ...)` on the public branch, or post-filter the joined `author` after fetch. Keep the author's own-story view intact.

### 4d. Admin users page + API (D6)
- New page `src/app/admin/users/page.tsx`: list profiles (display_name, email, tier, created_at, archived state), a search box, an "Show archived" filter, and a per-row Archive / Un-archive action with a confirm dialog. Mirror the data fetch from `/api/admin/memberships` (§3.4).
- New route `PATCH /api/admin/users/[id]/archive` (or a single `/api/admin/users` route handling the mutation): `requireEditor()` gate, `getServiceClient()`, `UPDATE profiles SET is_archived = $1, archived_at = (now or null), archived_by = (caller id or null) WHERE id = $2`. Return the updated row.
- Add a nav entry to the admin surface for the new page (match how the other `/admin/*` pages are linked).

### 4e. Profile detail hardening (D3, owner carve-out)
Confirm `people/[id]` public view returns `notFound()` (or a "not available" state) for an archived person when the viewer is NOT the owner, while the owner branch (§3.6) still renders for the holder. Since the archived person is already absent from `catalog.people`, a non-owner visiting their URL will hit the existing `if (!resolvedPerson) notFound()` at ~L200 for free. Verify, do not assume.

---

## 5. Acceptance criteria

1. `npx tsc --noEmit` clean.
2. Migration applies cleanly; `profiles.is_archived` defaults false for all existing rows (nobody hidden by the migration itself).
3. An editor can open `/admin/users`, find a user, archive them, and un-archive them, with a confirm step on archive.
4. After archiving a test user (use a throwaway before Cy 3): they no longer appear in `/people`, in compare, in connections, as an entity chip/roster row, or in the community feed/timeline, when viewed **logged out** and **as a different logged-in user**.
5. The archived user, **logged in as themselves**, still sees their own profile, timeline, claims, and stories unchanged.
6. Un-archiving fully restores the user to all public surfaces.
7. No claim card, roster, or story card crashes or renders a blank/broken card because a referenced person is archived (D3).
8. `claims_public` / `story_riders_public` untouched; no regression to event rosters or rode_with rendering (spot-check one event page and one multi-person story).
9. Cy 3 archived through the UI as the final step, confirmed hidden from a logged-out `/people` view.

---

## 6. Suggested build order

1. Migration file (§7). Apply to prod first (safe additive).
2. Catalog exclusion in the store (§4b) + add column to the select.
3. Admin API route (§4d).
4. Admin users page (§4d) + nav link.
5. Story feed exclusion (§4c).
6. Profile detail verification/hardening (§4e).
7. `tsc`, self-review, push, open PR.
8. Deploy: confirm migration applied, merge, smoke test with a throwaway archived account, THEN archive Cy 3 via the UI. Log the ship in `bugs/SHIP-LOG.md` (`type: feature`, `scope: user-archive`, `migration: <file>`).

---

## 7. Pre-flight SQL and migration

**Precheck (run first, read-only) to confirm Cy 3 is a single row:**
```sql
select id, display_name, membership_tier, node_status, created_at
from public.profiles
where display_name = 'Cy 3';
```
If more than one row returns, archive by the specific `id` in step 8, not by display_name.

**Migration** `supabase/migrations/20260705000001_profiles_is_archived.sql`:
```sql
-- Admin user archive (soft hide). Additive, idempotent, reversible.
-- is_archived hides a profile from all PUBLIC surfaces; the account holder
-- still sees their own profile/timeline. No data is deleted. archived_at /
-- archived_by are a lightweight audit trail (who hid this, when).
--
-- Not sent by any write path, so this is NOT a pre-merge migration gate.
-- Does not affect claims_public / story_riders_public (those select the
-- claims / story_riders column lists, not profiles), so no view rebuild.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_by uuid;

COMMENT ON COLUMN public.profiles.is_archived IS
  'Admin soft-hide. When true, the profile is excluded from all public reads (people directory, connections, compare, feed, entity rosters/chips, search). The account holder still sees their own profile when logged in. Reversible; no data deletion.';
```

**Fallback manual archive of Cy 3** (only if Jay wants it done before the UI ships; the intended path is the admin UI):
```sql
update public.profiles
   set is_archived = true, archived_at = now()
 where display_name = 'Cy 3';
```

**Un-archive (rollback for any account):**
```sql
update public.profiles
   set is_archived = false, archived_at = null, archived_by = null
 where id = '<profile-id>';
```

---

## 8. Playbook checks applied

- Schema introspection: confirmed no existing archive flag; identified the exact profiles select in the catalog load and the merge point.
- Code-path grep / read-path inventory: catalog.people is the primary lever; stories author path and profile-detail owner branch identified with line refs.
- `_public` view freeze (CLAUDE.md gotcha #9): confirmed this migration does NOT require a view rebuild, and the reason (profiles column not in the views' select list). Called out explicitly so nobody rebuilds them unnecessarily.
- Migration-before-merge gate (Group F): assessed and cleared. The column is not written by any insert/update path, so migrate-then-merge is safe and there is no insert-500 window.
- Owner-self invariant scaffold: the "holder still sees own profile" requirement is pinned to the existing owner branch in `people/[id]` and `/api/me`, with a verification step rather than an assumption.
- Surface-existence audit: search/Cmd-K confirmed not to exist yet (nothing to filter); leaderboard/contributor lists read from catalog.people so the single exclusion covers them.
- No em dashes anywhere in this brief.

---

## 9. Deferred / future (explicit non-goals)

- **Hard delete / cascade removal** of a user and their data. A genuinely destructive, irreversible action; separate brief if ever needed. Archive covers test-account cleanup without it.
- **Account lockout / suspension** (block an archived user from signing in or writing). This brief keeps archive as a visibility action only.
- **Bulk archive** and an audit log UI over `archived_by` / `archived_at`.
- **Search exclusion**: whoever builds global search / Cmd-K must exclude `is_archived` at that time.
- **Full claims-roster filtering** of archived subjects at the data layer (D3), if graceful card degradation proves insufficient in practice.
