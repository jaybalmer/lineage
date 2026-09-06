// FNRad Listener Landing (features/fnrad-listener-landing-brief.md), T5.
//
// This week's challenge, shared by the /fnrad hub and the public episode page.
// It has no interactive part of its own: everything it does is a link, which is
// why a guest-story challenge is cheaper to render than the mark-based one it
// replaced (D5, risk 12). Renders on the dark ground both surfaces use.
//
// The spotlight is ALWAYS the one person from FNRAD_CHALLENGE.guestId, resolved
// by the caller. It never takes a list and never indexes an episode's own guests
// (meta.guests), which is what makes the hub and the episode page structurally
// unable to name different people (D5, A8c). "No guest" is expressed by not
// mounting the card, so the `guest` prop is non-optional (D5 render state 3).

import Link from "next/link"
import { addStoryAboutHref } from "@/lib/fnrad"

/** Structural subset of PublicPersonLite, declared narrow so this leaf does not
 *  depend on the reader. A resolved person satisfies it with no mapping. */
export interface ChallengeGuest {
  id: string
  display_name: string
  avatar_url: string | null
}

function GuestAvatar({ name, url }: { name: string; url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className="w-9 h-9 rounded-full object-cover border border-white/15" title={name} />
  ) : (
    <div
      className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white border border-white/15"
      title={name}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  )
}

export function ChallengeCard(props: {
  /** The ONE person from FNRAD_CHALLENGE.guestId, already resolved by the caller.
   *  Non-optional: "no guest" is expressed by not mounting the card. */
  guest: ChallengeGuest
  mode: "hub" | "episode"
  /** Hub mode only, OPTIONAL: the episode's public_slug. Null until the S12 E01
   *  page exists; it is the single switch for the kicker + "See the episode". */
  episodeSlug?: string | null
  /** Hub mode only, OPTIONAL: what the "From {episode}" kicker prints. Rendered
   *  only when episodeSlug is also a non-empty string. */
  episodeLabel?: string | null
}) {
  const { guest, mode, episodeSlug, episodeLabel } = props
  const first = guest.display_name.split(" ")[0]

  // episodeSlug is the single switch for the hub kicker + secondary: a kicker
  // naming an episode the listener cannot open is worse than no kicker (D5, T5).
  const hasEpisode = mode === "hub" && typeof episodeSlug === "string" && episodeSlug.length > 0

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
        This week&apos;s challenge
      </div>
      {hasEpisode && episodeLabel && (
        <div className="mt-1 text-xs text-white/50">From {episodeLabel}</div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <GuestAvatar name={guest.display_name} url={guest.avatar_url} />
        <span className="text-sm font-semibold text-white">{guest.display_name}</span>
      </div>

      {/* Episode-1 instance (Appendix A [challenge-ask] / [challenge-body]). For
          episodes after the first, drop the season framing: "{Guest} was on this
          week's episode. Add your stories connected to {First}." */}
      <p className="mt-4 text-lg font-semibold leading-snug text-white">
        {guest.display_name} is the first guest of Season 12. Add your stories connected to {first}.
      </p>
      <p className="mt-2 text-sm font-light leading-relaxed text-white/75">
        Your stories and photos of their boards, the events, the videos. If you were there, or you
        watched it happen, write it down. {first} would love to see them.
      </p>

      <div className="mt-5">
        <Link
          href={addStoryAboutHref(guest.id)}
          className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
        >
          Add your story about {first}
        </Link>
        <p className="mt-2 text-xs text-white/45">You will need an account. It takes a minute and it is free.</p>
      </div>

      {mode === "episode" && (
        <Link
          href={`/people/${guest.id}`}
          className="mt-3 inline-block text-xs font-medium text-white/60 transition-colors hover:text-white"
        >
          Or open their page
        </Link>
      )}
      {hasEpisode && (
        <Link
          href={`/t/${episodeSlug}`}
          className="mt-3 inline-block text-xs font-medium text-white/60 transition-colors hover:text-white"
        >
          See the episode
        </Link>
      )}
    </section>
  )
}
