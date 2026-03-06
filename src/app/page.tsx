"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLineageStore } from "@/store/lineage-store"

export default function Home() {
  const router = useRouter()
  const { onboardingComplete } = useLineageStore()

  useEffect(() => {
    if (onboardingComplete) {
      router.replace("/timeline")
    } else {
      router.replace("/onboarding")
    }
  }, [onboardingComplete, router])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex items-center gap-2 text-zinc-600">
        <span className="text-blue-400">⬡</span>
        <span>Lineage</span>
      </div>
    </div>
  )
}
