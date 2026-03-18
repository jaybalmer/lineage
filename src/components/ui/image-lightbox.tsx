"use client"

import { useEffect } from "react"

interface ImageLightboxProps {
  src: string
  alt: string
  /** Optional URL to open in a new tab via "Open source" button */
  href?: string
  /** Label for the href button, e.g. "View board" or "Open image" */
  hrefLabel?: string
  onClose: () => void
}

export function ImageLightbox({ src, alt, href, hrefLabel, onClose }: ImageLightboxProps) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Prevent scroll behind modal
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 flex flex-col items-center gap-3 max-w-3xl w-full">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-1 -right-1 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/80 hover:text-white hover:bg-black/80 transition-colors z-20 text-sm"
          aria-label="Close"
        >
          ×
        </button>

        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl"
          style={{ background: "rgba(0,0,0,0.4)" }}
        />

        {/* Footer actions */}
        <div className="flex items-center gap-3">
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/20 transition-colors text-sm font-medium"
            >
              {hrefLabel ?? "Open link"}
              <span className="text-xs opacity-70">↗</span>
            </a>
          )}
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/20 transition-colors text-sm font-medium"
          >
            Open image
            <span className="text-xs opacity-70">↗</span>
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
