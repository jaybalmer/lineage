# Build Brief: Email Deliverability Hardening

**Type:** Feature session (small, single PR)
**Date drafted:** July 5, 2026
**Estimated:** 1 to 2 hours
**Context:** Companion to `Operations/email-deliverability-brief.md`. Auth (SPF/DKIM/DMARC) is already correct and aligned. This brief covers only the three code-side changes that reduce junk-foldering: a plaintext part on every email, a `Reply-To`, and a `List-Unsubscribe` header on the list-like emails.

---

## Scope

Three additive changes across the Resend send sites. No schema, no migration, no new tables. One PR.

1. Add a `text:` plaintext alternative to every `resend.emails.send(...)` call that lacks one.
2. Add a `reply_to` to every send.
3. Add `List-Unsubscribe` + `List-Unsubscribe-Post` headers to the notification and invite emails only (not the security emails).

## Out of scope

- A hosted one-click unsubscribe URL endpoint with a preferences page. Deferred (see Decision 2). The mailto form of List-Unsubscribe satisfies the intent at Linestry's current volume.
- Any DNS change (root SPF, DMARC tightening) is handled separately in the strategy brief, not in code.
- Reworking email HTML or copy.

---

## Verified facts (checked against the live repo July 5, 2026)

Eight send sites exist:

| File / line | Email | Category |
|---|---|---|
| `app/api/auth/magic-link/route.ts:161` | Magic-link sign-in | Security |
| `app/api/auth/reset-password/route.ts:109` | Password reset | Security |
| `app/api/invite/route.ts:119` | Invite ("added you to their snowboard linestry") | Notification |
| `lib/invite-tracking-server.ts:112` | Invite (tracking-server path) | Notification |
| `lib/emails/claim-emails.ts:165` | Claim your profile | Notification |
| `lib/emails/comment-emails.ts:154` | Comment notification | Notification. **Already has `text:`** |
| `lib/emails/tag-decision-emails.ts:80` | Tag approved / declined | Notification |
| `app/api/bug-report/route.ts:239` | Internal bug report (to Jay) | Internal |

- Every site sends `from: "Linestry <noreply@linestry.com>"`.
- Only `comment-emails.ts` passes a `text:` part. It documents a real gotcha: the SDK auto-text mangles URLs containing `=` via quoted-printable, so its text builder uses only param-free URLs. Mirror that pattern (keep raw URLs in the text part simple, no query strings where avoidable).
- The Resend field name for reply address in this SDK is `replyTo` (camelCase) in current versions and `reply_to` in older ones. Check the installed `resend` version's types before writing; use whichever the SDK accepts (tsc will catch the wrong one).

---

## DECISIONS (review before building)

**Decision 1: Reply-To address.**
Recommended default: `hello@linestry.com` if that mailbox exists and is monitored; otherwise `jay@lineage.community` (known-monitored). The address MUST be a real, watched inbox, or the engagement benefit is lost and replies vanish. Jay to confirm which to use before build.

**Decision 2: List-Unsubscribe form.**
Recommended default: mailto-based, no new endpoint:
```
"List-Unsubscribe": "<mailto:unsubscribe@linestry.com?subject=unsubscribe>",
"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
```
This requires `unsubscribe@linestry.com` to be a real monitored inbox that is actioned by hand for now. A hosted one-click URL with an automated preferences page is the better long-term answer but needs a new route and a suppression store; deferred to its own session. At current volume the mailto form is sufficient and satisfies Gmail/Yahoo expectations for a small sender.

**Decision 3: Which emails get List-Unsubscribe.**
Apply to the five Notification emails (invite x2, claim, comment, tag-decision). Do NOT apply to the two Security emails (magic-link, password-reset): unsubscribing from a login or password email makes no sense and can confuse filters. Skip the internal bug-report email.

---

## Acceptance criteria

1. `npx tsc --noEmit` is clean.
2. Every one of the eight send sites includes a `text:` part. The seven that currently lack one gain a plaintext version that carries the same primary link and message as the HTML.
3. Text parts follow the comment-email precedent: no fragile `=`-bearing query strings that quoted-printable can corrupt; magic and claim links (which are long tokened URLs) are preserved verbatim and verified to still work when pasted from the plaintext part.
4. Every send site includes a `reply_to` / `replyTo` pointing at the confirmed monitored address from Decision 1.
5. The five Notification emails include `List-Unsubscribe` and `List-Unsubscribe-Post` headers per Decision 2. The two Security emails and the internal bug-report email do NOT.
6. A real send of each email type (or at least one Notification and one Security type) lands and renders, and the plaintext part is present (view source / "show original" in Gmail shows `Content-Type: text/plain` alongside `text/html`).

## Suggested order

1. Confirm Decision 1 and 2 addresses with Jay and confirm the two mailboxes exist.
2. `claim-emails.ts`, `tag-decision-emails.ts`, `invite-tracking-server.ts` (the `lib/emails` and lib helpers): add `text:`, `replyTo`, and the header block.
3. `app/api/invite/route.ts`: same three.
4. `comment-emails.ts`: add `replyTo` + header block (already has `text:`).
5. `magic-link` and `reset-password` routes: add `text:` + `replyTo` only, no unsubscribe header.
6. `bug-report` route: add `text:` + `replyTo` only (internal, optional but cheap).
7. `tsc`, then a live smoke of one Notification and one Security email, checking "show original" for the plaintext part and the header.

## Notes

- No migration this session. State that explicitly in the Ship sequence.
- No em dashes in any copy added to the plaintext parts.
- If Jay wants the proper hosted one-click unsubscribe (URL + suppression list + preferences page) instead of the mailto form, that is a larger separate feature and this brief should ship the mailto form first rather than block on it.
