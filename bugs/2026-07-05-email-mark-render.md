# Bug-fix session brief: transactional-email logo does not render in email clients (BUG-149)

> Drafted by the July 5, 2026 daily triage. Self-contained.
> **P2.** Touches the shared transactional-email header, so it changes the branding
> of EVERY outgoing email (magic-link, reset-password, claim, comment, tag). No DB,
> no migration. Carries a hosting decision. HUMAN-REVIEWED (email is a trust surface).
> Name the BUG id (BUG-149) in the PR title or commit message.
> Append a `status: pending` SHIP-LOG entry before wrapping.

## Scope

- **BUG-149: The sign-in (magic-link) email shows the Linestry wordmark in a fallback font and the logo is missing.** [P2] [reproducible]

One-line goal: the v2 monogram renders as a real image in Apple Mail / Gmail on every transactional email, so the header reads as branded rather than a broken image.

## Root cause (checked against the live repo July 5)

The shared email header `src/lib/emails/shared-header.ts` (`emailHeaderHtml()`) embeds the v2 monogram as an **inline `<svg>`** and sets the wordmark to `font-family:'Geologica',Arial,sans-serif`. This header is used by the magic-link email (`src/app/api/auth/magic-link/route.ts`, `magicLinkEmailHtml()` calls `emailHeaderHtml()`), reset-password, and the `src/lib/emails/*` templates (claim, comment, tag).

Two well-known email-client limitations produce exactly the reported symptom:
1. **Apple Mail and most email clients do not render inline SVG.** The monogram is therefore invisible = "missing new logo."
2. **Email clients cannot load web fonts (Geologica).** The wordmark falls back to Arial, which the reporter reads as "old font." (The brand wordmark font is Calendula per the codebase `CLAUDE.md`, which also cannot be embedded in email.)

This is not specific to the sign-in email; it affects all transactional emails via the shared header.

## DECISIONS (review before building)

1. **How to render the mark.** Recommended: replace the inline SVG in `emailHeaderHtml()` with an `<img>` pointing at a **hosted PNG raster** of the v2 monogram (e.g. `https://linestry.com/email/mark.png` or a `public/` asset served by Vercel), sized ~34px, with `alt="Linestry"`. This renders reliably across clients. Alternative: keep the SVG as a data-URI PNG inline (larger payload, still works). Recommended is the hosted PNG.
2. **Wordmark font.** Recommended: accept the Arial fallback for the wordmark text (email cannot load Geologica/Calendula), OR raster the full "Linestry" wordmark into the same hosted PNG (logo + wordmark as one image) so both read on-brand. Recommended: one hosted PNG containing the monogram + wordmark, with an `alt` fallback. This settles both halves of the report.

## Report (July 5, screenshot in Linestry Bug Attachments)

- BUG-149: 04:25 UTC, cy_3 (`R3`), iPad Safari 820x1048, requested from `https://linestry.com/people/cy_3`. "Signing in with email and request an email link. The email image has the Linestry work mark using old font and missing new logo." Screenshot `19f308660eb64af7__0__bug-screenshot.jpg`. Replay `S-33`, offset 225s.

## Suggested order

1. Produce a hosted PNG of the v2 monogram (and optionally the wordmark) from the master in `Brand/logo-v2-monogram/`; place it under `public/` (or wherever Vercel serves static assets) at a stable URL.
2. Update `emailHeaderHtml()` in `src/lib/emails/shared-header.ts` to use `<img src=... alt="Linestry" width=... height=...>` instead of the inline SVG. Keep the dark header bar background.
3. Send a test magic-link and reset-password email to a real Apple Mail and Gmail inbox; confirm the mark renders.

## Acceptance

- The sign-in email (and, by shared header, all transactional emails) renders the v2 monogram as a real image in Apple Mail and Gmail; the header reads branded, no broken-image icon.
- `alt` text is present so text-only clients still show "Linestry".
- `npx tsc --noEmit` clean. No migration. No change to email send logic, only the header markup + a static asset.

## Standing rules

One PR, BUG-149 in the title. No em dashes anywhere. HUMAN-REVIEWED (email trust surface). Run the full Ship sequence before wrapping ("No migration this session" applies; note the new static asset). Append the SHIP-LOG entry. The `bugs/` folder is gitignored; do not commit it.
