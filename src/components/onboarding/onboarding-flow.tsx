"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useLineageStore } from "@/store/lineage-store"
import { PLACES, BOARDS, ORGS } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import type { Place, Board, Org } from "@/types"

const STEPS = [
  "Welcome",
  "When did you start?",
  "Where did you first ride?",
  "What was your first board?",
  "Who shaped your early riding?",
  "Privacy",
]

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-0.5 flex-1 rounded-full transition-all duration-300",
            i < step ? "bg-blue-500" : i === step ? "bg-blue-400" : "bg-[#2a2a2a]"
          )}
        />
      ))}
    </div>
  )
}

function YearPicker({ value, onChange }: { value?: number; onChange: (y: number) => void }) {
  const years = Array.from({ length: 61 }, (_, i) => 2025 - i)
  return (
    <div className="grid grid-cols-6 gap-2 mt-4 max-h-72 overflow-y-auto pr-1">
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onChange(y)}
          className={cn(
            "py-2 rounded-lg text-sm font-medium border transition-all",
            value === y
              ? "border-blue-500 bg-blue-950 text-blue-200"
              : "border-[#2a2a2a] bg-[#141414] text-zinc-400 hover:border-zinc-600 hover:text-white"
          )}
        >
          {y}
        </button>
      ))}
    </div>
  )
}

