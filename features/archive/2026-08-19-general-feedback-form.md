# Feature brief: General Feedback Form (generalize the bug widget)

> Build-ready Claude Code handoff. Single PR. Drafted August 19, 2026 (Cowork, Jay live).
> Authoring copy: Drive `Operations/general-feedback-form-brief-v1.md`.
> Queue position: **second**, behind the Claim-First Invite Flow lead.
> Size: **~1.5 to 2 hr**. One additive migration (see the gate in §7).

---

## 0. What this is, in one paragraph

The in-app "Report a bug" widget already captures everything a good feedback channel needs: the page URL, viewport, browser, a PostHog session replay link anchored to just before the widget opened, an optional screenshot, and the reporter's identity when signed in. It just refuses to accept anything that is not a bug. Jay wants one form that takes a bug report OR a feature suggestion OR any other message, keeps the same page context (so an idea that references a current page or feature arrives with that page attached), and is sorted at the email level rather than by branching the product. This is a rename, a copy pass, a two-chip type toggle that sets the email subject prefix, and one additive column. **No new route, no new modal, no new mount points.**

---

## 1. DECISIONS (review before building)

All four were decided with Jay on August 19. Build them as written unless he says otherwise.

**D1. Type toggle sets the email subject prefix. DECIDED.**
Two chips at the top of the form: **"Something's broken"** (default, preselected) and **"An idea"**. Broken sends the subject prefix `[Linestry Bug]` exactly as today. Idea sends `[Linestry Idea]`. One form, one endpoint, one submit button. The prefix is the only routing key; do not add a second endpoint and do not branch the modal into two components.
*Why the toggle exists at all:* the entire downstream pipeline keys on the literal string `[Linestry Bug]` (the daily Gmail triage sweep, the Gmail-to-Drive attachment bridge, the 05:00 auto-bugfix pipeline that reads the triage output). A single merged prefix would put every idea into the bug queue and would require rewiring three things that currently work. Auto-classifying from the text was rejected: a wrong guess silently drops a real bug out of the triage sweep.

**D2. Rename in place, no new chrome. DECIDED.**
The entry point stays in the two places it already lives (the avatar dropdown for members, the guest menu for logged-out visitors) and is relabelled **"Send feedback"**. No floating button, no footer link. Rationale: it inherits the existing mounts, adds no global chrome, and cannot collide with the FAB action sheet.

**D3. The second field re-labels with the type. DECIDED.**
- Broken: `What did you expect?` (unchanged from today)
- Idea: `What would this make possible?`
Both optional, both stored in the same `expected` column. Do not add a third field.

**D4. Queue position: second, behind Claim-First Invite Flow. DECIDED.**
Do not treat this as the lead. If a session starts and the invite flow has not shipped, build that first.

**D5. Copy (defaults, ship as written unless Jay overrides at build time).**
- Modal heading: **Send feedback**
- Helper line, signed in: *"Your current page, browser, and account come along automatically, so you can just describe what you mean."*
- Helper line, logged out: *"Your current page and browser come along automatically, so you can just describe what you mean."*
- First field label, both types: **What's on your mind?**
- First field placeholder, broken: *"Describe what went wrong"*
- First field placeholder, idea: *"Describe what you'd like to see"*
- Attachment label: **Attach a screenshot (optional)** (unchanged)
- Success toast, broken: *"Thanks. Bug report sent."* (unchanged)
- Success toast, idea: *"Thanks. Idea sent."*
- Email H1, broken: *New bug report* (unchanged). Idea: *New idea*
- Email subtitle, both: *"Submitted from inside Linestry."* (unchanged)
**No em dashes in any of this copy.** Use periods, commas, parentheses, colons or semicolons.

---

## 2. Verified facts (checked against `main` on August 19, 2026)

Every line below was read out of the current tree, not assumed.

1. **The modal is one file, 263 lines:** `src/components/ui/report-bug-modal.tsx`, exporting `ReportBugModal({ open, onClose, includeAccount })`.
2. **It is mounted in exactly two places**, both already correct for this feature:
   - `src/components/ui/nav/guest-menu.tsx:121` (logged out, no `includeAccount`)
   - `src/components/ui/nav/avatar-dropdown.tsx:224` (signed in, `includeAccount`)
   The trigger button labels are `guest-menu.tsx:95` and `avatar-dropdown.tsx:209`, both the literal string `Report a bug`, both with a `{/* Report a bug */}` comment two lines above.
