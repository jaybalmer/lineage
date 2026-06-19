"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "@/lib/theme"
import { ReportBugModal } from "@/components/ui/report-bug-modal"
import { signInHref } from "@/lib/safe-redirect"

/**
 * Logged-out counterpart to AvatarDropdown. The "Sign in" button doubles as a
 * small menu so anonymous visitors can still report a browsing bug, flip the
 * theme, or read what Linestry is. Sign in stays the primary item up top. Its own
 * ref and state keep each rendered instance isolated.
 */
export function GuestMenu() {
  const path = usePathname()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const [bugOpen, setBugOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close when the route changes (navigation completed). Tracked during render
  // rather than with a synchronous setState in an effect
  // (react-hooks/set-state-in-effect).
  const [prevPath, setPrevPath] = useState(path)
  if (path !== prevPath) {
    setPrevPath(path)
    setOpen(false)
  }

  // BUG-054: carry where the visitor is now into Sign in, so login returns them
  // here instead of always landing on My Timeline. Read from window so the current
  // search (?focus=, returnTo) is captured without forcing a dynamic render.
  // Derived during render rather than stored via a setState effect; signInTo only
  // appears in the open dropdown (closed at hydration), so the window read is safe.
  const signInTo =
    typeof window === "undefined"
      ? "/auth/signin"
      : signInHref(
          window.location.pathname + window.location.search,
          new URLSearchParams(window.location.search).get("returnTo"),
        )

  // Close on outside mousedown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-strong transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        Sign in
        <span aria-hidden="true" className="text-[10px] leading-none">▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border-default rounded-xl shadow-lg overflow-hidden z-50"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {/* Sign in (primary) */}
          <Link href={signInTo}
            className="flex items-center px-4 py-2.5 text-accent-strong font-semibold hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            Sign in
          </Link>

          {/* Membership: account-related, grouped with Sign in above the divider */}
          <Link href="/membership"
            className="flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            Membership
          </Link>

          <div className="border-t border-border-default" />

          {/* Report a bug */}
          <button
            type="button"
            onClick={() => { setOpen(false); setBugOpen(true) }}
            className="w-full flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}
          >
            Report a bug
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggle}
            className="w-full flex items-center justify-between px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}
          >
            <span>Theme</span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-sm leading-none">{theme === "dark" ? "☾" : "☀"}</span>
              {theme === "dark" ? "Dark" : "Light"}
            </span>
          </button>

          {/* About: points at /word (the definition) for now; repoint when an about page exists */}
          <Link href="/word"
            className="flex items-center px-4 py-2.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            style={{ fontSize: 11 }}>
            About
          </Link>
        </div>
      )}

      <ReportBugModal open={bugOpen} onClose={() => setBugOpen(false)} />
    </div>
  )
}
