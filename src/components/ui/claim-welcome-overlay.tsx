"use client"

// node-claim-by-admin-invite arrival moment. Shown once to a rider who just
// claimed their account from an admin invite: their existing history is already
// attached, so the message is "your history is already here" plus the moment
// count and a first-story CTA. Distinct from WelcomeExplosion (the generic
// new-account celebration); an invited claimant sees this instead of that.
//
// Presentational: the owner-timeline panel owns the trigger-prefs gating and
// passes momentCount + the AddStoryModal opener. Fires claim_welcome_shown once.

import { useEffect } from "react"
import { trackEvent } from "@/lib/analytics"
import { BrandMark } from "@/components/ui/brand-mark"

export function ClaimWelcomeOverlay({
  name,
  momentCount,
  onAddStory,
  onDismiss,
}: {
  name: string
  momentCount: number
  onAddStory: () => void
  onDismiss: () => void
}) {
  useEffect(() => {
    trackEvent("ftue", "claim_welcome_shown", { moment_count: momentCount })
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // Fire once on mount; momentCount is stable by the time this renders.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const firstName = name.split(" ")[0] || name
  const momentLine =
    momentCount > 0
      ? `${momentCount} ${momentCount === 1 ? "moment is" : "moments are"} already on your timeline, added by the community.`
      : "Your timeline starts now."

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-5"
      style={{ background: "rgba(10,8,6,0.94)" }}
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-7 text-center"
        style={{ background: "#161413", borderColor: "#3b82f640" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex justify-center">
          <BrandMark size={40} color="#3b82f6" />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "#F6F6F5" }}>
          Welcome, {firstName}.
        </h1>
        <p className="mt-2 text-base font-semibold" style={{ color: "#F6F6F5" }}>
          Your history is already here.
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: "#A8A29E" }}>
          {momentLine} Add your own stories to build it out.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onAddStory}
            className="w-full rounded-lg py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "#3b82f6" }}
          >
            Add your first story
          </button>
          <button
            onClick={onDismiss}
            className="w-full rounded-lg py-2.5 text-sm font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Explore my timeline first
          </button>
        </div>
      </div>
    </div>
  )
}
