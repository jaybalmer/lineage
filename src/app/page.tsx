"use client"

import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"

const FEATURES = [
  {
    title: "Your riding history, mapped",
    desc: "Every resort, backcountry zone, and season — logged and searchable. A personal record of where the sport took you.",
  },
  {
    title: "Who else was there",
    desc: "Rode Baldface in 2004? Baker every January for a decade? Surface connections with other riders you never knew you shared.",
  },
  {
    title: "Boards, sponsors, crews",
    desc: "The gear you rode, the brands you repped, the teams you were part of. All of it is part of the story.",
  },
  {
    title: "Yours until you say otherwise",
    desc: "Your lineage is private by default. Share it with connections, make it public, or keep it to yourself.",
  },
]

export default function Home() {
  const { onboardingComplete } = useLineageStore()

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {onboardingComplete && <Nav />}

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-blue-400 text-[6rem] leading-none">⬡</span>
          <div className="text-left">
            <div className="h-[18px]" />{/* spacer matches SNOWBOARDING height so items-center lands on Lineage */}
            <div className="text-4xl font-bold text-white tracking-tight leading-none">Lineage</div>
            <div className="text-sm font-medium text-zinc-500 tracking-widest uppercase mt-1">Snowboarding</div>
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-5">
          The living timeline of<br />
          <span className="text-blue-400">snowboarding</span>
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

      {/* Feature list */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="divide-y divide-[#1e1e1e]">
          {FEATURES.map(({ title, desc }, i) => (
            <div key={title} className="grid grid-cols-[2rem_1fr] sm:grid-cols-[2rem_11rem_1fr] gap-x-6 gap-y-1 py-6 items-baseline">
              <span className="text-[11px] text-zinc-700 font-mono pt-px">{String(i + 1).padStart(2, "0")}</span>
              <div className="text-sm font-semibold text-white leading-snug">{title}</div>
              <div className="col-start-2 sm:col-start-3 text-zinc-500 text-sm leading-relaxed">{desc}</div>
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