3. **The route is `src/app/api/bug-report/route.ts`, 269 lines,** `POST` only, `multipart/form-data`. Auth is deliberately OPTIONAL: it calls `supabase.auth.getUser()` and never 401s, so logged-out visitors can send. Reporter identity is taken from the session, never from the payload.
4. **The subject is built at line 243:** `` subject: `[Linestry Bug] ${firstLine}` `` where `firstLine` is the first line of the note capped at 60 chars. **This one line is the routing key for the whole downstream pipeline.**
5. **Every text field is already length-capped** server-side (`note` 10000, `expected` 5000, `url` 2000, `viewport` 32, `userAgent` 1024, `posthogSessionUrl` 2000, `reportStartedAt` 64) because the endpoint is publicly reachable. Keep that discipline for any new field.
6. **The durable row goes to `bug_reports`** via `getServiceClient()` (service role, bypasses RLS). The TS interface is `BugReport` at `src/types/index.ts:842`, with `BugReportStatus = "new" | "triaged" | "resolved" | "wontfix"` at line 840.
7. **The route already carries a missing-column fallback pattern.** Lines 212 to 220: the insert is retried without `report_started_at` when PostgREST returns `PGRST204` or Postgres returns `42703`, with the comment "The bug intake must never break over a telemetry field". **This is the pattern to copy for the new `kind` column, and it is what softens the migration gate in §7.**
8. **The screenshot rides as an email attachment**, not to storage: `attachments: attachment ? [attachment] : undefined` at line 259. The comment at lines 10 to 13 explains why: the existing Gmail-to-Drive bridge files it into the "Linestry Bug Attachments" Drive folder that daily triage already reviews. Accepted MIME types are png/jpeg/webp/gif, ceiling 8 MB, and the client compresses to JPEG at max 1920px first (`compressImage`, modal lines 24 to 54).
9. **The replay link is captured on OPEN, not on send** (modal lines 79 to 88, 10 second lookback) because the bug predates the typing. There is a send-time fallback at lines 136 to 143. Do not move this.
10. **`parseReplayAnchor` (route lines 64 to 69) exists to survive email encoding damage.** Its comment records a live failure where `t=1607s` arrived as `t\x1607s` through quoted-printable, so the replay values must also appear OUTSIDE any href and must contain no `=` character. Leave that function and its plain-text twin rows alone.
11. **Toast API:** `addToast(message: string, type?: "error" | "info" | "reward")` from the Zustand store (`src/store/lineage-store.ts:194`). No action-button support; do not promise one.
12. **`useBodyScrollLock(open)`** is already wired (modal line 91, closed BUG-048). Keep it.
13. **Migration convention has moved.** `bug_reports` was created by root-level `migration-010-bug-reports.sql` and extended by `migration-011-bug-report-started-at.sql`, but current practice is timestamped files in `supabase/migrations/`, most recently `20260817000001_public_slug_aliases.sql`. **Use the timestamped convention** for the new file.
14. **`bug_reports` has no `_public` view** and is not publicly read, so the PB-009 view-freeze rule (Group F) does not apply here. No view rebuild needed.

---

## 3. Scope

**3.1 Migration (additive, SAFE).** New file `supabase/migrations/20260819000001_feedback_kind.sql`:

```sql
alter table public.bug_reports
  add column if not exists kind text not null default 'bug';

alter table public.bug_reports
  add constraint bug_reports_kind_check
  check (kind in ('bug', 'idea'));
```

Table name stays `bug_reports`. Renaming it would be a GATED change against a table the intake path writes on every submit, for zero user-visible benefit. Note the mismatch in a comment and move on.

**3.2 Types.** Add to `src/types/index.ts`:
```ts
export type FeedbackKind = "bug" | "idea"
```
and add `kind: FeedbackKind` to the `BugReport` interface (line 842).

**3.3 Modal (`report-bug-modal.tsx`).**
- Rename the exported component to `FeedbackModal` and the file to `src/components/ui/feedback-modal.tsx`. Update both import sites. Keep the props signature identical (`open`, `onClose`, `includeAccount`) so the mount points change by name only.
- Add `const [kind, setKind] = useState<FeedbackKind>("bug")`.
- Render the two chips above the first field. Use the existing pill styling already in the tree (the filter chips in `feed-view.tsx` are the closest precedent); do not invent a new control. Selected chip reads as active, unselected as muted. Both must be reachable by keyboard and must be real `<button type="button">` elements.
- Drive the first-field placeholder and the second-field label off `kind` per D3 and D5.
- `form.append("kind", kind)` in `handleSend`.
- Reset `kind` to `"bug"` alongside the existing `setNote("")` / `setExpected("")` / `clearImage()` reset on successful send.
- Success toast text branches on `kind` per D5.

**3.4 Route (`api/bug-report/route.ts`).** Keep the path. It is referenced only from the modal, and renaming the route is churn that buys nothing.
- Read and validate: `const kind = asString(form.get("kind")).trim() === "idea" ? "idea" : "bug"`. **Whitelist, never pass the raw string through**, since this endpoint is public and the value reaches a CHECK constraint and an email subject.
- Include `kind` in `baseRow`.
- **Extend the existing PGRST204 / 42703 retry (lines 212 to 220) to also strip `kind`.** Restructure it so the retry drops the optional columns rather than only `report_started_at`. This is what keeps intake alive if the code lands before the migration.
- Subject: `` `${kind === "idea" ? "[Linestry Idea]" : "[Linestry Bug]"} ${firstLine}` ``. The bug string must remain byte-identical.
- Email H1 and the "What they expected" heading branch on `kind` per D3 and D5. Add a `metaRow("Type", ...)` row to the meta table reading `Bug report` or `Idea` so it is legible even if the subject gets mangled in transit.
- Mirror the same branching in the plaintext `text:` part.

