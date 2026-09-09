# BUG-188: the persisted store outgrew the browser's localStorage quota, so every store write throws for signed-in users

**Drafted:** September 8, 2026 (Sentry intake, Cowork triage).
**Verified against:** `main` @ `cdb0224`.
**Scope:** one file (`src/store/lineage-store.ts`), plus one optional storage wrapper.
**Classification:** PIPELINE-SAFE on the code change. No migration, no SQL, no auth surface, no `_public` view. It does touch the client write path for every store action, so read section 5 before deciding whether to run it unattended.
**Estimated size:** 30 to 60 minutes including smoke on a real iPhone.
**Severity:** P0. Not cosmetic, not edge case. See section 1.

---

## 0. What this is, honestly

This is a two-line fix to a problem that took a measurement to find, and the measurement is in section 3 so nobody has to repeat it. There is no diagnosis step left: the failing call, the slice that fills the quota, the byte count, and the merge that tipped it over are all pinned. What the session needs to get right is the second half, which is that removing a key from `partialize` stops it being WRITTEN but does not stop the already-written copy being READ back on the next load. That is decision D3 and it is the part most likely to be missed.

The 24-check playbook is trimmed here. The checks that apply are the write-path audit, the lifecycle question (what happens to already-persisted blobs), and the component-capability check on the storage wrapper. There is no surface-existence question and no data-quality question.

---

## 1. Goal

A signed-in member on iOS must be able to add a claim (or fire any other store action) without the app throwing `QuotaExceededError`.

**Why this is P0 and not the P2 it looks like.** The throw does not come from the boards page. It comes from `set()`, which every single store action calls. Zustand's `persist` middleware runs `localStorage.setItem` synchronously inside `set` with no `try`/`catch` (verified, section 3 fact 4), so once the serialized store exceeds the origin's quota, **every** store action throws: `addClaim`, `addToast`, `setActivePersonId`, `setMembership`, `dismissToast`, `queueCelebration`, `setPendingTagCount`. In `addClaim` specifically the throw lands on the FIRST line of the action (`lineage-store.ts:417`), which means the `supabase.auth.getSession()` block below it never runs and the claim is **never written to the database**. The member taps "add", the app throws behind the UI, and nothing is saved. There is no workaround and no retry that helps, because the condition is persistent for as long as that browser holds a session.

---

## 2. DECISIONS (review before building)

Three decisions. The brief is build-ready on the recommended defaults.

**D1. What to stop persisting.**
- **Recommended default: stop persisting `userEntities` for signed-in users only.** `userEntities` is a full mirror of the `places`, `boards`, `orgs` and `events` tables for every authed member (`loadDbEntities`, `lineage-store.ts:881-907`), and it is 2.6 million characters today. It does not need to survive a reload: `Nav` re-runs `loadDbEntities()` on every mount for every auth session (`nav.tsx:105-111`). Keeping it anonymous-only preserves the one case that genuinely needs persistence (D2) and costs one conditional:

  ```ts
  partialize: (s) => {
    const { dbClaims: _db, catalog: _cat, /* ...unchanged... */ ...rest } = s
    // The authed userEntities is a full mirror of four catalog tables (see
    // loadDbEntities). Nav refetches it on every mount, so persisting it buys
    // nothing and costs ~5MB, which is the whole localStorage quota (BUG-188).
    return isAuthUser(s.activePersonId)
      ? { ...rest, userEntities: EMPTY_USER_ENTITIES }
      : rest
  }
  ```
- Alternative: drop `userEntities` from the persisted set unconditionally. Simpler, one destructured key, but it breaks D2's case.

**D2. What happens to an anonymous add made during onboarding.**
- **Recommended default: keep persisting it, which the D1 default already does.** An anonymous add writes the entity to both `userEntities` and `catalog` (`lineage-store.ts:635-638` for places, same shape for boards/orgs/events), and `catalog` is not persisted, so `userEntities` is the only thing carrying that entity across a reload before signup. `onboarding.board_ids` / `event_ids` are persisted and would point at an entity that no longer exists locally if this were dropped. The anonymous blob is a handful of rows, not a mirror, so it is never near the quota.
- Alternative: drop it too and accept that a mid-onboarding reload loses the place or brand the visitor just added. Only take this if the conditional in D1 is judged not worth carrying.

**D3. What to do about blobs that are already on disk. Do not skip this.**
- **Recommended default: bump `version` to `1` and add a `migrate` that strips `userEntities`.** `partialize` governs what is written, not what is read. On rehydrate zustand shallow-merges the stored object over the initial state, so a browser that successfully persisted the mirror before this fix would keep hydrating ~5MB back into memory on every load even after the fix ships. It would self-heal on the first successful write (setItem replaces the whole key), but relying on that means every affected browser carries the blob through at least one full page load for no reason. The explicit version bump removes the question:

  ```ts
  version: 1,
  migrate: (persisted) => {
    const { userEntities: _ue, ...rest } = (persisted ?? {}) as Record<string, unknown>
    return rest
  },
  ```
  There is no `version` key on the persist options today (verified), so this is the first one and `migrate` must be supplied alongside it: zustand discards the entire persisted state on a version mismatch when no `migrate` is given, which would sign members out of their local slices for no reason.
