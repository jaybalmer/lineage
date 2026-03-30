"use client"

import { useState, useEffect } from "react"

const STORAGE_KEY = "lineage_access"
const CORRECT_PASSWORD = "outland"

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [ready, setReady] = useState(false)
  const [input, setInput] = useState("")
  const [error, setError] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "1") setUnlocked(true)
    setReady(true)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input === CORRECT_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "1")
      setUnlocked(true)
      setError(false)
    } else {
      setError(true)
      setInput("")
    }
  }

  if (!ready) return null

  if (unlocked) return <>{children}</>

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-sm px-8 py-10 rounded-2xl bg-[#141414] border border-[#2a2a2a] shadow-2xl flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold tracking-tight text-white">Lineage</span>
          <span className="text-sm text-[#71717a]">Enter the password to continue</span>
        </div>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            type="password"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setError(false)
            }}
            placeholder="Password"
            autoFocus
            className="w-full px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-[#71717a] text-sm outline-none focus:border-blue-500 transition-colors"
          />
          {error && (
            <p className="text-xs text-red-400 text-center -mt-1">Incorrect password</p>
          )}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  )
}
