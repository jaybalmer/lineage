# Voice + Phone Status Channel

> Cowork-authored ops brief, September 9 2026. Small. No product code, no
> migration. This is a Cowork/scheduled-task change plus a one-time confirmation,
> not a Claude Code build. It gives Jay a spoken "what happened with the bug run
> last night" from his phone with no new infrastructure.

---

## The design (confirmed against what is already wired)

The intent brief reasons this out correctly and it holds up:
- **Claude mobile app Voice Mode** is the spoken back-and-forth. This is the tool
  for asking for a status update out loud.
- **Claude Code Remote Control** is local-only and has no voice, so it is the
  wrong tool for this and we build nothing on it.

The practical path needs the run's status to land in a channel the regular Claude
mobile app can already reach, so Jay can ask it, in Voice Mode, to read the latest.
Gmail is already a connected connector and is the natural channel. The existing
"Hey Voter" routine already uses exactly this pattern (leave output where the
mobile app can read it, then notify). So this is a reuse, not a new mechanism.

Today the auto-fix loop only emails on risky/stopped runs, and the daily digest
writes to the queues (Drive / ops repo), not to email. So the one missing piece is
a short daily status email.

---

## DECISIONS (review before building)

**D1. Channel is Gmail. DEFAULT: yes.**
The morning digest emits one short status email to Jay each morning:
subject `Linestry overnight: <date>`, body = the top of the digest (what shipped
overnight, current bug state P0/P1, the lead brief, and any escalations). Plain,
scannable, mobile-first. Jay then asks mobile Claude in Voice Mode "read me the
Linestry overnight update" and it reads the latest matching email aloud.

**D2. Reuse the digest, do not add a report. DEFAULT: yes.**
This is a new OUTPUT of the existing morning digest, not a new scheduled job. The
inventory's whole no-duplicate-reporting point is that there is one reporting
spine; this hangs a thin email off it. Do not create a separate "status" task.

**D3. Fallback channel is the Drive/ops file, no build needed. DEFAULT: note it.**
Even without the email, Jay can ask mobile Claude to read `priorities.md` (Drive
connector) or `queues/NEXT-SESSION.md` (once the ops repo exists) in Voice Mode.
The email just makes it a single predictable thing to ask for.

---

## Tasks

**T1.** In the morning digest task, after it finishes reconciling, compose a short
status (shipped-overnight list, P0/P1 counts, current lead, escalations) and send
it to jay@lineage.community via the existing Gmail path (Resend or the Gmail
connector, whichever the digest already has). One email per morning.

**T2.** Keep it under a screen: TL;DR line, then at most a short bulleted status.
No em dashes (standing rule). This is the thing Voice Mode reads aloud, so write it
to be heard, not skimmed: lead with the one sentence that answers "did anything
break and did the run ship."

**T3.** One-time: confirm the Claude mobile app has the Gmail connector enabled so
Voice Mode can pull the email, and do a live test ("read me the latest Linestry
overnight update").

---

## Acceptance criteria

1. The morning after this ships, one `Linestry overnight: <date>` email is in Jay's
   inbox with the shipped list, bug state, lead, and any escalation.
2. Asking mobile Claude in Voice Mode for the update reads that email's content
   aloud.
3. No second scheduled task was created; the email comes from the existing digest.

## What Jay does (gated, human-only)

1. This is a Cowork change (the digest is a Cowork scheduled task), so make it in a
   Cowork session, not Claude Code.
2. Confirm the Gmail connector is on in the Claude mobile app and run one live
   Voice Mode test.
3. Optional: once brief 4B moves the digest to a hosted schedule, the email step
   moves with it unchanged.