- Alternative: ship D1 alone and let it self-heal. Acceptable but leaves one avoidable slow load per affected browser.

**D4. Whether to add a quota-safe storage wrapper in the same PR.**
- **Recommended default: yes.** Wrap the persist storage so a full quota degrades instead of throwing into React event handlers. The codebase already uses exactly this pattern in two places (`use-board-image.ts:27-33`, `seen-celebrations.ts:78-84`), so it is house style, not a new idea. It is defense in depth: D1 fixes today's 5MB, the wrapper means the next thing that grows produces a missed save rather than a broken app.

  ```ts
  storage: createJSONStorage(() => ({
    getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
    setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* quota or private mode: skip the save (BUG-188) */ } },
    removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* no-op */ } },
  })),
  ```
- Alternative: ship D1 to D3 only and file the wrapper separately. The failure mode it guards against is silent data-not-saved instead of a loud throw, so there is a real argument for the loud version. Jay's call.

---

## 3. Verified facts (all checked against `cdb0224`, September 8, 2026)

1. **The failing call is `addClaim`'s optimistic update.** `src/store/lineage-store.ts:415-417`: `addClaim` opens with `set((s) => ({ sessionClaims: [...s.sessionClaims, claim] }))`. The Sentry stack's top frame is `addClaim`, called from an `onClick`, `mechanism: auto.browser.global_handlers.onerror`, `handled: no`. Sentry issue `af6bb91c3e64426e9d3ade311f9e93dc`, September 8 13:24 UTC, `https://linestry.com/snowboarding/boards?brand=Sims`, Chrome Mobile iOS 152 on iOS 26.6.1, `DOMException.code = 22`.
2. **`userEntities` is persisted.** `partialize` at `src/store/lineage-store.ts:1154-1157` excludes `dbClaims`, `catalog`, `catalogLoaded`, `showMemberCard`, `authReady`, `communities`, `catalogError`, `toasts`, `tokenEarnTick`, `celebrationQueue`, `showWelcomeCelebration` and `pendingTagCount`, and keeps everything else. `userEntities` is not in the exclusion list, so it is written to `lineage-store-v2` on every store action.
3. **`userEntities` is a full mirror of four catalog tables for every signed-in member.** `loadDbEntities` at `src/store/lineage-store.ts:881-907` runs `selectAll("places")`, `selectAll("boards")`, `selectAll("orgs")`, `selectAll("events")` and assigns the four result arrays straight into `userEntities`. `selectAll` (`:18-32`) pages until exhausted, so this is every row, not a page. `Nav` fires it once per auth session on mount (`src/components/ui/nav.tsx:105-111`), gated on `isAuthUser`, so it runs for every signed-in member on every cold load and never for an anonymous visitor.
4. **Zustand's persist has no `try`/`catch` around `setItem`.** `node_modules/zustand/middleware.js:358-373`: `api.setState = (state, replace) => { savedSetState(state, replace); return setItem() }`, and the store's own `set` wrapper does the same at `:370-373`. `setItem` calls `storage.setItem` which at `:300` is `storage.setItem(name, JSON.stringify(newValue, ...))` straight onto `localStorage`. Nothing catches. `zustand: ^5.0.11` per `package.json:32`. So a `QuotaExceededError` propagates synchronously out of every store action, after the in-memory state has already been updated.
5. **The measurement.** Fetched live from the production Supabase REST endpoint on September 8 from a browser page context, paging at 1000:

   | table | rows | serialized chars |
   |---|---:|---:|
   | `boards` | 3,666 | 1,817,343 |
   | `events` | 608 | 639,590 |
   | `orgs` | 168 | 113,242 |
   | `places` | 75 | 28,890 |
   | **total** | | **2,599,065** |

   localStorage is measured in UTF-16 code units, so 2,599,065 characters is **4.96 MB against a 5 MB quota**, before the JSON envelope, before `membership` / `onboarding` / `sessionClaims`, and before the four other keys already on the origin (`ph_..._posthog`, `lineage_event_images_v1`, `lineage_board_images_v1`, `lineage_place_images_v1`, plus the Supabase auth token). WebKit enforces a hard 5 MB per origin, which is why this surfaced on iOS first.
