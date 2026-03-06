"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Claim, OnboardingState, Place, Board, Org, Event, Person, RidingDay } from "@/types"
import { CLAIMS } from "@/lib/mock-data"

type UserEntities = {
  places: Place[]
  boards: Board[]
  orgs: Org[]
  events: Event[]
}

interface LineageStore {
  // Onboarding
  onboardingComplete: boolean
  onboarding: OnboardingState
  setOnboardingStep: (step: number) => void
  setOnboardingField: (field: keyof OnboardingState, value: unknown) => void
  completeOnboarding: () => void

  // Claims (user-added during session)
  sessionClaims: Claim[]
  addClaim: (claim: Claim) => void
  removeClaim: (id: string) => void
  updateClaim: (id: string, updates: Partial<Claim>) => void

  // Deleted mock claims + overrides for edited mock claims
  deletedClaimIds: string[]
  claimOverrides: Record<string, Partial<Claim>>

  // User-created entities (unverified until community confirms)
  userEntities: UserEntities
  addUserPlace: (place: Place) => void
  addUserBoard: (board: Board) => void
  addUserOrg: (org: Org) => void
  addUserEvent: (event: Event) => void
  verifyEntity: (entityType: "place" | "board" | "org" | "event", id: string) => void

  // Riding days
  ridingDays: RidingDay[]
  addRidingDay: (day: RidingDay) => void
  removeRidingDay: (id: string) => void
  updateRidingDay: (id: string, updates: Partial<RidingDay>) => void

  // Profile overrides for the current user
  profileOverride: Partial<Person>
  setProfileOverride: (updates: Partial<Person>) => void

  // Active view state
  activePersonId: string
  setActivePersonId: (id: string) => void
}

export const useLineageStore = create<LineageStore>()(
  persist(
    (set) => ({
      onboardingComplete: false,
      onboarding: {
        step: 0,
        early_orgs: [],
        crew_ids: [],
      },
      setOnboardingStep: (step) =>
        set((s) => ({ onboarding: { ...s.onboarding, step } })),
      setOnboardingField: (field, value) =>
        set((s) => ({ onboarding: { ...s.onboarding, [field]: value } })),
      completeOnboarding: () => set({ onboardingComplete: true }),

      sessionClaims: [],
      addClaim: (claim) =>
        set((s) => ({ sessionClaims: [...s.sessionClaims, claim] })),
      removeClaim: (id) =>
        set((s) => {
          const isSession = s.sessionClaims.some((c) => c.id === id)
          if (isSession) {
            return { sessionClaims: s.sessionClaims.filter((c) => c.id !== id) }
          }
          return { deletedClaimIds: [...s.deletedClaimIds, id] }
        }),
      updateClaim: (id, updates) =>
        set((s) => {
          const isSession = s.sessionClaims.some((c) => c.id === id)
          if (isSession) {
            return {
              sessionClaims: s.sessionClaims.map((c) =>
                c.id === id ? { ...c, ...updates } : c
              ),
            }
          }
          return {
            claimOverrides: {
              ...s.claimOverrides,
              [id]: { ...(s.claimOverrides[id] ?? {}), ...updates },
            },
          }
        }),

      deletedClaimIds: [],
      claimOverrides: {},

      userEntities: { places: [], boards: [], orgs: [], events: [] },
      addUserPlace: (place) =>
        set((s) => ({
          userEntities: {
            ...s.userEntities,
            places: [...s.userEntities.places, { ...place, community_status: "unverified" }],
          },
        })),
      addUserBoard: (board) =>
        set((s) => ({
          userEntities: {
            ...s.userEntities,
            boards: [...s.userEntities.boards, { ...board, community_status: "unverified" }],
          },
        })),
      addUserOrg: (org) =>
        set((s) => ({
          userEntities: {
            ...s.userEntities,
            orgs: [...s.userEntities.orgs, { ...org, community_status: "unverified" }],
          },
        })),
      addUserEvent: (event) =>
        set((s) => ({
          userEntities: {
            ...s.userEntities,
            events: [...s.userEntities.events, { ...event, community_status: "unverified" }],
          },
        })),
      verifyEntity: (entityType, id) =>
        set((s) => {
          const key = `${entityType}s` as keyof UserEntities
          return {
            userEntities: {
              ...s.userEntities,
              [key]: (s.userEntities[key] as (Place | Board | Org | Event)[]).map(
                (e) => e.id === id ? { ...e, community_status: "verified" as const } : e
              ),
            },
          }
        }),

      ridingDays: [],
      addRidingDay: (day) =>
        set((s) => ({ ridingDays: [...s.ridingDays, day] })),
      removeRidingDay: (id) =>
        set((s) => ({ ridingDays: s.ridingDays.filter((d) => d.id !== id) })),
      updateRidingDay: (id, updates) =>
        set((s) => ({
          ridingDays: s.ridingDays.map((d) => d.id === id ? { ...d, ...updates } : d),
        })),

      profileOverride: {},
      setProfileOverride: (updates) =>
        set((s) => ({ profileOverride: { ...s.profileOverride, ...updates } })),

      activePersonId: "u1",
      setActivePersonId: (id) => set({ activePersonId: id }),
    }),
    { name: "lineage-store" }
  )
)

export function getAllClaims(
  sessionClaims: Claim[],
  deletedClaimIds: string[],
  claimOverrides: Record<string, Partial<Claim>>
) {
  const mockClaims = CLAIMS
    .filter((c) => !deletedClaimIds.includes(c.id))
    .map((c) => claimOverrides[c.id] ? { ...c, ...claimOverrides[c.id] } : c)
  return [...mockClaims, ...sessionClaims]
}