function SearchSelect({
  items,
  value,
  onChange,
  placeholder,
  getLabel,
  getId,
  addEntityType,
  addEntityLabel,
}: {
  items: { id: string; [key: string]: unknown }[]
  value?: string
  onChange: (id: string) => void
  placeholder: string
  getLabel: (item: { id: string; [key: string]: unknown }) => string
  getId: (item: { id: string; [key: string]: unknown }) => string
  addEntityType?: "place" | "board" | "org"
  addEntityLabel?: string
}) {
  const [query, setQuery] = useState("")
  const [showModal, setShowModal] = useState(false)
  const filtered = items.filter((i) =>
    getLabel(i).toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="mt-4">
      {showModal && addEntityType && (
        <AddEntityModal
          entityType={addEntityType}
          initialName={query}
          onClose={() => setShowModal(false)}
          onAdded={(id) => {
            onChange(id)
            setShowModal(false)
          }}
        />
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
      />
      <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-[#2a2a2a] divide-y divide-[#1e1e1e]">
        {filtered.slice(0, 12).map((item) => (
          <button
            key={getId(item)}
            onClick={() => onChange(getId(item))}
            className={cn(
              "w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2",
              value === getId(item)
                ? "bg-blue-950 text-blue-200"
                : "text-zinc-300 hover:bg-[#1a1a1a]"
            )}
          >
            <span className="flex-1">{getLabel(item)}</span>
            {(item as unknown as { community_status?: string }).community_status === "unverified" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40 flex-shrink-0">◎ new</span>
            )}
          </button>
        ))}
        {addEntityType && query.trim().length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full text-left px-4 py-3 text-sm text-blue-400 hover:bg-[#1a1a1a] transition-colors flex items-center gap-2"
          >
            <span className="text-blue-500 font-bold">+</span>
            Add &ldquo;{query.trim()}&rdquo; as a new {addEntityLabel ?? addEntityType}
          </button>
        )}
        {filtered.length === 0 && !query.trim() && (
          <div className="px-4 py-3 text-sm text-zinc-600">No results — you can add this later</div>
        )}
      </div>
    </div>
  )
}

export function OnboardingFlow() {
  const router = useRouter()
  const { onboarding, setOnboardingField, setOnboardingStep, completeOnboarding, userEntities } = useLineageStore()
  const step = onboarding.step

  const allPlaces = [...PLACES, ...userEntities.places] as unknown as { id: string; [key: string]: unknown }[]
  const allBoards = [...BOARDS, ...userEntities.boards] as unknown as { id: string; [key: string]: unknown }[]
  const allOrgs = [...ORGS, ...userEntities.orgs] as unknown as { id: string; [key: string]: unknown }[]

  const next = () => {
    if (step < STEPS.length - 1) setOnboardingStep(step + 1)
    else {
      completeOnboarding()
      router.push("/timeline")
    }
  }

  const back = () => {
    if (step > 0) setOnboardingStep(step - 1)
  }

  const canContinue = () => {
    if (step === 1) return !!onboarding.start_year
    return true
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-8">
            <span className="text-blue-400 text-xl">⬡</span>
            <span className="font-semibold text-white">Lineage</span>
          </div>
          <ProgressBar step={step} total={STEPS.length} />
        </div>

        {/* Step content */}
        <div className="min-h-[400px]">
          {step === 0 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-white">Build your snowboarding lineage.</h1>
              <p className="text-zinc-400 leading-relaxed">
                Lineage is a living graph of snowboarding history — built by riders, for riders.
                Start by adding your own timeline: where you rode, who you rode with, and what shaped your riding.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  "🏔  Trace your riding history by place and season",
                  "🤙  Find connections — who else rode your mountain in 2004?",
                  "🏂  Document your gear lineage over the years",
                  "🔒  Private by default — you control what's visible",
                ].map((item) => (
                  <div key={item} className="flex gap-3 text-sm text-zinc-300 bg-[#141414] rounded-lg px-4 py-3 border border-[#2a2a2a]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">When did you start snowboarding?</h2>
              <p className="text-zinc-500 text-sm mb-2">Pick your first season — even an approximate year works.</p>
              <YearPicker
                value={onboarding.start_year}
                onChange={(y) => setOnboardingField("start_year", y)}
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Where did you first ride?</h2>
              <p className="text-zinc-500 text-sm mb-2">The resort, hill, or zone where it all started.</p>
              <SearchSelect
                items={allPlaces}
                value={onboarding.first_place_id}
                onChange={(id) => setOnboardingField("first_place_id", id)}
                placeholder="Search resorts..."
                getLabel={(i) => (i as unknown as { name: string }).name}
                getId={(i) => i.id}
                addEntityType="place"
                addEntityLabel="place"
              />
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">What was your first board?</h2>
              <p className="text-zinc-500 text-sm mb-2">The gear that started the obsession.</p>
              <SearchSelect
                items={allBoards}
                value={onboarding.first_board_id}
                onChange={(id) => setOnboardingField("first_board_id", id)}
                placeholder="Search boards..."
                getLabel={(i) => {
                  const b = i as unknown as { brand: string; model: string; model_year: number }
                  return `${b.brand} ${b.model} '${String(b.model_year).slice(2)}`
                }}
                getId={(i) => i.id}
                addEntityType="board"
                addEntityLabel="board"
              />
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Who or what shaped your early riding?</h2>
              <p className="text-zinc-500 text-sm mb-2">Shops, crews, sponsors, or teams you were part of.</p>
              <SearchSelect
                items={allOrgs}
                value={onboarding.early_orgs[0]}
                onChange={(id) => setOnboardingField("early_orgs", [id])}
                placeholder="Search shops, brands, teams..."
                getLabel={(i) => (i as unknown as { name: string }).name}
                getId={(i) => i.id}
                addEntityType="org"
                addEntityLabel="shop/brand/team"
              />
              <p className="text-xs text-zinc-600 mt-3">Optional — you can build this out on your timeline.</p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white mb-1">Your privacy, your call.</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Everything you just entered is <strong className="text-white">private by default</strong>.
                You choose what to make visible to others — nothing is published without your opt-in.
              </p>
              <div className="mt-4 space-y-3">
                {[
                  { icon: "🔒", title: "Private", desc: "Only you can see this" },
                  { icon: "👥", title: "Shared", desc: "Visible to people you invite" },
                  { icon: "🌐", title: "Public", desc: "Anyone on Lineage can see this" },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3 bg-[#141414] rounded-lg px-4 py-3 border border-[#2a2a2a]">
                    <span className="text-lg">{icon}</span>
                    <div>
                      <div className="text-sm font-medium text-white">{title}</div>
                      <div className="text-xs text-zinc-500">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-600 mt-2">
                You can change visibility for any claim at any time. Lineage follows PIPEDA privacy principles.
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#1e1e1e]">
          <button
            onClick={back}
            className={cn(
              "text-sm text-zinc-500 hover:text-white transition-colors",
              step === 0 && "invisible"
            )}
          >
            ← Back
          </button>
          <button
            onClick={next}
            disabled={!canContinue()}
            className={cn(
              "px-6 py-2.5 rounded-lg text-sm font-medium transition-all",
              canContinue()
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-[#1e1e1e] text-zinc-600 cursor-not-allowed"
            )}
          >
            {step === STEPS.length - 1 ? "Build my lineage →" : step === 0 ? "Get started" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  )
}
