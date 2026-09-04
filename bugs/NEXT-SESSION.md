# NEXT SESSION

**Status: BUILD-READY**
**Updated: September 4, 2026 (daily triage)**

> **PII convention is live (Sep 4).** `bugs/` and `features/` are committed to git now, so raw reporter data must never be written into them. Reporters are `R1`..`R4` / `OWNER`, PostHog replays are `S-01`..`S-52`, and the keys stay local in `bugs/private/`. New intake that arrives with an address or a replay link: run `python3 bugs/scrub-pii.py` before committing (`--check` to see what is dirty without writing). A reporter the key does not know makes the script stop rather than guess: add them to `bugs/private/reporters.md`, then re-run.

> **Sep 4 triage. Zero intake in both lanes, nothing merged, nothing reconciled. The brief set below is unchanged and was re-verified against the working tree. Everything that matters this run is about the stranded diff, and it got worse in a specific way.**
>
> **0. The badge cluster is STILL uncommitted, now SIX days, and it has started migrating across branches.** RUN-LOG records `2026-09-04 05:14 PDT ... aborted, working tree has uncommitted changes to tracked files` (log `~/Library/Logs/linestry-autobugfix/20260904-051427.log`). That is four dirty-tree aborts (Aug 31, Sep 1, Sep 2, Sep 4) plus one `gh not authenticated` abort (Sep 3) in five days. The same nine tracked files are modified, +50/-17, matching the brief `bugs/2026-08-27-unverified-badge-consistency.md`, and `bugs/.auto-verdict.json` still reads `risk: safe`, `migration_required: false`.
>
> **NEW and important: `HEAD` is now `claude/snowboard-catalog-v0.3-review` (`e945b38`), five commits above `origin/main` carrying catalog data and scripts, and the badge diff came along in the working tree.** It has ridden three branches in six days (`auto/bugfix-20260830-2122`, `claude/snowboard-catalog-reconcile-hltji3`, now this one). **Do not just `git commit` from where you are, or presentational badge work lands on a catalog branch.** Do this: `git stash`, `git checkout main`, `git pull` (local `main` is stale at `f6ec7f8`, three PRs behind `origin/main` at `91625fe`), branch, `git stash pop`, re-run `npx tsc --noEmit`, commit naming BUG-177 and BUG-178, PR, merge, SHIP-LOG with `migration: none`. Nothing unattended can run until this is cleared.
>
> **1. Nothing merged, nothing reconciled.** `origin/main` is unmoved at `91625fe` since yesterday. No BUG id on any commit, so the Shipped section is untouched.
>
> **2. PR #214's tracker migration is still half done.** `git ls-files bugs/` still returns only `bugs/README.md`. Every actual tracker (this file, `bug-triage.md`, `SHIP-LOG.md`, `RUN-LOG.md`, all nineteen dated briefs, `archive/`, the whole `features/` set) is untracked-but-not-ignored, so a cloud session cloning `main` still cannot read any of it, and it all counts as untracked noise against the pipeline's tree check. `git add bugs/ features/` and commit is the missing half. Delete the five scratch probes first (`bugs/.write-test`, `.write_test`, `.writetest`, `.wt`, `.wtest`) and decide whether `bugs/.auto-verdict.json` belongs in `.gitignore` rather than in git. New this run: `data/catalog/existing-export-demo-baseline.csv` is also untracked and should be classified before that commit.
>
> **3. Both briefs re-verified this run. Line drift only, no substantive change, so neither was re-drafted.** BUG-179: `isCurrentUser` has moved to **`src/app/people/[id]/page.tsx:225`**, `authReady` is still absent from that file entirely, `showThatsMeAnon` is still at `:281`, and the `catalog-loader.tsx` demotion block is at **`132-134`**. Worth noting for the build: there is a **second** `setActivePersonId("")` at `catalog-loader.tsx:168` that the brief does not name, so check both call sites before concluding which one fired. BUG-120: the `useState`-once `?b=` read is at **`src/app/compare/page.tsx:476`**, `realProfiles` at `:408`, `allPeople` at `:433`, `catalogLoaded` still absent from the file, and the second emitter at `(community)/[community]/connections/page.tsx:99` is intact. Both briefs are good as written.
>
> **4. No new brief drafted this run, deliberately.** Zero intake means no new cluster to draft from, and both existing briefs verified clean. The queue is not the constraint right now; the uncommitted tree is.
>
> **5. BUG-174 is now fifteen days built and unmerged** on `origin/claude/public-stack-default-gating-6tzvvg` (`b75c000`, Aug 20 19:38 UTC), seven PRs behind main. Still the oldest finished-but-unshipped work in the repo, and now the second-oldest problem in this file after the badge diff.
>
> _Earlier:_
> **Sep 3 triage. Intake came back after seven silent runs and produced ZERO new bugs: all three reports were proposals and went to the feature queue. The brief set below is unchanged and was re-verified against the new tip. Two things did change and both matter more than the intake.**
>
> **0. The badge cluster is STILL uncommitted. FIVE days now, four consecutive aborted 05:00 runs.** Re-verified from the tree this run: the same nine tracked files from the finished BUG-177 / BUG-178 build are still modified with zero commits above main, `bugs/.auto-verdict.json` still reads `risk: safe` and `migration_required: false`, and tsc was confirmed clean with the diff in place on Aug 31. The brief is `bugs/2026-08-27-unverified-badge-consistency.md`. **Commit it naming both BUG ids, PR it, merge it, SHIP-LOG it with `migration: none`.** Nothing unattended can run until this is cleared. Note `HEAD` has moved off `auto/bugfix-20260830-2122` to `claude/snowboard-catalog-reconcile-hltji3` (four commits of catalog-reconcile work above `origin/main`, unmerged, unrelated), but the badge diff came along in the working tree and is still uncommitted.
>
> **1. NEW: `main` moved three PRs, and PR #214 left the tracker migration half done.** `origin/main` is now `91625fe`, up from `f6ec7f8`: **#212** public legal pages plus Facebook sign-in, **#213** landing copy tightening, **#214** "Track bugs/ and features/ in git". None names a BUG id, so nothing reconciled to Shipped. But #214 only replaced the `/bugs/` and `/features/` blanket gitignores with `/bugs/private/` and `/features/private/` and committed two READMEs. **Every actual tracker is still untracked**: this file, `bug-triage.md`, `SHIP-LOG.md`, `RUN-LOG.md`, all nineteen dated briefs, `archive/`, and the whole `features/` set. They are no longer ignored, just uncommitted, so a cloud session cloning `main` still cannot read any of them. **`git add bugs/ features/` and commit is the missing half, and it is a two-minute job that unblocks the entire point of that PR.** While you are there, delete the scratch files that will otherwise get committed with it: `bugs/.write-test`, `bugs/.write_test`, `bugs/.writetest`, `bugs/.wt`, `bugs/.wtest`. Decide whether `bugs/.auto-verdict.json` should be tracked or ignored.
>
> **2. PR #212 is auth-adjacent and lands near the open P1.** It added Facebook sign-in. BUG-179 is an identity/session bug. Re-grep the auth path before building it; the brief's mechanisms were re-verified this run and still hold, but #212 is exactly the kind of change that could have introduced a third mechanism.
>
> **3. Both briefs re-verified this run against tip `91625fe` (plus the uncommitted badge diff).** Small line drift, no substantive change, so neither was re-drafted. BUG-179: the owner-vs-public branch has moved from `page.tsx:217` to **`:219`**, and `authReady` is still absent from that file's store destructure at line 39 (which destructures `catalogLoaded` but not `authReady`), so the core finding holds; the `catalog-loader.tsx` demotion block still sets `setActivePersonId("")` then `setAuthReady(true)` on an empty `getUser()`. BUG-120: the `useState`-once `?b=` read has moved from `page.tsx:475-478` to **`:476-478`**, `catalogLoaded` still does not appear in that file, and `realProfiles` (line 408) still feeds `allPeople` (line 433) asynchronously. Both briefs are good as written; just expect the two-line offsets.
>
> **4. No new brief drafted this run, deliberately.** All three reports were proposals, not defects, so there was no new bug cluster to draft from. Two were lane-corrected out of the `[Linestry Bug]` lane (signed-in return-landing destination; sticky timeline context header with auto-hiding nav rows) and one was a third +1 on the parked **BUG-076** (individual claim cards flooding the feed). All three are in `features/feature-queue.md`. BUG-076 is now the most-repeated open item in the queue, three reports across eleven weeks, and this report was the first to name a grouping shape ("Geoff added X places to their timeline"); it is the strongest candidate for conversion into a feature brief in an attended session.
>
> **5. BUG-174 is now fourteen days built and unmerged** on `origin/claude/public-stack-default-gating-6tzvvg` (`b75c000`, Aug 20 19:38 UTC), and it is now SEVEN PRs behind main rather than four. Still the oldest finished-but-unshipped work in the repo.
>
> _Earlier:_
> **Sep 2 triage. Zero intake in both lanes, nothing merged, nothing reconciled. One thing changed and it is the thing that has been asked for three runs running: the pipeline-safe slot has a fresh, fully re-verified brief in it.**
>
> **0. The badge cluster is STILL uncommitted and the 05:00 slot aborted for the THIRD consecutive morning.** RUN-LOG records `2026-09-02 05:02 PDT ... aborted, working tree has uncommitted changes to tracked files` (log `~/Library/Logs/linestry-autobugfix/20260902-050244.log`), matching Aug 31 and Sep 1. Verified from the git refs this run: `HEAD` is still `auto/bugfix-20260830-2122`, that branch still points at `f6ec7f8`, which is still `main` and still `origin/main`. Zero commits above main, no new `auto/bugfix-2026090*` branch was ever created. Nothing has moved in 72 hours. Everything in the Sep 1 note below applies verbatim: nine tracked files from the finished BUG-177 / BUG-178 build, `.auto-verdict.json` reads `risk: safe` and `migration_required: false`, `tsc` was confirmed clean with the diff in place, the brief is `bugs/2026-08-27-unverified-badge-consistency.md`. **Commit it, PR it naming both BUG ids, merge it, SHIP-LOG it with `migration: none`.** Until then every unattended run keeps aborting.
>
> **1. NEW pipeline-safe brief drafted this run: `bugs/2026-09-02-compare-deep-link-prepopulate.md` (BUG-120, P2).** This closes the standing action item that the Aug 24, Aug 28 and Sep 1 notes all raised and none of them could act on, because there was no intake to draft from and every remaining brief was stale. BUG-120 was split out of the diagnosis-first `2026-07-03-compare-functional-pass.md` precisely so the unattended slot has a legal target: one client file, no migration, no view, no write path, no auth, no payments. It is re-verified against the current tree and it corrects two errors in the July 3 brief (its hard prerequisite is long resolved, and its root-cause diagnosis named the wrong data source). See the slot section below. **So once item 0 merges, the pipeline is no longer empty.**
>
> **2. BUG-179 remains the lead by priority and is unchanged.** Still ATTENDED / HUMAN-RUN, still diagnosis-first, still not for the unattended slot.
>
> **3. BUG-174 is now fourteen days built and unmerged** on `origin/claude/public-stack-default-gating-6tzvvg` (`b75c000`, Aug 20 19:38 UTC), four PRs behind main and needing a rebase, a GATED `profiles` backfill and a merge. Two full weeks. It is still the single oldest piece of finished-but-unshipped work in the repo.
>
> _Earlier:_
> **Sep 1 re-verification pass (12:06 PDT / 19:06 UTC).** A second scheduled run fired this afternoon and found nothing new to change. Zero further intake in either lane since the 09:16 run (the only report in the 2 day window is still BUG-179, Gmail id `1a0598bb3e48245d`, and the idea lane is empty). Nothing merged: main is still at `f6ec7f8` (PR #211, Aug 28), so nothing reconciled to Shipped and no brief went stale. The brief set below was re-checked file by file and every one it names is present. The working tree is STILL dirty with the same nine tracked files, so item 0 below is unchanged and the 05:00 slot is still blocked.
>
> **Sep 1 triage. Intake came back and it opened a P1. Two things to do, in this order.**
>
> **0. First, if the working tree is still dirty, commit and ship the badge cluster.** Nothing changed overnight. Branch `auto/bugfix-20260830-2122` still carries zero commits above main, and the same nine tracked files from the finished BUG-177 / BUG-178 unverified-badge build are still sitting modified: `src/components/ui/badge.tsx`, `src/components/feed/post-card.tsx`, `src/components/timeline/claim-card.tsx`, `src/components/ui/add-claim-modal.tsx`, `src/app/(community)/[community]/brands/page.tsx`, `.../places/page.tsx`, `.../events/page.tsx`, `.../boards/board-parts.tsx`, `src/app/claim/[token]/page.tsx`. Its verdict file `bugs/.auto-verdict.json` reads `risk: safe`, `migration_required: false`, and the Aug 31 run confirmed `npx tsc --noEmit` is clean with the diff in place. The brief is `bugs/2026-08-27-unverified-badge-consistency.md`. The two untracked paths (`.design-sync/`, `docs/design-system.md`) are long-standing and are not part of it. Until this is committed, PR'd and merged, the 05:00 slot will keep aborting with "working tree has uncommitted changes to tracked files".
>
> **Build this: `bugs/2026-09-01-owner-profile-claim-flip.md` (BUG-179, P1). Carries four open decisions, all with recommended defaults, and it is build-ready on those defaults.** A signed-in member's own timeline at `/people/<own-uuid>` can flip into the anonymous public view and offer "Is this you? Claim this profile". Two mechanisms verified against `f6ec7f8`: the owner-vs-public branch at `src/app/people/[id]/page.tsx:217` is taken with no `authReady` gate (that symbol appears nowhere in the file, though 17 other files use it), and `src/components/catalog-loader.tsx:118-135` blanks `activePersonId` then sets `authReady` true on any empty `getUser()` read, which demotes the owner mid-session. **This is ATTENDED / HUMAN-RUN and excluded from auto-merge** (auth-adjacent, same standing rule as BUG-054), so it does NOT unblock the 05:00 pipeline. It is also **diagnosis-first**: section 5 step 1 is a PostHog replay check that decides which mechanism fired, and there is a third possibility in section 4 that would send the report back to triage instead of to a fix.
>
> **Note on the pipeline: there is no pipeline-safe brief left in the slot.** The badge cluster WAS the pipeline-safe item and it is built but stranded; BUG-179 is attended-only. So even after item 0 is merged, the unattended run has nothing it is allowed to build. Worth drafting one deliberately rather than waiting on intake.
>
> **BUG-174 is now thirteen days built and unmerged** on `origin/claude/public-stack-default-gating-6tzvvg` (`b75c000`, Aug 20 19:38 UTC), four PRs behind main and needing a rebase, a GATED `profiles` backfill and a merge.
>
> **Standing rule, unchanged:** name the BUG ids in the PR title or commit message. The daily reconcile keys on that and nothing else.
>
> _Earlier:_
> **Aug 31 triage. START HERE: there is finished, type-clean work sitting uncommitted in the working tree, and it is blocking every unattended run.**
>
> **1. Commit and ship the unverified-badge cluster that is already built.** The Aug 30 21:22 run built `bugs/2026-08-27-unverified-badge-consistency.md` (BUG-177, BUG-178) in full, wrote `bugs/.auto-verdict.json` (`risk: safe`, `migration_required: false`), then self-recorded the run as `empty` and committed nothing: the narrow-commit logic from `64609b5` excluded the real edits along with the untracked scratch. The diff is still on branch `auto/bugfix-20260830-2122` (zero commits above `main`), nine tracked files, +50/-17: `src/components/ui/badge.tsx` (shared `UnverifiedBadge` now takes an optional `entityType` and renders `unverified place` / `unverified brand` / `unverified board` / `unverified event`, outline treatment chosen to survive `.postcard`), plus `post-card.tsx`, `claim-card.tsx`, `add-claim-modal.tsx`, `claim/[token]/page.tsx`, `brands/page.tsx`, `places/page.tsx`, `events/page.tsx`, `boards/board-parts.tsx`. **Verified this run: it implements the brief as drafted and `npx tsc --noEmit` exits clean with it in place.** Do not rebuild it. Read the diff, sanity-check the two copy decisions against the brief's DECISIONS block, commit on that branch naming BUG-177 and BUG-178 in the message, open the PR, merge it, append the SHIP-LOG entry with `migration: none`.
>
> **2. Until that tree is clean the 05:00 slot cannot run.** It aborted at 05:03 today with "working tree has uncommitted changes to tracked files, leaving your work alone". That is the pipeline behaving correctly and refusing to clobber the work; it just means item 1 is a prerequisite for the next unattended fire. The two long-standing untracked paths (`.design-sync/`, `docs/design-system.md`) are tolerated by the run and are not the blocker.
>
> **3. Zero intake in both lanes again** (Aug 29 to 31; only a Google DMARC report reached the Linestry address), nothing merged since PR #211, nothing to reconcile. The brief set below was re-verified against tip `f6ec7f8` and is unchanged. BUG-174 is now twelve days built and unmerged on `origin/claude/public-stack-default-gating-6tzvvg`.
>
> _Earlier:_
> **Aug 30 triage (21:2x PDT). Zero intake in either lane, nothing to reconcile, and THE PIPELINE-SAFE SLOT IS BEING BUILT RIGHT NOW.** Read this before you pick anything up.
>
> **1. Do not start the unverified-badge brief. A run already has it.** At 21:24 PDT the working tree on branch `auto/bugfix-20260830-2122` carried uncommitted edits to `src/components/ui/badge.tsx`, `post-card.tsx`, `claim-card.tsx`, `brands/page.tsx`, `places/page.tsx`, `events/page.tsx`, `boards/board-parts.tsx`, `claim/[token]/page.tsx` and `add-claim-modal.tsx`, holding a `.git/index.lock`, with the file set still growing between two checks 20 seconds apart. `badge.tsx` already carries a `// BUG-177 / BUG-178: single source of truth` header and `UnverifiedBadge` already takes an `entityType` prop. That is `bugs/2026-08-27-unverified-badge-consistency.md` being implemented to the letter, plus the `add-claim-modal.tsx` occurrences the brief did not name. BUG-177 and BUG-178 stay OPEN in the queue until that PR lands on main; the next run reconciles them. If you are that run, carry on and remember to name both BUG ids in the PR title, since the reconcile keys on them.
>
> **2. BUG-174 is now ELEVEN days built and unmerged** on `origin/claude/public-stack-default-gating-6tzvvg` (`b75c000`, Aug 20 19:38 UTC). It sits on `fa60777` (PR #207) and main is four PRs past it (#209, #210, #211), so it now needs a rebase on top of tonight's badge work as well as the GATED `profiles` backfill it always needed. This is the single oldest piece of finished-but-unshipped work in the repo, and it cannot close in the unattended slot: the backfill is GATED and the merge is Jay's call. It is the top ask for the next attended session.
>
> **3. The brief set below was re-verified against tip `f6ec7f8` this run and is unchanged.** PR #211 touched only `src/app/(community)/[community]/feed/page.tsx`, which no open brief names, so nothing went stale and nothing needed a re-draft. No new briefs were drafted this run because there was no new intake to draft from.
>
> _Earlier:_ **Aug 28 morning-digest reconcile (08:5x). SHIPPED: BUG-176 via PR [#211](https://github.com/jaybalmer/lineage/pull/211) (`f6ec7f8`, no migration, tsc clean), built and merged by the autonomous 05:00 pipeline the morning after the triage drafted it.** That is the pipeline's fourth ship in nine days (PRs #207, #209, #210, #211) and the second time the pipeline-safe slot has been refilled and emptied inside 24 hours. Moved to Shipped, SHIP-LOG flipped to merged, brief archived. The slot is now refilled with `bugs/2026-08-27-unverified-badge-consistency.md` (BUG-177, BUG-178), the companion brief from the same August 25 member session. **The lead is unchanged and still BUG-174, now EIGHT days built and unmerged.** Note: today's 04:xx daily triage did NOT complete (bug-triage.md was still dated August 27 at digest time), so the August 28 Gmail intake is unprocessed; re-run "bug triage" in Cowork to catch up.
>
> _Earlier:_ **Aug 27 triage. Intake is back, and the pipeline-safe slot is refilled.** Five reports landed in a single member session on August 25 (`R1`, iPhone Safari, one PostHog replay), the first intake in five days: three bugs (**BUG-176**, **BUG-177**, **BUG-178**) and two ideas (routed to `features/feature-queue.md`, not here). Two new briefs drafted this run, both freshly verified against tip `44fb3c5`, both client-only and migration-free.
>
> **1. Nothing merged since PR #210**, so nothing reconciled to Shipped. **BUG-174 is now SEVEN days built and unmerged** on `origin/claude/public-stack-default-gating-6tzvvg` (`b75c000`). It is still the lead and still the highest-value item in the repo: finished code waiting on a rebase, a migration and a merge. See the lead section below.
>
> **2. The 05:00 slot has now idled four of its last five runs.** `auto/bugfix-20260823-0502`, `auto/bugfix-20260825-0812` and `auto/bugfix-20260826-0819` all exist locally with **zero commits above `main`**. Only Aug 24 produced a ship (PR #210), and that was the one run with a fresh brief in the pipeline-safe slot. The correlation is not subtle: the slot works when it is loaded and idles when it is empty. It is loaded again below with `bugs/2026-08-27-feed-rider-name.md`. Also note both idle branches were created around 08:1x, not 05:0x, so the launchd job is now firing on a different clock than its name suggests.
>
> _Aug 24 morning-digest reconcile (10:50). SHIPPED: BUG-137 + BUG-134 via PR [#210](https://github.com/jaybalmer/lineage/pull/210) (`44fb3c5`), built and merged by the autonomous pipeline the same morning it was drafted, out of the pipeline-safe slot._

> **Aug 24 morning-digest reconcile. SHIPPED: BUG-137 + BUG-134 via PR [#210](https://github.com/jaybalmer/lineage/pull/210) (`44fb3c5`), built and merged by the autonomous pipeline the same morning it was drafted.** The triage promoted `2026-08-24-member-tier-label.md` into the new pipeline-safe slot at 04:xx; the run fired and took it. Brief archived, SHIP-LOG flipped to merged, both ids moved to Shipped in `bug-triage.md`. The pipeline-safe slot is now EMPTY and needs a fresh redraft at the next triage (see that section). Note the machine clock now reads EDT, so the "05:00" slot self-recorded at 08:07 EDT (05:07 PDT) and this digest ran at 10:50 rather than 07:15.

> **Aug 24 triage. Zero new reports in either lane for the fourth run running, but two things changed under the briefs and both matter.**
>
> **1. BUG-174 IS ALREADY BUILT AND SITTING UNMERGED.** Branch `origin/claude/public-stack-default-gating-6tzvvg`, commit `b75c000`, "fix(public-timeline): Public Stack on by default for every member (BUG-174)", authored **August 20 at 19:38 UTC**. It has been open four days. It carries the full scope of the lead brief: server-side starter derivation in `readPublicStack`, `ensureProfile` minting a `public_slug`, the Mini/Full rename, and migration `20260820000001` (the GATED `profiles` backfill, pre-approved in the brief). **There is no `bugs/SHIP-LOG.md` entry for it and it is not on `main`**, so that session opened the branch and stopped before the Ship sequence. Do NOT pull the BUG-174 brief and rebuild from scratch: check out that branch, rebase on `main`, re-run `npx tsc --noEmit`, apply the migration with the full ship-sequence printout, then merge. This is a finish-and-ship, not a build. Still ATTENDED, still not for the 05:00 auto slot.
>
> **2. The 05:00 pipeline had nothing it was allowed to build on Aug 23.** Branch `auto/bugfix-20260823-0502` was created and contains zero commits above `main`. This is not the same failure as Aug 21 (headless error) or Aug 22 (no branch): the slot ran cleanly and correctly found nothing to do, because BUG-175 shipped on Aug 22 and both the lead (BUG-174, ATTENDED) and "Next after that" (BUG-149, HUMAN-RUN) are gated against unattended runs. **Fixed this run:** the member tier-label cluster is redrafted, re-verified and promoted below as the explicit pipeline-safe slot.
>
> _Aug 22 morning-digest reconcile (07:15). The 05:00 pipeline DID fire._ The triage note below was written at 04:08 and recorded the auto slot as dead; the run actually started at 05:00, committed at 05:02 and merged **PR [#209](https://github.com/jaybalmer/lineage/pull/209)** (`300e030`) to prod at 05:03. It shipped **BUG-175** off the pipeline-safe "Next after that" brief, exactly the fall-through the Aug 21 note asked for. Brief archived to `bugs/archive/`; BUG-175 moved to Shipped. The lead below is unchanged (BUG-174 is still ATTENDED-only), and "Next after that" is repointed to BUG-149.
>
> _Aug 22 triage note (04:08): zero new reports in either lane for the second day running, and nothing merged to main since PR #207, so the brief set below is unchanged and still valid against tip `fa60777`. The 05:00 auto slot produced nothing again: no `auto/bugfix-20260822-*` branch was created at all, following yesterday's aborted headless run. Two dead slots in a row means the pipeline needs a look on its own terms, on top of the brief-selection gap noted below. BUG-175 is still the clean pipeline-safe candidate if the pipeline learns to pull from "Next after that"._
>
> _Aug 21 triage note: zero new reports in either lane; the brief set below is unchanged and re-verified against main (tip fa60777, PR #207). The 05:00 auto slot fired that day (branch auto/bugfix-20260821-0500) but built NOTHING: the lead is ATTENDED-only and the pipeline did not fall through to the pipeline-safe BUG-175 brief._

---

## Build this

**`bugs/2026-09-01-owner-profile-claim-flip.md`** (BUG-179, P1): NEW September 1, and the lead by priority.

A signed-in member's own timeline flips into the anonymous public view and offers "Is this you? Claim this profile". Reported Aug 31 at 20:38 UTC from `/people/315a92ff-acef-404d-ae20-b6b3eb01f8ea`, desktop Chrome, flagged Urgent. First open P1 since August 19.

Two mechanisms verified against `f6ec7f8`. (1) `src/app/people/[id]/page.tsx:217` decides owner-vs-public on `activePersonId` with no `authReady` gate; `authReady` appears nowhere in that file even though 17 other files use it and `OwnerTimelinePanel` itself gates on it at line 289. (2) `src/components/catalog-loader.tsx:118-135` blanks `activePersonId` and sets `authReady` true whenever `getUser()` returns no uid, which demotes a live owner mid-session; note the CTA polarity, `showThatsMeAnon` (line 281) turns ON when `isAuth` goes false.

**ATTENDED / HUMAN-RUN, not for the 05:00 auto slot** (auth-adjacent, same rule as BUG-054). **Diagnosis-first:** step 1 is the PostHog replay `S-49`, which decides which mechanism fired. Section 4 names a third possibility (an identity mismatch, if the SIGNED-IN CTA rendered rather than the anonymous one) that sends the report back to triage instead of to a fix. Four DECISIONS, all with recommended defaults, build-ready on them. No migration expected.

---

**`bugs/2026-08-20-public-stack-default-on.md`** (BUG-174): previous lead, still open and still unmerged.

Public Stack on by default for every member, plus the rename. Jay resolved both parked decisions live on August 20: same visibility rules as the main timeline, auto-derived starter of the 3 most recent public timeline items until the member curates, backfill everyone non-archived, and the member-facing pair is now **"Mini / Full"** (copy-only; internal identifiers keep `stack`, verified five-string inventory in the brief's Decision 4). Launch-facing during the FNRad traffic week: it makes every member profile shareable at `/t/[slug]` and fixes the inconsistent toggle.

Carries a GATED `profiles` backfill, pre-approved in the brief but apply it with the full ship-sequence printout, and run the brief's pre-flight SQL first (the `privacy_level` count decides one exclusion). ATTENDED or HUMAN-REVIEWED, **not for the 05:00 auto slot**. Merge the starter-derivation code before or with the backfill so nobody gets an empty Stack in the window.

> **READ THIS FIRST (Aug 24): the work already exists.** `origin/claude/public-stack-default-gating-6tzvvg` (`b75c000`, Aug 20 19:38 UTC) implements this brief in full and was never merged or ship-logged. Start from that branch. Rebase on `main` (four days of drift, tip `300e030`), re-verify the brief's pre-flight SQL against current prod, re-run `tsc`, apply migration `20260820000001` with the printout, merge, then write the SHIP-LOG entry. Rebuilding from the brief would duplicate a day of work and risk diverging from the decisions already encoded in that commit.

---

## Pipeline-safe slot (for the 05:00 unattended run)

> **STILL BUILT AND STILL NOT COMMITTED as of September 4, day six.** Verified again this run: the same nine tracked files, `+50/-17`, `bugs/.auto-verdict.json` unchanged at `risk: safe` / `migration_required: false`. **The new fact is that `HEAD` is no longer a bugfix branch: it is `claude/snowboard-catalog-v0.3-review` (`e945b38`), five catalog commits above `origin/main`, and the diff is riding it.** Stash it, check out and pull `main`, branch from there, then commit. See item 0 at the top of this file for the exact sequence. Until it merges the 05:00 slot keeps aborting, and once it merges this slot is EMPTY, with `bugs/2026-09-02-compare-deep-link-prepopulate.md` (BUG-120) below as the ready successor.
>
> _Sep 1:_ Re-verified this run: branch `auto/bugfix-20260830-2122`, zero commits above main, the same nine tracked files modified. Nothing changed in 24 hours. Everything in the August 31 note below still applies verbatim, and this remains the prerequisite for any unattended run. **Once it merges, this slot is EMPTY** and needs a new pipeline-safe brief, because the new lead (BUG-179) is attended-only.
>
> _Aug 31:_ **BUILT BUT NOT COMMITTED as of August 31. This brief is 95 percent done and the last 5 percent is a `git commit`.** The Aug 30 21:22 run implemented it in full on branch `auto/bugfix-20260830-2122` and then failed to stage the edits (see item 1 at the top of this file). Nine tracked files are still modified in the working tree, the diff matches the brief, and `npx tsc --noEmit` is clean with it in place. Do not rebuild from scratch: review the existing diff, commit it naming BUG-177 and BUG-178, PR it, merge it, SHIP-LOG it (`migration: none`). This also unblocks the 05:00 slot, which aborted on Aug 31 because the tree is dirty. _Superseded note (Aug 30): Branch `auto/bugfix-20260830-2122` is mid-build on this brief (uncommitted edits across `badge.tsx`, `post-card.tsx`, `claim-card.tsx`, the four catalog list pages, `claim/[token]/page.tsx` and `add-claim-modal.tsx`). Do not start a second run on it. If that build lands, the next triage moves BUG-177 and BUG-178 to Shipped and refills this slot; if it does not, the brief below is still valid as written._

**`bugs/2026-08-27-unverified-badge-consistency.md`** (BUG-177, BUG-178): PROMOTED August 28 by the morning digest.

The word "unverified" renders in three different treatments across the site, and where it does render it looks like a verdict on the rider's claim when it is actually a status on the catalog entity the claim points at. Both reported in the same August 25 session as the now-shipped BUG-176. BUG-177 is the visual fork (the shared `UnverifiedBadge` is a dark filled pill whose only feed appearance sits inside a `.postcard`, which forces light theme; five hand-rolled outline chips; a third palette on `/claim/[token]`). BUG-178 is the labelling: Geoff Peterson's Lyon Mountain entry is badged and his Lake Louise entry is not, which is correct and reads as arbitrary.

Why this one is safe for the unattended slot: presentational only, no migration, no `_public` view, no write path, no auth, no payments. Drafted August 27 and verified against tip `44fb3c5`. Carries five DECISIONS with defaults, including one copy call (D3, the recommended `unverified place` / `unverified brand` form) that Jay may want to weigh in on; the defaults are build-ready as written if he does not.

> _Previous occupant: `bugs/2026-08-27-feed-rider-name.md` (BUG-176), refilled by the Aug 27 triage and SHIPPED the next morning as PR [#211](https://github.com/jaybalmer/lineage/pull/211) (`f6ec7f8`), the pipeline's fourth ship in nine days. Archived at `bugs/archive/2026-08-27-feed-rider-name.md`. Owed at review: the Slow 3G hard-reload check and a signed-out look at 414px. Keep this slot loaded; the pipeline idles whenever it is empty._

---

## Also ready, and the natural companion to the slot above

**`bugs/2026-09-02-compare-deep-link-prepopulate.md`** (BUG-120, P2): NEW September 2, drafted and fully re-verified this run. **This is the successor the slot needed, and it is pipeline-safe.**

The Compare button on a rider page lands you on `/compare` with slot B empty. `src/app/compare/page.tsx:475-478` reads `?b=` inside a `useState` initializer, which runs once, at a moment when the only rider data present is the static mock array. The real riders arrive later from an async Supabase fetch (`realProfiles`, lines 409-427) that feeds `allPeople` (lines 433-448), so a real UUID cannot resolve at that instant and nothing ever re-runs the lookup. The fix is an effect that resolves when the data lands.

**This corrects the July 3 brief, which blamed `catalog.people` and `catalogLoaded`.** Neither is the mechanism, and `catalogLoaded` does not appear in that file. Separately, the July 3 brief's "HARD PREREQUISITE" is long resolved (BUG-014, BUG-024 and BUG-067 shipped via PRs #54 and #185), and BUG-120 has now been split out of it so the diagnosis-first BUG-123 does not drag this into an attended-only session. Do not run both briefs.

Why it is safe for the unattended slot: one client file, no migration, no `_public` view, no write path, no auth, no payments. Four DECISIONS, all with recommended defaults, build-ready on them. Verified this run against the working tree: the `useState`-once bug is still present verbatim, `catalog` is already destructured in the component (line 359) and `catalog.people` is already used there (lines 387, 392), so the recommended ghost-rider fallback needs no new import or fetch. Note it also covers a second emitter the July 3 brief did not know about, `(community)/[community]/connections/page.tsx:99`.

> _Superseded (August 28): "Nothing freshly verified is queued behind the slot." That gap is now closed. The other candidates named then, **BUG-117** (collective default frame) and **BUG-089** (Riding since staleness), remain un-re-verified and are the next redraft candidates after this one._

---

## Superseded slot note (August 24)

**Was EMPTY as of the August 24 morning-digest reconcile (SHIPPED same morning).**

`bugs/2026-08-24-member-tier-label.md` (BUG-137 primary, BUG-134 verify-then-close) was promoted into this slot by the 04:xx triage and the autonomous pipeline took it the same morning, merging PR [#210](https://github.com/jaybalmer/lineage/pull/210) (`44fb3c5`) to prod. The brief is archived at `bugs/archive/2026-08-24-member-tier-label.md`; the stale July 4 copy it superseded was archived alongside it. The slot did exactly what it was created for.

**Nothing has been promoted to replace it, and that is deliberate.** Every remaining brief in "Also ready to pull" was drafted between June 17 and July 5 and has NOT been re-verified since; most are also marked diagnosis-first or HUMAN-RUN, which is precisely what the unattended slot cannot do. Promoting a stale brief here would hand the 05:00 run a set of file and line references that no longer match the tree.

**Action for the next daily triage: redraft one small, fully re-verified cluster into this slot** or the pipeline idles again as it did on Aug 23. Nearest candidates on value, each needing a re-grep against tip `44fb3c5` first: **BUG-120** (Compare button on a rider page does not prepopulate that rider, root cause verified, currently bundled with the diagnosis-first BUG-123 in `2026-07-03-compare-functional-pass.md` and worth splitting out) and **BUG-070** (community timeline player's final slide shows "Start Your Timeline" to a signed-in viewer, screenshot reviewed, currently bundled with the diagnosis-first BUG-069 in `2026-06-17-community-profile-mobile-pass.md`).

---

## Next after that

**`bugs/2026-07-05-email-mark-render.md`** (BUG-149)

The magic-link sign-in email renders a fallback-font wordmark and no logo: `emailHeaderHtml()` in `src/lib/emails/shared-header.ts` embeds the v2 monogram as an inline SVG (most clients drop it) and sets the wordmark in Geologica (which no client can load, so it falls back to Arial). Every new signup sees this email, which makes it the highest first-impression item in the backlog during a traffic push.

P2, HUMAN-RUN in practice: the fix needs a hosted PNG of the monogram and a real send-and-look check in Apple Mail and Gmail, which an unattended run cannot do. Brief drafted July 5 and NOT re-verified since; re-grep `src/lib/emails/` before building.

> Reconcile note (Aug 22, 07:15 digest): the previous runner-up `2026-08-20-mention-group-collapsed-header.md` (BUG-175) SHIPPED at 05:03 via the autonomous pipeline as PR #209 and is archived. Owed at review: a look at an episode-group card on a rider profile (unattended session, no browser smoke).
>
> _Reconcile note (Aug 20, 07:15 digest): the previous lead `2026-08-19-brand-cta-consistency.md` (BUG-144, BUG-145, BUG-146, BUG-147) SHIPPED at 05:03 via the autonomous pipeline as PR #207 and is archived. The pipeline's first ship since July 6. Owed at review: the two-theme visual smoke and the 414px keyboard check (unattended session)._

---

## Standing rules for this session

- Name every BUG id in the PR title or commit message. The daily triage reconciles off those ids; if they are missing, the fix rots in the Queue.
- `npx tsc --noEmit` clean before commit. One PR per session.
- Run the **full Ship sequence** before wrapping (see the repo `CLAUDE.md`): classify migrations against the risk gate, apply SAFE ones yourself, merge the PR yourself with `gh pr merge` unless the exception list applies, then log the ship. Pushing the PR is the middle of the session, not the end.
- Append a `bugs/SHIP-LOG.md` entry. State `migration: none` explicitly when there is none.
- **No em dashes anywhere**, including in any UI copy you write.
- Do NOT edit the **Shipped** section of `bugs/bug-triage.md`. The daily triage reconciles that.

---

## Read this before pulling anything below

Every brief in the "Also ready" list was drafted between **June 17 and July 5** and has **not** been re-verified since. Since then the tree absorbed the brand-page redesign, the PB-011 shared lens row, the category intro cards (#190, #195), the curated member profile work (#164, #203) and the whole August bug batch (#191 to #202). **Re-grep the files and line numbers each brief names before you trust them.** The August 19 redraft of the brand-button brief exists precisely because that assumption failed once already.

---

## Also ready to pull (ordered by launch-facing value)

1. ~~**`2026-07-05-email-mark-render.md`** (BUG-149)~~ **PROMOTED August 22** to "Next after that" above; do not double-pull. The magic-link sign-in email renders a fallback-font wordmark and no logo. Every new signup sees this email, which makes it the highest first-impression item in the backlog during a traffic push. Email templates live in `src/lib/emails/`, shared chrome in `shared-header.ts`.
2. ~~**`2026-08-24-member-tier-label.md`** (BUG-134, BUG-137)~~ **SHIPPED August 24** via PR [#210](https://github.com/jaybalmer/lineage/pull/210) (`44fb3c5`), taken by the autonomous pipeline out of the pipeline-safe slot on the same morning it was drafted. Both this brief and the stale July 4 copy it superseded are now in `bugs/archive/`. Do not pull.
3. **`2026-06-17-community-profile-mobile-pass.md`** (BUG-069, BUG-070). Community nav header disappears on the membership page; the timeline player's final slide shows "Start Your Timeline" to a signed-in viewer. **Scope note: BUG-072 in this brief already shipped via PR #201.** Drop it before building.
4. **`2026-07-03-compare-functional-pass.md`** (BUG-123 only). The compare score changes when A and B are swapped (a symmetry bug fed by asymmetric inputs, not by `connection-summary.ts` itself). Diagnosis-first, so ATTENDED. **Scope note, September 2: BUG-120 has been SPLIT OUT of this brief** into the freshly verified `2026-09-02-compare-deep-link-prepopulate.md` now sitting in the pipeline-safe slot. Do not build BUG-120 from the July 3 file and do not run both. **Also stale in that file: BUG-014, BUG-024 and BUG-067 already shipped** (PRs #54 and #185), so its "HARD PREREQUISITE" no longer applies. Only BUG-123 remains.
5. **`2026-06-27-collective-default-frame.md`** (BUG-117). The collective timeline's default frame does not include the viewer's own year.
6. **`2026-06-25-earned-today-visit-token.md`** (BUG-108). "Earned Today" reads 0/20 while the breakdown shows a "Showing up +1 token" was earned. Carries a small decision.
7. **`2026-06-25-public-timeline-theme.md`** (BUG-113). The public stack and timeline view renders light where it previously read dark. HUMAN-RUN; this is the `/t/[slug]` surface Jay shares publicly.
8. **`2026-07-05-event-photo-layout.md`** (BUG-143). Adding a photo to an event breaks the event info formatting. Diagnosis-first.
9. **`2026-06-19-riding-since-staleness.md`** (BUG-089). Editing your own "Riding since" year is not reflected in the Riders list.
10. **`2026-06-22-boards-arbor-covers.md`** (BUG-095). Board catalog tiles on a brand drill-down do not show the large cover image.
11. **`2026-06-17-collective-tap-year.md`** (BUG-063). Tapping to select a year on the collective timeline breaks after scrolling.
12. **`2026-06-25-brand-timeline-verified-badge.md`** (BUG-109). A curated or verified brand shows "unverified" on its own timeline entries. Carries a product decision inside the brief.
13. **`2026-06-17-bug-report-widget-buttons.md`** + **`2026-06-22-connections-invite-button.md`** (BUG-071, BUG-096). **These two overlap: both claim BUG-071** (bug-report popup buttons do not register taps on mobile). BUG-047 and BUG-038 in them already shipped. Do not run both. Whoever takes this should merge them into one brief first, or take `connections-invite-button` alone and leave BUG-071 to a fresh diagnosis. BUG-071 is meta-important: it is the feedback channel itself.

---

## NOT ready (needs a Jay decision, do not auto-draft)

- **BUG-053** ("My Timeline" on the community landing). **Premise moved August 19.** The June 16 decision was "remove it from the lens row on the landing context". The PR #199 session found it now lives in the shared PB-011 global lens row (`src/components/ui/nav/lens-row.tsx`), which every community surface renders. Removing it on the landing now means either threading a context prop through the shared chassis or deleting a global nav affordance. **Needs Jay:** keep it globally and accept the landing confusion, hide it only when signed out, or pass a landing-context prop. The old brief `2026-06-16-my-timeline-landing-lens.md` is stale against this and should not be built as written.
- **BUG-169** (the membership page needs repositioning, not a repair). Needs Jay's wording. Note PR #203 just changed the `/membership` sell copy, so re-read the page before deciding.
- **BUG-170** (the riders list should surface riders you are actually connected to). Feature, product decision.
- **BUG-173** (place a podcast mention in time by when the story happened, not when it was told). Feature, needs a schema change; Jay flagged it himself as "That is big feature :)".
- ~~Enable the public Stack by default for every member~~ **RESOLVED August 20**: Jay made the call live and it is now the lead brief above (BUG-174, `bugs/2026-08-20-public-stack-default-on.md`). The rename is ALSO resolved the same day: the member-facing pair is "Mini / Full", folded into the same brief (Decision 4). Nothing parked from this thread remains.
- **BUG-152** (community date-verification mechanic plus admin story-edit gap). Enhancement, needs a decision.
- **BUG-135** (landing copy too wordy, over-uses "stories"). Copy call.
- **BUG-139** (place page repeats country, region and weblink already on the title card). Design decision.
- **BUG-114** (filters are not remembered across navigation). Needs scope.
- **BUG-020 is now CLOSED** and off this list. The PR #199 session verified the stale token copy is already fully scrubbed; only a historical code comment remains. No build needed.
- Longer tail also parked: BUG-025, BUG-057, BUG-058, BUG-074, BUG-075, BUG-076, BUG-085, BUG-093, BUG-121, BUG-127 (decided: brand-first Boards frame is intended, NO BUILD), BUG-130, BUG-131, BUG-133.

---

## Housekeeping flagged this run

**September 4:**

- **The stranded badge diff is now branch-mobile, and that is a new class of risk.** Six days uncommitted, and `HEAD` has moved from `auto/bugfix-20260830-2122` to `claude/snowboard-catalog-reconcile-hltji3` to `claude/snowboard-catalog-v0.3-review`. A working-tree diff that survives three checkouts is one careless `git commit -a` away from landing presentational badge work inside a catalog data commit, where no reconcile would ever find it. Stash-checkout-branch-pop before committing.
- **Five consecutive dead unattended runs**, four of them on this exact diff (Aug 31, Sep 1, Sep 2, Sep 4) and one on `gh not authenticated` (Sep 3). Both failure modes are Jay-side one-liners: commit or stash the tree, and `gh auth login`. Worth doing together, since fixing only one leaves the slot dead.
- **Local `main` is three PRs stale** at `f6ec7f8` while `origin/main` is `91625fe`. Any branch cut from local `main` right now starts behind #212, #213 and #214. `git checkout main && git pull` before branching.
- **Zero intake in both lanes**, one run after the September 3 burst of three. Nothing to read into a single quiet day; the shape worth watching is still the September 3 observation that recent reports are proposals rather than defects.
- **New untracked path:** `data/catalog/existing-export-demo-baseline.csv`, alongside the long-standing `.design-sync/` and `docs/design-system.md`. Classify all three (commit or ignore) before the `git add bugs/ features/` commit, or they get swept in with it.
- **Unchanged:** PR #214's tracker migration is still half done (`git ls-files bugs/` returns one path); the five `bugs/.write*` scratch probes are still there; the `[Linestry Idea]` attachment bridge is still unwired Jay-side (one sibling Gmail filter); six stale local `auto/bugfix-*` branches and four stale remotes are prunable; `claude/snowboard-catalog-reconcile-hltji3` and `claude/snowboard-catalog-v0.3-review` are two unmerged catalog session branches needing a decision.

**September 3:**

- **PR #214 un-ignored `bugs/` and `features/` but committed only the READMEs.** `git ls-files bugs/` returns exactly one path, `bugs/README.md`. Everything else in both folders is untracked-but-not-ignored, which is a worse state than before: the files are now invisible to `main` AND they count as untracked noise against the pipeline's clean-tree check. The fix is `git add bugs/ features/` and a commit. Until then the shared-source-of-truth premise in the repo `CLAUDE.md` (updated by the same PR) describes something that is not true.
- **Five scratch files will get committed with that unless they are deleted first:** `bugs/.write-test`, `bugs/.write_test`, `bugs/.writetest`, `bugs/.wt`, `bugs/.wtest`. They look like leftovers from write-permission probes. Also decide on `bugs/.auto-verdict.json`: it is per-run pipeline state, so it probably belongs in `.gitignore` rather than in git.
- **Four consecutive aborted 05:00 runs on the same stranded badge diff** (Aug 31, Sep 1, Sep 2, and by inference Sep 3). Unchanged for five days. It remains the single blocking item and it cannot clear itself.
- **Intake returned, and its shape is the finding.** Seven silent runs, then three reports in one day, and none of them a defect: two proposals filed in the bug lane and one in the idea lane. Read alongside the Aug 25 session (five reports, three bugs), the pattern is that the people using the product are now mostly telling you what to build rather than what is broken. That is a reasonable signal about product stability, and it also means the bug queue may stay quiet while the feature queue fills.
- **The `[Linestry Idea]` attachment bridge is still unwired** (the Apps Script keys on the `[Linestry Bug]` subject), but it did not cost anything this run: none of the three reports claimed or carried a screenshot. Still worth the one sibling Gmail filter, Jay-side.
- **Unchanged:** `.design-sync/` and `docs/design-system.md` remain untracked and un-gitignored; the stale local `auto/bugfix-*` branches and four stale remote ones are still prunable; `claude/snowboard-catalog-reconcile-hltji3` is a fifth unmerged session branch, four commits above main, carrying catalog reconciliation work that needs a decision.

**September 2:**

- **Three consecutive aborted 05:00 runs on the same dirty tree** (Aug 31 05:03, Sep 1 05:44, Sep 2 05:02). Verified from the refs this run: `HEAD` is still `auto/bugfix-20260830-2122`, that branch still equals `main` which still equals `origin/main` at `f6ec7f8`, and no `auto/bugfix-2026090*` branch was ever created. The pipeline is behaving correctly and cannot recover on its own. A human or an attended session has to commit or discard that diff. It is the single blocking item.
- **The empty-slot problem is now fixed on the brief side.** `bugs/2026-09-02-compare-deep-link-prepopulate.md` (BUG-120) is drafted, pipeline-safe and verified against the current tree, closing an action item that had been carried unactioned since August 24. That means the pipeline is blocked by exactly one thing now (the dirty tree) rather than two (dirty tree plus nothing legal to build).
- **The July 3 compare brief carried a wrong root cause for nine weeks.** It blamed `catalog.people` and `catalogLoaded` for the failed `?b=` resolution; `catalogLoaded` does not even appear in `src/app/compare/page.tsx`. The real cause is the async `realProfiles` Supabase fetch that feeds `allPeople`. Worth noting as a pattern: briefs drafted from the codebase `CLAUDE.md` gotcha list can inherit a plausible-sounding mechanism that the file does not actually use. The fix is the standing re-grep rule, applied this run.
- **BUG-174 crossed two weeks built and unmerged.** `origin/claude/public-stack-default-gating-6tzvvg` (`b75c000`, Aug 20). Unchanged since it was first flagged on Aug 24. Nobody has picked it up in ten days of it being the top attended ask.
- **Seven consecutive runs with zero intake in both lanes.** The last reports were the Aug 25 member session, logged Aug 27. Zero open P0. One open P1 (BUG-179). The deliberate prompt to a handful of members, standing since Aug 22, is still unsent and is now the cheapest available signal about whether this is quiet reporting or a quiet product.
- **Unchanged from previous runs:** the `[Linestry Idea]` attachment bridge is still unwired (the Apps Script keys on the `[Linestry Bug]` subject, so idea screenshots never reach the Drive folder, one sibling Gmail filter Jay-side); `.design-sync/` and `docs/design-system.md` remain untracked and un-gitignored; six stale local `auto/bugfix-*` branches and four stale remote ones are prunable.

**August 31:**

- **The autonomous pipeline lost a completed build to its own commit filter.** The Aug 30 21:22 run finished BUG-177 + BUG-178, wrote the verdict file, then recorded `empty` because nothing staged "after excluding pre-existing untracked paths". The narrow-commit change in `64609b5` was meant to tolerate `.design-sync/` and `docs/design-system.md`; on this run it excluded the real source edits too. Worth a look at that staging logic before the next fire, because the failure is silent: the RUN-LOG says `empty`, the work says otherwise.
- **The 05:00 slot is now self-blocked.** Today's run aborted at 05:03 on the dirty tree left by last night's run. Correct behaviour, but it means the pipeline cannot recover on its own: a human or an attended session has to commit or discard that diff.
- **The slot has drifted off 05:00 entirely.** Aug 24 to 29 fired at 08:0x EDT, Aug 30 fired at 21:22 PDT, Aug 31 at 05:03 PDT. Nine of the last twelve fires produced nothing (five headless errors, one gh-auth failure, one empty, one aborted, one stranded). Two ships in twelve days, both on days the slot happened to fire cleanly with a pipeline-safe brief waiting.
- **Five consecutive runs with zero intake in both lanes** (Aug 27 logged the last reports, all from one member session on Aug 25). Zero open P0, zero open P1. Read that as quiet reporting rather than a quiet product, and note the ask standing since Aug 22: a deliberate prompt to a handful of members would tell you which it is.
- **Still open from previous runs:** the `[Linestry Idea]` attachment bridge is unwired (the Apps Script keys on the `[Linestry Bug]` subject, so an idea's screenshot never reaches the Drive folder); `.design-sync/` and `docs/design-system.md` remain untracked and un-gitignored; the stale local `auto/bugfix-*` branch list keeps growing and four stale remote auto branches are prunable.

**August 27:**

- **BUG-174 is now seven days built and unmerged.** `origin/claude/public-stack-default-gating-6tzvvg` (`b75c000`, Aug 20 19:38 UTC), no SHIP-LOG entry, not on `main`, migration `20260820000001` unapplied. Unchanged since the Aug 24 flag, which means nobody has picked it up. It is a rebase, a tsc run, a gated migration and a merge, not a build.
- **The 05:00 slot idled again on Aug 25 and Aug 26.** Both branches exist with zero commits above `main`, same as Aug 23. Four idle runs out of the last five, and the single productive run (Aug 24, PR #210) was the one with a loaded pipeline-safe slot. Refilled this run. Separately, both new branches are timestamped `0812` and `0819`, not `05xx`, so the job is now firing around 08:1x local. Worth a look at the launchd schedule alongside the clock change noted on Aug 24.
- **Intake resumed after five silent days**, and it arrived as one member working through the product on an iPhone for half an hour and filing five reports in one session. That is the shape of feedback worth optimising for. The Aug 22 suggestion of a deliberate prompt to the first-wave cohort now has evidence behind it: when someone is asked to look, they find things.
- **The `[Linestry Idea]` attachment bridge is still unwired.** One of the two ideas this run had a screenshot that never reached the Drive folder, because the Apps Script bridge keys on the `[Linestry Bug]` subject. Jay-side, one sibling Gmail filter. Until it exists, idea screenshots are lost.
- **Untracked paths and stale branches persist**, now longer: `.design-sync/` and `docs/design-system.md` remain uncommitted and un-gitignored (the pipeline wants a clean tree), and the prunable local branch list has grown to `auto/bugfix-20260821-0500`, `-20260823-0502`, `-20260825-0812` and `-20260826-0819`, alongside the four stale `origin/auto/bugfix-*` remotes.

**Carried from August 24:**

- **BUG-174 has been built and unmerged for four days** (`origin/claude/public-stack-default-gating-6tzvvg`, `b75c000`). No SHIP-LOG entry, not on `main`, migration `20260820000001` not applied. This is the single highest-value item in the repo right now and it is finished code waiting on a merge. See the lead section above.
- **The 05:00 slot ran clean on Aug 23 and built nothing** because every available brief was gated against unattended runs. Structural, not a pipeline bug. Addressed by the new pipeline-safe slot above; keep at least one pipeline-safe brief promoted at all times or the slot idles.
- **Zero intake in both lanes for four consecutive runs**, spanning and now outlasting the FNRad traffic week. Four straight days of silence with zero open P0 and zero open P1 reads as no one reporting rather than nothing to report. The deliberate prompt to the first-wave cohort suggested on Aug 22 is still unsent and is worth doing.
- **Untracked paths and stale branches persist** from the Aug 22 list: `.design-sync/` and `docs/design-system.md` still uncommitted and un-gitignored (the 05:00 pipeline wants a clean tree), and `auto/bugfix-20260821-0500` plus the now-empty `auto/bugfix-20260823-0502` are prunable locally alongside the four stale `origin/auto/bugfix-*` remotes.

**Carried from August 22:**

- **Zero open P0. Zero open P1**, now for the third consecutive day and across the whole FNRad traffic week. Two straight days of zero intake in both lanes points at silence rather than health. Consider a deliberate prompt to the first-wave cohort asking what broke or annoyed them.
- **CORRECTED at 07:15: the 05:00 pipeline is working.** It fired today at 05:00 and merged PR #209 (BUG-175) at 05:03. The triage bullet below was written before the run. Only Aug 21 was a real failure (headless-run error, log `~/Library/Logs/linestry-autobugfix/20260821-050035.log`); the stale local branch `auto/bugfix-20260821-0500` is prunable.
- _Superseded (04:08 triage): the 05:00 auto bug-fix pipeline has produced nothing for two runs._ Aug 21 created a branch and aborted with a headless-run error (log: `~/Library/Logs/linestry-autobugfix/20260821-050035.log`); Aug 22 created no branch at all. Worth checking the launchd job and the log before assuming the brief-selection gap is the only issue. The stale local branch `auto/bugfix-20260821-0500` is also prunable.
- **The working tree carries two untracked paths**, `.design-sync/` and `docs/design-system.md`. The 05:00 auto bug-fix pipeline wants a clean tree. Either commit `docs/design-system.md` (it is the living design-system doc) or add both to `.gitignore`.
- **Four stale remote auto branches** persist and are prunable: `origin/auto/bugfix-20260614-1142`, `-20260617-0500`, `-20260618-0713`, `-20260706-0500`. None are unique. `git push origin --delete <branch>`.
