"use client"

import { useEffect, useState } from "react"

export type Theme = "dark" | "light"

const STORAGE_KEY = "lineage-theme"
const DEFAULT_THEME: Theme = "dark"

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    const initial = stored ?? DEFAULT_THEME
    setTheme(initial)
    applyTheme(initial)
  }, [])

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    applyTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
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
