# Bug-fix brief: timeline player ambient music too loud by default

> Build-ready. Implement from this file. Single bug, clean constant change.
> Scope: **BUG-041** (timeline video-slide ambient music too loud by default on mobile).

## Goal

Lower the default loudness of the timeline player's synthesized ambient soundtrack so a viewer on a phone at a normal-to-low system volume does not have to turn their phone down further. The play feature is the headline surface; the music should sit under the moment, not over it.

## DECISIONS (review before building)

1. **Target default level.** Recommended default: drop the master gain from `0.45` to `0.22` (roughly half, a clear reduction without making it inaudible). Alternative: `0.15` if Jay wants it nearly subliminal, or `0.30` for a gentler trim. One-line constant; easy to retune after a listen.
2. **Scope of the change.** Recommended default: change only the master gain in the shared `useAmbientAudio` hook, leaving the per-layer pad/bass/reverb balance untouched (they are proportional to master, so the mix stays the same, just quieter). Alternative: also trim the bass layer (`0.28`) which can feel loudest on phone speakers; only do this if the master-only drop still feels bass-heavy on a device.
3. **Add a persisted volume control?** Recommended default: NO. A mute toggle already exists in the player chrome ("Mute (M)"), and the report is about the default level, not the lack of control. Lowering the default is the shippable fix. Alternative (defer): a small volume slider or a remembered mute preference; out of scope for this brief.

## Verified suspected files

- `src/components/ui/timeline-player.tsx` — the `useAmbientAudio(enabled)` hook (Web Audio synthesized soundtrack). Master gain ramps to `0.45`:
  - `master.gain.setTargetAtTime(0.45, ctx.currentTime, 2)` (around line 220 on the feature branch; line 139 on `main`). This is the single master volume knob; lowering it scales the whole mix.
  - Layer gains for reference (leave as-is per Decision 2): reverb `reverbGain.gain.value = 0.35`; pad chord `vol = 0.12`; bass `0.28`.
  - A mute toggle already exists in the shared `TimelinePlayerShell` chrome ("Mute (M)" / "Unmute (M)"), so no new control is needed.
- Shared by all three play surfaces, so one change covers them all:
  - `src/components/ui/timeline-player.tsx` (personal play, `TimelinePlayer` + `TimelinePlayerShell`)
  - `src/components/ui/community-timeline-player.tsx` (community play, reuses `TimelinePlayerShell` via PR #67; not yet on `main`)
  - `src/components/ui/compare-player.tsx`
  - Make the edit on `main`'s `timeline-player.tsx` so personal play is fixed immediately and community play inherits it when PR #67 lands. No need to touch the feature branch separately.

## Repro

On an iPhone (414x750, Safari), open `https://linestry.com/snowboarding`, start a timeline play, and note the ambient music plays louder than expected even when the phone's system volume is already low.

## Acceptance (BUG-041)

- The timeline player's default ambient music is audibly quieter than before (master gain reduced per Decision 1), checked on a phone at a normal-to-low system volume.
- The mute toggle still works.
- No change to the music's character or layer balance (master-only trim), and no console errors from the audio context.
- `npx tsc --noEmit` clean.

## Suggested order

1. Lower the master gain constant in `useAmbientAudio` (Decision 1 value).
2. Optional, only if it still feels bass-heavy on device: trim the bass layer gain (Decision 2 alternative).
3. Smoke on a phone (or a narrow viewport with sound) that the music is quieter and mute still works.
4. `npx tsc --noEmit`.

## Ship reminders

- Name **BUG-041** in the PR title or commit message (the daily triage reconciles Shipped by reading merged-PR messages).
- Append one `status: pending` entry to `bugs/SHIP-LOG.md` (schema at the top of that file). Do not edit earlier entries.
- Do NOT edit the Shipped section of `bugs/bug-triage.md`; Cowork reconciles it after the PR lands.
- No em dashes anywhere (code, comments, copy).
- One PR for the session; push the branch and let Jay merge.
