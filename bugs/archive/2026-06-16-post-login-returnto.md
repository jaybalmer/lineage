# Bug-fix brief: post-login returnTo redirect (BUG-054)

> Drafted from the June 16 Cowork decision session. Build-ready on the decision below.
> One PR. Name BUG-054 in the PR title.
> AUTH-SENSITIVE: HUMAN-REVIEWED session only. The autonomous auto-bugfix pipeline must NOT auto-merge this (it touches the auth redirect path).

## Goal
After signing in from a deep link (for example a comment-notification email's "View the conversation" link), the user returns to the page they came from instead of always landing on My Timeline.

## Scope
- **BUG-054**: a comment-email link opens the story while logged out; tapping Sign in completes login and drops the user on My Timeline, so they have to navigate back manually.

## DECISION (made by Jay, June 16)
Build the returnTo redirect. Capture the originating path (a `returnTo` / `redirect` query param on the sign-in entry, and stamp it on the comment-email deep link) and send the user there after login. Default fallback stays My Timeline when no returnTo is present. Validate the returnTo target is an internal path (no open-redirect to external URLs).

## Verified suspected files (from CLAUDE.md + session log)
- Post-login redirect: `/auth/callback` -> `/auth/complete` (session establish; profile upsert for new users). The redirect target after login is currently hardcoded to the member timeline.
- The sign-in entry from the nav (guest "Sign in") and `/auth/signin` (Google + magic-link + password, per PR #38) need to carry and forward the `returnTo` param.
- The comment-email deep link is built in `src/lib/emails/comment-emails.ts` (links to `/[community]/stories?focus=<storyId>`); add the returnTo so the post-login bounce lands back on that conversation.
- Magic-link / OAuth both round-trip through `/auth/callback`; the returnTo must survive that hop (query param or PKCE state). Confirm the param is preserved across the provider redirect.

## Acceptance
- Signing in from a deep link (e.g. a comment-email conversation link) returns the user to that page after login, not My Timeline.
- With no returnTo present, login still defaults to My Timeline.
- returnTo only accepts internal paths (no open redirect).
- Works for Google OAuth and magic-link sign-in (the param survives the callback hop).

## Suggested order
1. Add returnTo capture/forwarding on the sign-in entries and `/auth/signin`.
2. Preserve it through `/auth/callback` -> `/auth/complete` and honor it on completion (with internal-path validation and the My-Timeline fallback).
3. Stamp returnTo on the comment-email deep link.
4. Verify both auth methods and the no-param fallback.

## Notes
No migration expected. `npx tsc --noEmit` clean. One PR, BUG-054 in the title. HUMAN-REVIEWED, do not auto-merge. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere.
