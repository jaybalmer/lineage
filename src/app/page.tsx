"use client"

import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"

const FEATURES = [
  {
    icon: "🏔",
    title: "Trace your riding history",
    desc: "Map every resort, backcountry zone, and season. Build a personal record of where snowboarding took you.",
  },
  {
    icon: "🤙",
    title: "Find hidden connections",
    desc: "Who else rode your mountain in 2004? Discover overlaps with other riders you never knew you had.",
  },
  {
    icon: "🏂",
    title: "Document your gear lineage",
    desc: "Every board you've owned, every sponsor, every team. The gear story is part of the riding story.",
  },
  {
    icon: "🔒",
    title: "Private by default",
    desc: "You control what's visible. Keep your lineage personal, share it with connections, or make it public.",
  },
]

export default function Home() {
  const { onboardingComplete } = useLineageStore()

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {onboardingComplete && <Nav />}

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="text-blue-400 text-3xl">⬡</span>
          <span className="text-2xl font-bold text-white tracking-tight">Lineage</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-5">
          The living graph of<br />
          <span className="text-blue-400">snowboarding history</span>
        </h1>

        <p className="text-zinc-400 text-lg leading-relaxed max-w-xl mx-auto mb-10">
          Built by riders, for riders. Track where you&apos;ve been, who you rode with,
          and what shaped your riding — then discover how your story connects to everyone else&apos;s.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {onboardingComplete ? (
            <>
              <Link
                href="/timeline"
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 transition-colors"
              >
                My Timeline →
              </Link>
              <Link
                href="/onboarding"
                className="w-full sm:w-auto px-8 py-3 rounded-xl border border-[#2a2a2a] text-zinc-300 font-semibold text-sm hover:border-zinc-500 hover:text-white transition-colors"
              >
                New Rider
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/onboarding"
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 transition-colors"
              >
                Start your lineage →
              </Link>
              <Link
                href="/timeline"
                className="w-full sm:w-auto px-8 py-3 rounded-xl border border-[#2a2a2a] text-zinc-300 font-semibold text-sm hover:border-zinc-500 hover:text-white transition-colors"
              >
                My Timeline
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-3xl mx-auto px-6">
        <div className="border-t border-[#1e1e1e]" />
      </div>

      {/* Feature grid */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-2 gap-5">
          {FEATURES.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5 space-y-2"
            >
              <div className="text-2xl">{icon}</div>
              <div className="font-semibold text-white text-sm">{title}</div>
              <div className="text-zinc-500 text-xs leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer line */}
      <div className="text-center pb-16">
        <p className="text-zinc-700 text-xs">
          Snowboarding has 40 years of history — let&apos;s map it.
        </p>
      </div>
    </div>
  )
}
