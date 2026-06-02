"use client"

import { useEffect } from "react"

// Pulsing accent glow for the current-year "add your board" slot. Injected at
// runtime to match the celebration-overlay / welcome-explosion keyframe pattern
// (no framer-motion). Honors prefers-reduced-motion.
const KEYFRAMES = `
@keyframes tlPromptGlow {
  0%, 100% { box-shadow: 0 0 0 1px #3b82f655, 0 0 14px 0 #3b82f622; }
  50%      { box-shadow: 0 0 0 1px #3b82f6aa, 0 0 22px 2px #3b82f444; }
}
@media (prefers-reduced-motion: reduce) {
  .tl-prompt-card { animation: none !important; }
}
`

let injected = false
function injectStyles() {
  if (injected || typeof document === "undefined") return
  injected = true
  const el = document.createElement("style")
  el.textContent = KEYFRAMES
  document.head.appendChild(el)
}

export function TimelinePrompt({ onClick }: { onClick: () => void }) {
  useEffect(() => { injectStyles() }, [])

  return (
    <button
      type="button"
      onClick={onClick}
      className="tl-prompt-card w-full text-left rounded-xl px-4 py-3.5 cursor-pointer transition-transform hover:-translate-y-0.5"
      style={{
        background:  "#3b82f60D",
        border:      "1px solid #3b82f655",
        animation:   "tlPromptGlow 2.4s ease-in-out infinite",
        fontFamily:  "var(--font-body)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex-shrink-0 flex items-center justify-center rounded-full"
          style={{ width: 28, height: 28, background: "#3b82f6", color: "#fff", fontSize: 18, fontWeight: 700, lineHeight: 1 }}
          aria-hidden
        >
          +
        </span>
        <div className="min-w-0">
          <p className="m-0 font-semibold text-foreground" style={{ fontSize: 14 }}>
            What are you riding right now?
          </p>
          <p className="m-0 text-muted" style={{ fontSize: 12, marginTop: 2 }}>
            Add the board in your quiver to start your timeline.
          </p>
        </div>
        <span className="ml-auto flex-shrink-0" style={{ fontSize: 18, color: "#2563EB" }} aria-hidden>
          &rarr;
        </span>
      </div>
    </button>
  )
}
