"use client"

import { useTheme } from "@/lib/theme"

export function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="text-muted hover:text-foreground transition-colors text-base leading-none w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-hover"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  )
}
