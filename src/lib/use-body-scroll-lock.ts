"use client"

import { useEffect } from "react"

// Shared body scroll-lock for overlays (modals, popovers, sheets, lightbox).
// While any overlay is open the background page must not scroll behind it; the
// overlay's own inner scroll container keeps scrolling normally. Mobile Safari
// ignores `overflow: hidden` on the body, so we pin the body with
// `position: fixed` and restore the scroll position on release.
//
// A module-level reference count keeps stacked overlays correct: a modal that
// opens a nested picker (or a lightbox over a modal) shares one lock, and the
// page only unlocks when the last overlay closes. See BUG-048.

let lockCount = 0
let savedScrollY = 0

function lockBody() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY
    const body = document.body
    body.style.position = "fixed"
    body.style.top = `-${savedScrollY}px`
    body.style.left = "0"
    body.style.right = "0"
    body.style.width = "100%"
    body.style.overflow = "hidden"
  }
  lockCount += 1
}

function unlockBody() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    const body = document.body
    body.style.position = ""
    body.style.top = ""
    body.style.left = ""
    body.style.right = ""
    body.style.width = ""
    body.style.overflow = ""
    window.scrollTo(0, savedScrollY)
  }
}

/**
 * Lock the body scroll while `active` is true. Pass the overlay's open flag for
 * components that stay mounted (for example modals gated by an `open` prop); omit
 * it for components that only mount while open.
 */
export function useBodyScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return
    lockBody()
    return () => unlockBody()
  }, [active])
}
