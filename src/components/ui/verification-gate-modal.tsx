"use client"

import Link from "next/link"
import { useLineageStore } from "@/store/lineage-store"

interface Props {
  onClose: () => void
}

export function VerificationGateModal({ onClose }: Props) {
  const { setTriggerPrefs } = useLineageStore()

  const handleNotNow = () => {
    setTriggerPrefs({ verification_gate_session_shown: true })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-surface border border-border-default rounded-2xl w-full max-w-sm p-6"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="text-center mb-4">
          <span style={{ fontSize: 32, color: "#3b82f6" }}>◈</span>
        </div>

        {/* Title */}
        <div className="text-foreground text-center mb-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
          VERIFICATION BUILDS<br />OUR COLLECTIVE RECORD
        </div>

        {/* Body */}
        <p className="text-muted text-center mb-2" style={{ fontSize: 10, lineHeight: 1.8 }}>
          Verifying entries is how we keep the history trustworthy.
          It&apos;s a responsibility — and a recognition that you were there.
        </p>
        <p className="text-muted text-center mb-6" style={{ fontSize: 10, lineHeight: 1.8 }}>
          Members can verify entries and earn contribution tokens.
          This is the only feature behind membership.
        </p>

        {/* CTAs */}
        <div className="space-y-2">
          <Link
            href="/membership"
            className="flex items-center justify-center w-full py-3 rounded-full font-bold transition-all hover:opacity-80"
            style={{
              background: "#3b82f6",
              color: "#fff",
              fontSize: 10,
              letterSpacing: 1.5,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            Become a member — $25/year
          </Link>

          <Link
            href="/membership"
            onClick={onClose}
            className="flex items-center justify-center w-full py-2.5 rounded-full border border-border-default text-muted hover:text-foreground hover:border-foreground transition-all"
            style={{ fontSize: 10, letterSpacing: 1 }}
          >
            Learn more about membership
          </Link>

          <button
            onClick={handleNotNow}
            className="w-full py-2 text-muted hover:text-foreground transition-colors"
            style={{ fontSize: 10, background: "none", border: "none", cursor: "pointer" }}
          >
            Not right now
          </button>
        </div>
      </div>
    </div>
  )
}
