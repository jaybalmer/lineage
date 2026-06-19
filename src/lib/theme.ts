"use client"

import { useEffect, useSyncExternalStore } from "react"

export type Theme = "dark" | "light"

const STORAGE_KEY = "lineage-theme"
// Brand default is light (white background). The signed-out landing renders
// light, so signing in must not flip to dark. Dark is opt-in via toggle().
const DEFAULT_THEME: Theme = "light"

// The persisted theme lives in localStorage, an external store. useSyncExternalStore
// reads it in a hydration-safe way (server renders DEFAULT_THEME, the client adopts
// the stored value right after hydration) without a synchronous setState inside an
// effect (react-hooks/set-state-in-effect). An inline script in the document head
// also applies the class before first paint to avoid a flash (see app/layout.tsx).
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

function getSnapshot(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Keep the <html> class in sync with the active theme.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* SSR / storage full */ }
    listeners.forEach((l) => l())
  }

  return { theme, toggle }
}

function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark")
  } else {
    document.documentElement.classList.remove("dark")
  }
}