6. **What tipped it over, and when.** `boards` alone is 1.82M chars (3.47 MB). The `events` import that landed across **PR #240, #241 and #242** on September 7 and 8 added 608 rows at ~1,052 chars each, or 1.22 MB, taking the mirror from roughly 3.7 MB to 4.96 MB. `cdb0224` (#242) is the tip. The Sentry event fired the same day. The events import is not wrong; it is the last straw on a slice that should never have been persisted.
7. **The quota failure does not corrupt what is stored.** `localStorage.setItem` writes nothing when it throws, so `lineage-store-v2` keeps its last good (small) value and simply stops updating. An affected member's persisted state is stale, not damaged, and nothing needs repairing in the field beyond shipping the fix.
8. **`partialize` does not filter reads.** Zustand's default `merge` is a shallow `{ ...currentState, ...persistedState }`, so any key already in the stored blob is restored on rehydrate regardless of `partialize`. There is no `version` and no `migrate` on the persist options today (grepped, zero matches). This is the basis for D3.
9. **The anonymous add path writes to both slices.** `addUserPlace` at `:630-638` (and the board/org/event equivalents at `:679`, `:712`, `:779`) inserts into `userEntities` and `catalog` together, and returns early before the network call when `!authed && opts.anonymousOk`. `AddEntityModal` is the only caller passing `anonymousOk` (`src/components/ui/add-entity-modal.tsx:175`, from its `allowAnonymous` prop). This is the case D2 protects.
10. **Quota-safe storage is already house style.** `src/hooks/use-board-image.ts:27-33` wraps `localStorage.setItem` in `try { } catch { /* storage full or SSR */ }`, and `src/lib/seen-celebrations.ts:78-84` carries the same guard with the comment "Quota exceeded or storage unavailable". The sibling hooks `use-event-image.ts` and `use-place-image.ts` follow suit. D4 applies the same pattern to the store.
11. **`isAuthUser` and `EMPTY_USER_ENTITIES` are both already in scope** in `lineage-store.ts` (`EMPTY_USER_ENTITIES` is defined at `:88-90`, `isAuthUser` is exported from the same module), so the D1 default needs no new import.

---

## 4. Suspected files

**Change:**
- `src/store/lineage-store.ts` (the persist options block at `:1150-1158`, D1/D3/D4). Nothing above it needs to move.

**Read for context, do not change:**
- `src/store/lineage-store.ts:881-907` (`loadDbEntities`, why the mirror exists and why it is safe to drop)
- `src/components/ui/nav.tsx:105-111` (the refetch that makes persistence unnecessary)
- `src/hooks/use-board-image.ts:27-33` and `src/lib/seen-celebrations.ts:78-84` (the wrapper pattern for D4)

---

## 5. Traps

1. **Do not "fix" this by trimming columns off `loadDbEntities`.** Selecting fewer board columns buys a few hundred KB and puts the same failure two catalog imports away. The slice should not be persisted at all; that is the fix.
2. **Do not remove `loadDbEntities` or the `[...catalog.X, ...userEntities.X]` merges in this session.** They are wrong for a different reason (see section 7) and unpicking them touches nine files. This PR is the quota, nothing else.
3. **`partialize` alone is not the whole fix.** See fact 8 and D3. A session that ships only the `partialize` edit and calls it done has left every already-affected desktop browser hydrating the blob.
4. **Do not bump `version` without supplying `migrate`.** Zustand discards the entire persisted state on an unhandled version mismatch, which would drop `onboardingComplete`, `membership` and `activeCommunitySlug` for every existing member.
5. **Smoke this on a real iPhone, not a desktop viewport.** The quota is a WebKit limit, not a screen width. Chrome DevTools' device mode still runs Blink and will not reproduce it.

---

## 6. Acceptance criteria

1. `npx tsc --noEmit` clean.
2. Signed in on an iPhone at `https://linestry.com/snowboarding/boards?brand=Sims`, adding a board to the timeline saves the claim and produces no `QuotaExceededError` in Sentry.
3. In the browser console on a signed-in load, `localStorage.getItem("lineage-store-v2").length` is under 20,000 characters and `JSON.parse(...).state.userEntities` is either absent or the empty shape.
4. The Add Claim modal's board picker still lists boards after a signed-in cold load (proving `loadDbEntities` still hydrates the in-memory slice).
5. Signed out, adding a place through onboarding and reloading the tab keeps that place in the list (D2 default only).
6. On a browser that carried the pre-fix blob, one load after the fix leaves `lineage-store-v2` small (proves D3).
7. Existing members are not signed out and do not lose `onboardingComplete`, `membership` or `activeCommunitySlug`.

---

## 7. Banked for a separate session, do not build here

**The same mirror also duplicates every catalog entity in the pickers (filed as BUG-189).** `loadCatalog` (`:256-263`) and `loadDbEntities` (`:885-890`) both `selectAll` the same four tables, into `catalog` and into `userEntities`. Every read site then concatenates the two without deduping, for example `src/components/ui/add-claim-modal.tsx:458-462`, so a signed-in member's board picker holds 3,666 + 3,666 = 7,332 entries with every board listed twice. Same for places, orgs and events, and the same pattern appears in `brands/[slug]/page.tsx:389`, `places/[id]/page.tsx:59` and `events/[id]/page.tsx:724`. It is also ~2.6 MB of redundant network on every signed-in cold load. Fixing it properly means deciding whether `userEntities` should go back to being only locally-added entities, which is a design call across nine files, not a quota patch.

---

## 8. Ship sequence

No migration this session. Standard: branch, `npx tsc --noEmit`, push, open the PR, merge with `gh pr merge`, then append the `bugs/SHIP-LOG.md` entry with `type: bug`, `ids: BUG-188`, `migration: none`, `status: merged`.
