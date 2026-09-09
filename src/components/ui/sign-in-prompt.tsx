"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import { safeReturnTo } from "@/lib/safe-redirect"

/**
 * Press-time gate for contribution affordances shown to signed-out visitors
 * (BUG-161 catalog adds, BUG-162 "+ Add to my profile"). Rather than open the
 * add flow (which silently no-ops when not authed) or dump the visitor on the
 * riders directory, we show this and route to the existing auth entry point.
 *
 * returnTo carries the current path so sign-in lands the visitor back where
 * they were and they can retry the add (BUG-161 D4: the trivial ?next=, nothing
 * more). safeReturnTo on /auth/signin validates it.
 */
export function SignInPrompt({
  onClose,
  message,
}: {
  onClose: () => void
  message?: string
}) {
  useBodyScrollLock()
  const pathname = usePathname()
  // Carry path AND search, so a signup intent (or any query param) on the
  // current URL survives to /auth/signin. Guard the window read for SSR and
  // validate through the same guard /auth/signin uses.
  const search = typeof window !== "undefined" ? window.location.search : ""
  const target = safeReturnTo(`${pathname ?? ""}${search}`)
  const returnTo = target ? `?returnTo=${encodeURIComponent(target)}` : ""

  return (
    <div
      // z-[60] to match AddEntityModal so this stacks above any parent surface.
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-surface border border-border-default rounded-2xl p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-foreground mb-2">Create your timeline to add this</h2>
        <p className="text-sm text-muted mb-5">
          {message ??
            "Adding to Linestry needs an account so your contribution is credited to you. It takes about a minute."}
        </p>
        {/* R7 (D10): signup leads, because this prompt fires the first time someone
            tries to contribute, which strongly implies no account. The returning
            member loses nothing: their action is one line down and still carries
            returnTo. */}
        <div className="flex flex-col gap-2">
          <Link
            href={`/onboarding${returnTo}`}
            className="w-full text-center px-4 py-2.5 rounded-lg bg-[#1C1917] text-sm font-medium text-white hover:bg-[#292524] transition-colors"
          >
            Create your timeline
          </Link>
          <Link
            href={`/auth/signin${returnTo}`}
            className="w-full text-center px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            I already have an account
          </Link>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