**3.5 Grep sweep.** After the rename, `grep -rn "ReportBugModal\|report-bug-modal\|Report a bug" src/` must return zero hits.

---

## 4. Out of scope (do not build these)

- No new entry point (no floating button, no footer link, no `/feedback` page). D2.
- No third form field, no category picker beyond the two chips, no email-address field (identity comes from the session; anonymous stays anonymous).
- No admin surface for ideas. `/admin` gets nothing this session.
- No rate limiting. It is absent today and adding it is its own task (the route's own comment at line 19 says "Add real rate limiting before launch scale"). Do not quietly bundle it.
- No table rename, no `bug_reports` RLS change.
- No change to `parseReplayAnchor`, the open-time replay capture, or the image compression path.

---

## 5. Acceptance criteria

1. `npx tsc --noEmit` clean. `npm run lint` clean.
2. The avatar dropdown and the guest menu both read **Send feedback** and both open the same modal.
3. Submitting with **Something's broken** selected produces an email whose subject begins with the exact string `[Linestry Bug] ` and a `bug_reports` row with `kind = 'bug'`. Verified against a real send.
4. Submitting with **An idea** selected produces `[Linestry Idea] ` and `kind = 'idea'`.
5. The second field reads "What did you expect?" on broken and "What would this make possible?" on idea, and the value lands in `expected` either way.
6. Page URL, viewport, browser, timestamp, report-started, replay link and replay anchor rows are present on BOTH types. An idea sent from `/snowboarding/boards` arrives carrying that URL.
7. A screenshot attaches on both types.
8. Logged out: the modal opens from the guest menu, sends successfully, and the row has `reporter_id = null`.
9. Closing and reopening the modal resets the type to **Something's broken**.
10. Sending a POST with `kind=wat` (curl, bypassing the UI) stores `kind = 'bug'` and does not 500 or violate the CHECK constraint.
11. `grep -rn "ReportBugModal\|report-bug-modal\|Report a bug" src/` returns nothing.
12. Modal is usable at 375px wide: chips do not wrap awkwardly, nothing overlaps.

---

## 6. Suggested order

1. Migration first (see §7).
2. Types (`FeedbackKind`, `BugReport.kind`).
3. Route: whitelist parse, `baseRow`, the widened retry, subject, email branching. Test with curl before touching the UI.
4. Modal: rename file and component, update the two imports, add the chips and the branching copy.
5. Menu labels in `guest-menu.tsx` and `avatar-dropdown.tsx` (including the two code comments).
6. Grep sweep, `tsc`, lint.
7. Full Ship sequence per the repo `CLAUDE.md`, then the SHIP-LOG entry (`type: feature`, `ids: none`, `scope: general-feedback-form`).

---

## 7. Migration gate (read this before merging)

The migration is **additive and SAFE** by the risk gate, so apply it yourself via the Supabase MCP and print the SQL for the record.

**Ordering: migrate first, then merge.** The write path sends `kind` unconditionally, which is the Group F hard-gate shape: the boards redesign (PR #58, June 11) merged ahead of its migration and every claim insert failed with PGRST204 for the whole window. **However**, this build copies the existing `report_started_at` retry (verified fact 7), so a code-before-migration window degrades to "reports still arrive, `kind` is silently dropped" instead of a hard failure. That is a safety net, not a licence to merge first. Apply the migration, verify with a select, then merge.

Verify after applying:
```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'bug_reports' and column_name = 'kind';

select kind, count(*) from public.bug_reports group by kind;
```
The second query should return one row, `bug` with the full existing count, since every pre-existing row backfills to the default.

**Rollback:** `alter table public.bug_reports drop constraint bug_reports_kind_check; alter table public.bug_reports drop column kind;` and revert the PR. No data loss beyond the type flag itself.

---

## 8. Companion tasks (NOT code, Jay-side, flag these at wrap)

These three keep the email-level triage promise true. None of them belongs in this PR, but the feature is only half-useful without them.

1. **Gmail filter for `[Linestry Idea]`.** The Gmail-to-Drive attachment bridge currently keys on `[Linestry Bug]`, so a screenshot attached to an idea will not be filed into the Drive folder until a sibling filter exists. Ten minutes in Gmail settings.
2. **Daily triage sweep: DONE, already wired August 19, 2026.** The `linestry-bug-triage` scheduled task now runs both sweeps and files `[Linestry Idea]` mail into the "Needs a Jay decision or a drafting pass" section of `features/feature-queue.md`, with no BUG id, no auto-drafted brief, and repeat asks clustered as "+1" rather than duplicated. It also corrects lanes: an idea that is really a defect gets a BUG id instead. **The triage is therefore already listening for a prefix this PR has not shipped yet**, which is harmless (the sweep returns zero and says so) and means nothing else has to change on the day this merges.
3. **Confirm the auto-bugfix pipeline is unaffected.** It reads `bugs/NEXT-SESSION.md`, which is downstream of the bug sweep only, so it should be untouched. Worth one look after the first idea lands.
