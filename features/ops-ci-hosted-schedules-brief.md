# CI, Hosted Schedules, and (last) the Cloud Loop

> Cowork-authored ops brief, September 9 2026. Three phases, ship in order, each
> is its own PR. Depends on `linestry-ops-repo-brief.md` being done (the queues
> must be readable by a hosted runner first). Source: scoping doc Layer 2.
>
> Phases 4A and 4B are low-risk and worth doing now. Phase 4C (hosting the
> auto-fix loop) is deliberately last and deliberately skeptical: host it only
> after it has run reliably locally for a week with brief 2's worktree isolation.

---

## Why, and the correction to the intent brief

The intent brief hypothesizes the earlier cloud attempt failed because the default
"Trusted" network access blocked domains the work needed, and proposes setting
network to Custom and adding domains. That is one real factor and this brief does
it, but it was almost certainly not the whole cause. The documented blockers are:
the queues were gitignored so a cloud clone could not read them (fixed by brief 3),
the Supabase service-role key is gitignored and must not leave the server, and the
cloud proxy refuses pushes to `jaybalmer/lineage`. **Setting network to Custom
alone would not have worked.** That is why this brief runs after brief 3 and
handles secrets explicitly.

There is no CI at all today (`.github/workflows` does not exist), so the quality
gate is `tsc --noEmit` by convention only. CI first converts that convention into
enforcement and proves the hosted-runner path at zero risk.

---

## Phase 4A: CI on every PR (do first)

**Scope.** Add `.github/workflows/ci.yml` in `lineage`: on pull_request, run
`npm ci`, `npx tsc --noEmit`, and `npx eslint`. No secrets needed (type + lint
only, no DB). Required check on `main`.

**Why first.** Small, obviously correct, and it is the hosted-runner smoke test.
It also means the auto-fix loop's PRs get a real CI gate instead of only the
wrapper's local `tsc`.

**Acceptance.** A PR with a type error goes red and cannot merge; a clean PR goes
green. The auto-fix loop's `gh pr checks --watch` (already in `auto-bugfix.sh:328`)
now waits on this real check.

**Jay does:** confirm branch protection on `main` requires the new check.

---

## Phase 4B: hosted schedules for triage and digest

**Scope.** Move the daily triage (~04:06) and the morning digest (~07:15) off the
Cowork desktop app onto scheduled GitHub Actions (or an equivalent hosted
scheduler), reading and writing the `linestry-ops` queues.

**Secrets.** Gmail, PostHog, Supabase, Drive access move into GitHub Actions
secrets or a proper manager, never baked into an image and never a service-role
key exported by hand. Where a job needs the service-role key (the PII scrub
mapping), scope it: a dedicated key with only the `ops_pii_map` and `bug_reports`
grants, or run only the scrub step on a trusted runner. Confirm the secrets model
with Dogu (scoping doc open question 3) before wiring the credentialed jobs.

**Order within 4B.** Do the digest first: it is a reconcile/reporting job with no
outbound member effect, so a bad run is low-cost. Then triage, which sends nothing
outbound either but does write briefs the loop will build.

**Acceptance.** The digest runs hosted on schedule, updates the ops queues, and
posts its status; the Cowork desktop copy of that task is disabled so there is one
scheduler, not two (this is the no-duplicate-reporting guarantee from the
inventory). Triage runs hosted, produces build-ready briefs in the ops repo, and
the local `auto-bugfix.sh` still finds its lead.

**Jay does:** put the secrets in the Actions secrets store; disable the old Cowork
desktop triage + digest tasks once the hosted versions are verified, so they do
not double-run.

---

## Phase 4C: host the auto-fix loop (last, and only when it is reliable)

**Scope.** Move `auto-bugfix.sh` off launchd onto a hosted scheduled runner.

**Preconditions, all required:**
1. Brief 2 (worktree isolation) shipped and the loop has run clean locally for at
   least a week (a hosted unreliable thing is a reliable failure).
2. Brief 3 done: the loop reads its lead from `linestry-ops`, which a hosted clone
   can read.
3. A push path that works from the runner. The current cloud proxy refuses pushes
   to `jaybalmer/lineage`; the hosted runner needs a scoped deploy key or app token
   with push rights to the fix branch only, plus permission to open a PR. This is
   the real gate and it is a credentials/trust decision, not a script change.
4. **Network access set to Custom with the domains the run actually needs added.**
   Enumerate them from a local run's traffic: `api.anthropic.com` (Claude Code),
   `api.github.com` + `github.com` (gh + push), `api.resend.com` (notify),
   `*.supabase.co` (if any step reads the DB), the npm registry (`registry.npmjs.org`)
   for `npx tsc`, and Vercel if the run polls deploy status. Add them explicitly;
   do not leave it on the default that blocked the earlier attempt.

**Acceptance.** A hosted run reads the lead from the ops repo, runs Claude Code
headless with Custom network reaching all required domains, passes the CI check
from 4A, and either auto-merges a safe fix or opens a needs-review draft and emails
Jay, exactly as the local loop does. RUN-LOG (in the ops repo) records it.

**Jay does:** provision the scoped push credential; set network to Custom and
confirm the domain list; keep the local launchd job as a fallback for one cycle
before disabling it.

---

## Risks and gotchas

- **R1. Do not run two schedulers at once.** Every hosted job that goes live must
  have its Cowork desktop twin disabled the same day, or the queues get written
  twice and the "no duplicate reporting" goal is violated at the source.
- **R2. Secrets scope is the whole game in 4C.** The service-role key must not
  land on a shared runner. If a scoped credential is not achievable, keep the
  loop local (launchd) and host only triage + digest. Hosting the loop is a
  nice-to-have; the availability win is mostly from 4B plus a laptop that the loop
  can run on when awake.
- **R3. 4C is optional.** If steps 1 to 4 are not all cleanly met, stop after 4B.
  The brief's success criteria ("runs complete without the laptop open") are met
  for triage and digest by 4B; the loop can stay local until its credential story
  is solid.

## What Jay does (gated, human-only), in order

1. 4A: add branch protection requiring the CI check.
2. 4B: load secrets into the Actions store; after verifying, disable the two
   Cowork desktop tasks so nothing double-runs.
3. 4C, only when its four preconditions hold: provision a scoped push credential,
   set network to Custom with the enumerated domains, and keep launchd as a
   one-cycle fallback.
