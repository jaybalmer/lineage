# Bug-fix brief: contribution-token farming via add / delete / re-add

**Drafted:** June 24, 2026 (daily triage). **Scope:** BUG-103. **Priority:** P1 (equity integrity).
**Run mode:** HUMAN-RUN. This touches the token / equity ledger; it is excluded from the autonomous auto-merge pipeline. Jay should read the DECISIONS block before a build.

---

## Goal

Stop a member from re-earning contribution tokens by adding a timeline entry, deleting it, then re-adding it. Contribution tokens feed the equity offer (the Sept 30 snapshot weighting and the live "Your share so far" estimate), so the integrity of the count matters.

---

## DECISIONS (review before building)

- **D1. Award model.** Recommended default: **award once per unique earned action**, and do NOT re-award when a member re-adds an entity/claim they previously added (and deleted). Implement as an idempotency guard on the award path keyed on the action identity (see D3). Alternative: keep awarding on every add but **claw back** (decrement `token_contribution` and write a negative `token_events` row) on delete. The idempotency-guard default is simpler, avoids negative balances, and preserves the existing "best-effort, never blocks the contribution" property of `awardContributionTokens`.
- **D2. Retroactive claw-back of already-farmed tokens.** Recommended default: **NO** retroactive reversal at launch. Just stop new farming; do not try to reconcile balances already granted (the daily cap bounded the damage to <= 20/day, and a retroactive sweep risks zeroing legitimate earns). Optional follow-up: a one-off audit query of `token_events` for same-key duplicates if Jay wants to quantify it.
- **D3. Idempotency key shape.** Recommended default for claim awards: `(user_id, source, subject_id, object_id, predicate)`; for story awards: `(user_id, source, story_id)`; for entity awards: `(user_id, source, entity_type, entity_id)`. "Earned once ever" means: before granting, check whether a prior `token_events` row exists for that key (the ledger already records `user_id`, `source`, `amount`, `created_at`; it does NOT currently record the target id, so see "Migration note").
- **D4. Scope of this fix.** Recommended default: cover the claim path (`POST /api/claims`, the path the reporter exploited) AND the story / entity / connection paths that share `awardContributionTokens`, since all four have the same no-idempotency shape. Minimum viable is the claim path alone; doing all four closes the class.

---

## Verified facts (code-checked June 24)

- `src/lib/tokens.ts` -> `awardContributionTokens(db, userId, amount, source)` is the single award primitive. It enforces a soft daily cap (`DAILY_CONTENT_TOKEN_CAP = 20`) by summing `token_events.amount` for the current UTC day across `CAPPED_SOURCES`, then calls the `increment_contribution_tokens` RPC and inserts a `token_events` ledger row. It is best-effort: any failure logs and returns 0, never blocking the contribution.
- There is **no per-entity / per-action idempotency**: the same subject/object/predicate can be awarded repeatedly (bounded only by the daily cap), and a re-add after a delete is a fresh award.
- There is **no claw-back on delete**: `removeClaim` in `src/store/lineage-store.ts` calls `DELETE /api/claims/[id]`, which runs the PB-009 disable cascade but does not decrement `token_contribution` or write a reversing `token_events` row.
- Callers of `awardContributionTokens` (all award on insert, none idempotent):
  - `src/app/api/claims/route.ts:253` (`contribution_entry`, +1) and `:255` (`contribution_source`, +2)
  - `src/app/api/stories/route.ts:348/350/353` (`contribution_entry` +1, `contribution_media` +1, `contribution_source` +2)
  - `src/app/api/catalog/entity/route.ts:213` (`contribution_entity`, +2)
  - `src/app/api/stories/[id]/connections/route.ts:202` (`contribution_connection`, +1)
  - `src/app/api/claim-requests/[id]/route.ts:218` (`contribution_onboard`, +5; outside the cap; lower farming risk but still no idempotency)
- The contribution count is equity-linked: the same screen shows "Your share so far: ~460 shares (0.46%)" (see `project_token_system_equity_offer` memory; equity pool 100k, weighted, Sept 30 2026 snapshot).

## Migration note

The `token_events` ledger currently records `user_id`, `token_type`, `amount`, `source` (no target id), so an idempotency check keyed on the action identity needs a way to recognise a repeat. Two options:

- **A (recommended, additive column):** add a nullable `token_events.dedup_key text` (the D3 key), set it on every award insert, and before granting, check for an existing row with the same `(user_id, dedup_key)`. A partial unique index `(user_id, dedup_key) where dedup_key is not null` makes the guard race-safe and self-documents. This is an additive migration; surface the SQL in the Ship sequence and apply it BEFORE merge if the write path sends the new column unconditionally (Group F lesson).
- **B (no migration, weaker):** key the idempotency check off the existence of the underlying record rather than the ledger (e.g. for claims, only award if no prior `token_events` for this user with this source today AND the subject/object pair is genuinely new). Harder to make correct; A is cleaner.

Recommend A. Treat it as a hard pre-merge migration gate if the insert path writes `dedup_key` unconditionally.

## Suggested implementation order

1. Decide D1 to D4 with Jay (this is the gate).
2. If column A: write the additive migration (`token_events.dedup_key` + partial unique index), surface the SQL, apply before merge.
3. Extend `awardContributionTokens` to accept the dedup key and short-circuit (return 0) when a prior award for `(user_id, dedup_key)` exists; keep the daily-cap behaviour for genuinely new actions.
4. Thread the key through the four capped callers (claims, stories, entity, connections). Optionally the onboard path.
5. `npx tsc --noEmit` clean. Manual smoke on a test account: add a claim (tokens +1), delete it, re-add it (no new tokens); add a genuinely different claim (tokens +1); confirm the daily cap still trips at 20.

## Acceptance criteria (BUG-103)

- Re-adding a claim/entity/story that was previously added and deleted does NOT grant new contribution tokens.
- A genuinely new contribution still earns (and still respects the 20/day cap).
- `profiles.token_contribution` and `token_events` reflect net unique contributions, not add/delete churn.
- No negative balances introduced; the award path stays best-effort and never blocks a contribution.
- No retroactive balance changes unless Jay opts into D2.

## Ship reminders

- Name BUG-103 in the PR title.
- Run the full Ship sequence: surface every migration as copy-paste SQL, apply before merge (hard gate if the write path sends `dedup_key` unconditionally), confirm the merge, then log the SHIP-LOG entry (`type: bugfix`, `ids: BUG-103`, real PR number, `migration:` set, `status: merged` once Jay merges in-session).
- No em dashes anywhere.
