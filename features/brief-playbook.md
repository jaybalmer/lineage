# Lineage Brief Pre-Flight Playbook (24 checks)

> Codified 2026-07-02 from Cowork auto-memory (`feedback_brief_drafting_schema_check.md`) so both
> Cowork (brief drafting) and Claude Code (brief consuming) can read it in-repo. Cowork's memory
> copy remains the authoring master; update BOTH when a new check is banked.
> Run these before locking any handoff brief that includes migration SQL, write-path changes,
> backfills, state-management features, new UI surfaces, cross-user endpoints, or worktree work.
> Claude Code: when a brief cites "the 24-check playbook," this file is the reference.

## Group A: schema and code-path verification (PB-009 P1)

1. **Schema introspection.** Grep `supabase/migrations/` or read table DDL for every table touched. Verify column names, types, PK shape. Never assume.
2. **Code-path existence grep.** Every `/api/...` route the brief names must be confirmed to exist; if not, describe the real write pattern.
3. **Data-quality question.** Before any backfill or FK-dependent migration, ask Jay about known integrity issues in the affected tables (orphan FKs, type mismatches, legacy mock ids).
4. **Pseudocode discipline.** Any SQL/code not verified against the real schema gets tagged "pseudocode, verify before running" at the block, not just once per section.
5. **PostgREST + views.** Repointing reads to Postgres views can break embedded relationship selects; flag the separate-fetch refactor risk.

## Group B: surface, lifecycle, and contract checks (PB-009 P2)

6. **Forward-warning grep.** `grep -rn "Phase [0-9]\|TODO.*Phase\|FIXME.*Phase" src/ supabase/` over the surface area a next phase touches. Prior phases leave time-capsule warnings.
7. **Surface-existence audit.** For every "X appears at surface Y" acceptance criterion: does Y fetch the needed data TODAY? Two-minute grep per criterion.
8. **Lifecycle inventory.** State features must answer when state is RESET, DISABLED, ORPHANED, CLEANED UP, not only when it is SET.
9. **Assertion precheck.** Every "expect 0" SQL assertion must return 0 against current prod BEFORE the brief ships.
10. **Component-capability check.** `cat` any component a promised UX detail depends on (e.g. toasts have no action button).
11. **Whole-file preflight reads.** Every file the phase mutates or contractually depends on gets a whole-file read, not a skim.

## Group C: endpoints, auth/data quality, terminology, helpers (PB-009 P3)

12. **Endpoint-to-surface pairing.** Every new endpoint pairs with a "where in the UI" line; a small table `endpoint -> UI trigger -> affordance` mid-brief.
13. **Orphan-auth audit.** Cross-user features: run `SELECT count(*) FROM auth.users u LEFT JOIN profiles p ON p.id = u.id WHERE p.id IS NULL;` during drafting; non-zero means defensive handling or prerequisite cleanup.
14. **Catalog-quality audit.** Features over catalog data: sample-quality query first (e.g. non-uuid ids: `SELECT count(*) FROM people WHERE id !~ '^[0-9a-f-]{36}$';`).
15. **Terminology discipline.** Decline = owner consent over self. Remove = editor moderation. Restrict = editor bans asserter. Block = owner curates own stream. Fix labels at brief time.
16. **Status indicators for conditional actions.** Anywhere a button conditionally hides, the UI must show WHY (muted pill + explanation is the usual answer).
17. **Test-setup scaffold for prior-phase invariant conflicts.** When a new phase's test scenario collides with an earlier phase's gate (e.g. hidden pending tags vs acting on pending tags), the brief must scope the visibility change in, provide setup SQL, specify an override flag, or document the manual workaround. "Find it by some other route" is not a scaffold.
18. **Helper-output audit.** Sample-print every label/format helper the brief's UI sections consume (voice and person of the output matter).
19. **Post-migration function check.** Migrations that CREATE OR REPLACE a plpgsql function include a `pg_get_functiondef()` assertion post-deploy.

## Group D: dev server and copy prefs (PB-009 P4)

20. **Dev-server source prerequisite.** State explicitly which directory `npm run dev` runs from for smoke; stop stale dev servers so port 3000 binds to the right instance.
21. **Standing copy preferences.** Pull user copy rules from memory at draft time. Canonical: NO EM DASHES anywhere (use periods, commas, parentheses, colons, semicolons).

## Group E: premise verification (PB-011 P3A)

22. **Verify the premise of a prescribed change.** Before writing "remove/change X so that Y," read the source and confirm X exists and Y is not already true. Premise errors cause wrong builds, not just wasted reads.

## Group F: deploy sequencing and view rebuilds (Boards redesign)

23. **Migration-before-merge gate.** If a new column is sent unconditionally by a write path, the migration MUST apply to prod before the PR merges (otherwise every insert on that path 500s in the window). Only merge-first when the write path tolerates the column's absence.
24. **`_public` view rebuild.** Postgres freezes a view's column list at creation. Any new publicly-read column on `claims` or `story_riders` requires a `CREATE OR REPLACE VIEW` for the matching `_public` view, plus an information_schema assertion that the view exposes the column.

## Carry-forward positives (keep doing these verbatim)

Tight phasing; hard out-of-scope list; suggested order with the activating flip LAST; single-flip-point rollback; data-quality questions answered before code touches the repo; pseudocode honesty; verified-facts catalog with provenance (file:line); rollback recipe; DECISIONS block with shippable defaults so briefs never block on Jay; brief states its own size honestly and trims this playbook to the relevant subset for small sessions.

## Sources

Group A: `Operations/Archive/pb009-phase1-cowork-feedback.md`. Group B: `...phase2-cowork-feedback.md`. Group C: `...phase3-cowork-feedback.md`. Group D: `...phase4-cowork-feedback.md`. Group E: PB-011 Phase 3A feedback (June 3 2026). Group F: Boards-in-Timeline session (PR #58/#59, June 11 2026).
