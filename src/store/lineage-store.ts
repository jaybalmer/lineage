"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Claim, OnboardingState, Place, Board, Org, Event, EventSeries, Person, RidingDay, MembershipState, TriggerPrefs } from "@/types"
import { PLACES, ORGS, BOARDS, EVENTS, EVENT_SERIES, PEOPLE, CLAIMS } from "@/lib/mock-data"
import { supabase } from "@/lib/supabase"

type Catalog = {
  places: Place[]
  orgs: Org[]
  boards: Board[]
  events: Event[]
  eventSeries: EventSeries[]
  people: Person[]
  claims: Claim[]
}

// A real auth user has a UUID as their ID; mock people use short strings like "u1"
// Dev bypass IDs start with "dev-" — treated as local session users, no Supabase sync
export function isAuthUser(id: string): boolean {
  return id.length > 8 && !id.startsWith("dev-")
}

type UserEntities = {
  places: Place[]
  boards: Board[]
  orgs: Org[]
  events: Event[]
  eventSeries: EventSeries[]
  people: Person[]
}

interface LineageStore {
  // Onboarding
  onboardingComplete: boolean
  onboarding: OnboardingState
  setOnboardingStep: (step: number) => void
  setOnboardingField: (field: keyof OnboardingState, value: unknown) => void
  completeOnboarding: () => void

  // Claims (user-added during session, before DB confirmation)
  sessionClaims: Claim[]
  addClaim: (claim: Claim) => void
  removeClaim: (id: string) => void
  updateClaim: (id: string, updates: Partial<Claim>) => void

  // Claims loaded from DB for authenticated users
  dbClaims: Claim[]
  setDbClaims: (claims: Claim[]) => void
  clearSessionClaims: () => void

  // Deleted mock claims + overrides for edited mock claims
  deletedClaimIds: string[]
  claimOverrides: Record<string, Partial<Claim>>

  // User-created entities (unverified until community confirms)
  userEntities: UserEntities
  addUserPlace: (place: Place) => void
  addUserBoard: (board: Board) => void
  addUserOrg: (org: Org) => void
  addUserEvent: (event: Event) => void
  addUserSeries: (series: EventSeries) => void
  addUserPerson: (person: Person) => void
  updateUserEvent: (id: string, updates: Partial<Event>) => void
  verifyEntity: (entityType: "place" | "board" | "org" | "event" | "person", id: string) => void
  loadDbEntities: () => void

  // Riding days
  ridingDays: RidingDay[]
  addRidingDay: (day: RidingDay) => void
  removeRidingDay: (id: string) => void
  updateRidingDay: (id: string, updates: Partial<RidingDay>) => void

  // Profile overrides for the current user
  profileOverride: Partial<Person>
  setProfileOverride: (updates: Partial<Person>) => void

  // Catalog: all public entity data loaded from Supabase (initialized from mock-data)
  catalog: Catalog
  catalogLoaded: boolean
  loadCatalog: () => void

  // Bulk catalog operations (for admin editor)
  updateCatalogEntity: (
    type: "boards" | "events" | "places" | "orgs" | "eventSeries",
    id: string,
    updates: Record<string, unknown>
  ) => void
  removeCatalogEntity: (
    type: "boards" | "events" | "places" | "orgs" | "eventSeries",
    id: string
  ) => void

  // Active view state
  activePersonId: string
  setActivePersonId: (id: string) => void

  // True once the server-validated getUser() check has resolved on mount.
  // Protected pages must not redirect until this is true, to avoid kicking
  // out a valid user whose JWT was expired but whose refresh token is fine.
  authReady: boolean
  setAuthReady: (ready: boolean) => void

  // Membership
  membership: MembershipState
  setMembership: (updates: Partial<MembershipState>) => void
  addContributionToken: (amount?: number) => void

  // Member card overlay
  showMemberCard: boolean
  setShowMemberCard: (v: boolean) => void

  // Trigger moment suppression
  triggerPrefs: TriggerPrefs
  setTriggerPrefs: (updates: Partial<TriggerPrefs>) => void
}

export const useLineageStore = create<LineageStore>()(
  persist(
    (set, get) => ({
      catalog: {
        places: PLACES,
        orgs: ORGS,
        boards: BOARDS,
        events: EVENTS,
        eventSeries: EVENT_SERIES,
        people: PEOPLE,
        claims: CLAIMS,
      },
      catalogLoaded: false,
      loadCatalog: () => {
        Promise.all([
          supabase.from("places").select("*"),
          supabase.from("orgs").select("*"),
          supabase.from("boards").select("*"),
          supabase.from("events").select("*"),
          supabase.from("event_series").select("*"),
          supabase.from("people").select("*"),
          supabase.from("claims").select("*"),
          // Registered users live in profiles, not people — fetch both and merge
          supabase.from("profiles").select(
            "id, display_name, birth_year, riding_since, privacy_level, bio, links, home_resort_id, membership_tier"
          ),
          // Junction tables fetched via service-role API route (RLS blocks anon reads)
          fetch("/api/catalog-junctions").then((r) => r.json()).catch(() => ({ eventBrands: [], seriesBrands: [] })),
        ]).then(([p, o, b, e, es, pe, c, pr, junctions]) => {
          const { eventBrands: ebData, seriesBrands: esbData } = junctions as {
            eventBrands: { event_id: string; org_id: string }[]
            seriesBrands: { series_id: string; org_id: string }[]
          }
          const catalogPeople = (pe.data?.length ? pe.data : PEOPLE) as Person[]

          // Map profile rows → Person shape, skip any already in catalog people (dedup by id)
          const catalogIds = new Set(catalogPeople.map((x) => x.id))
          const profilePeople: Person[] = (pr.data ?? [])
            .filter((row) => !catalogIds.has(row.id) && row.display_name)
            .map((row) => ({
              id:               row.id,
              display_name:     row.display_name,
              birth_year:       row.birth_year     ?? undefined,
              riding_since:     row.riding_since   ?? undefined,
              privacy_level:    (row.privacy_level ?? "public") as Person["privacy_level"],
              bio:              row.bio            ?? undefined,
              links:            row.links          ?? undefined,
              home_resort_id:   row.home_resort_id ?? undefined,
              membership_tier:  (row.membership_tier ?? "free") as Person["membership_tier"],
              community_status: "verified" as const,
            }))

          // Build brand_ids maps from junction tables
          const eventBrandMap = new Map<string, string[]>()
          for (const row of ebData) {
            if (!eventBrandMap.has(row.event_id)) eventBrandMap.set(row.event_id, [])
            eventBrandMap.get(row.event_id)!.push(row.org_id)
          }
          const seriesBrandMap = new Map<string, string[]>()
          for (const row of esbData) {
            if (!seriesBrandMap.has(row.series_id)) seriesBrandMap.set(row.series_id, [])
            seriesBrandMap.get(row.series_id)!.push(row.org_id)
          }

          const events = ((e.data?.length ? e.data : EVENTS) as Event[]).map((ev) => ({
            ...ev,
            brand_ids: eventBrandMap.get(ev.id),
          }))
          const eventSeries = ((es.data?.length ? es.data : EVENT_SERIES) as EventSeries[]).map((s) => ({
            ...s,
            brand_ids: seriesBrandMap.get(s.id),
          }))

          set({
            catalog: {
              places:      (p.data?.length  ? p.data  : PLACES)       as Place[],
              orgs:        (o.data?.length  ? o.data  : ORGS)         as Org[],
              boards:      (b.data?.length  ? b.data  : BOARDS)       as Board[],
              events,
              eventSeries,
              people:      [...catalogPeople, ...profilePeople],
              claims:      (c.data?.length  ? c.data  : CLAIMS)       as Claim[],
            },
            catalogLoaded: true,
          })
        })
      },

      onboardingComplete: false,
      onboarding: {
        step: 0,
        early_orgs: [],
        crew_ids: [],
        board_ids: [],
        event_ids: [],
      },
      setOnboardingStep: (step) =>
        set((s) => ({ onboarding: { ...s.onboarding, step } })),
      setOnboardingField: (field, value) =>
        set((s) => ({ onboarding: { ...s.onboarding, [field]: value } })),
      completeOnboarding: () => set({ onboardingComplete: true }),

      sessionClaims: [],
      addClaim: (claim) => {
        // Optimistic update
        set((s) => ({ sessionClaims: [...s.sessionClaims, claim] }))

        // Persist to DB for authenticated users
        const { activePersonId } = get()
        if (isAuthUser(activePersonId)) {
          supabase
            .from("claims")
            .insert({ ...claim, asserted_by: activePersonId })
            .then(({ error }) => {
              if (!error) {
                // Move from sessionClaims → dbClaims
                set((s) => ({
                  sessionClaims: s.sessionClaims.filter((c) => c.id !== claim.id),
                  dbClaims: [...s.dbClaims, claim],
                }))
              }
            })
        }
      },
      removeClaim: (id) => {
        const { activePersonId } = get()
        set((s) => {
          const isSession = s.sessionClaims.some((c) => c.id === id)
          const isDb = s.dbClaims.some((c) => c.id === id)
          if (isSession) return { sessionClaims: s.sessionClaims.filter((c) => c.id !== id) }
          if (isDb) return { dbClaims: s.dbClaims.filter((c) => c.id !== id) }
          return { deletedClaimIds: [...s.deletedClaimIds, id] }
        })
        if (isAuthUser(activePersonId)) {
          supabase.from("claims").delete().eq("id", id)
        }
      },
      updateClaim: (id, updates) => {
        const { activePersonId } = get()
        set((s) => {
          const isSession = s.sessionClaims.some((c) => c.id === id)
          const isDb = s.dbClaims.some((c) => c.id === id)
          if (isSession) {
            return {
              sessionClaims: s.sessionClaims.map((c) =>
                c.id === id ? { ...c, ...updates } : c
              ),
            }
          }
          if (isDb) {
            return {
              dbClaims: s.dbClaims.map((c) =>
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
        })
        if (isAuthUser(activePersonId)) {
          supabase.from("claims").update(updates).eq("id", id)
        }
      },

      dbClaims: [],
      setDbClaims: (claims) => set({ dbClaims: claims }),
      clearSessionClaims: () => set({ sessionClaims: [] }),

      deletedClaimIds: [],
      claimOverrides: {},

      userEntities: { places: [], boards: [], orgs: [], events: [], eventSeries: [], people: [] },
      addUserPlace: (place) => {
        const entity = { ...place, community_status: "unverified" as const }
        set((s) => ({
          userEntities: { ...s.userEntities, places: [...s.userEntities.places, entity] },
          catalog: { ...s.catalog, places: [...s.catalog.places, entity] },
        }))
        if (isAuthUser(get().activePersonId)) {
          fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "insert", table: "places", data: {
              id: place.id, name: place.name, place_type: place.place_type,
              region: place.region ?? null, country: place.country ?? null,
              website: place.website ?? null, description: place.description ?? null,
              first_snowboard_year: place.first_snowboard_year ?? null,
              community_status: "unverified", added_by: get().activePersonId,
            }})
          }).then(r => r.json()).then(d => { if (!d.ok) console.error("place insert:", d.error) })
        }
      },
      addUserBoard: (board) => {
        const entity = { ...board, community_status: "unverified" as const }
        set((s) => ({
          userEntities: { ...s.userEntities, boards: [...s.userEntities.boards, entity] },
          catalog: { ...s.catalog, boards: [...s.catalog.boards, entity] },
        }))
        if (isAuthUser(get().activePersonId)) {
          fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "insert", table: "boards", data: {
              id: board.id, brand: board.brand, model: board.model, model_year: board.model_year,
              shape: board.shape ?? null, external_ref: board.external_ref ?? null,
              community_status: "unverified", added_by: get().activePersonId,
            }})
          }).then(r => r.json()).then(d => { if (!d.ok) console.error("board insert:", d.error) })
        }
      },
      addUserOrg: (org) => {
        const entity = { ...org, community_status: "unverified" as const }
        set((s) => ({
          userEntities: { ...s.userEntities, orgs: [...s.userEntities.orgs, entity] },
          catalog: { ...s.catalog, orgs: [...s.catalog.orgs, entity] },
        }))
        if (isAuthUser(get().activePersonId)) {
          fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "insert", table: "orgs", data: {
              id: org.id, name: org.name, org_type: org.org_type,
              brand_category: org.brand_category ?? null, founded_year: org.founded_year ?? null,
              country: org.country ?? null, website: org.website ?? null,
              description: org.description ?? null,
              community_status: "unverified", added_by: get().activePersonId,
            }})
          }).then(r => r.json()).then(d => { if (!d.ok) console.error("org insert:", d.error) })
        }
      },
      addUserSeries: (series) => {
        set((s) => ({
          userEntities: { ...s.userEntities, eventSeries: [...(s.userEntities.eventSeries ?? []), series] },
          catalog: { ...s.catalog, eventSeries: [...s.catalog.eventSeries, series] },
        }))
        if (isAuthUser(get().activePersonId)) {
          fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "insert", table: "event_series", data: {
              id: series.id, name: series.name, place_id: series.place_id ?? null,
              frequency: series.frequency, start_year: series.start_year ?? null,
              description: series.description ?? null,
            }})
          }).then(r => r.json()).then(d => { if (!d.ok) console.error("series insert:", d.error) })
        }
      },
      addUserEvent: (event) => {
        const entity = { ...event, community_status: "unverified" as const }
        set((s) => ({
          userEntities: { ...s.userEntities, events: [...s.userEntities.events, entity] },
          catalog: { ...s.catalog, events: [...s.catalog.events, entity] },
        }))
        if (isAuthUser(get().activePersonId)) {
          // Normalise start_date: if it's just a year ("2024"), convert to "2024-01-01"
          const rawDate = event.start_date ?? ""
          const startDate = /^\d{4}$/.test(rawDate) ? `${rawDate}-01-01` : (rawDate || null)
          fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "insert", table: "events", data: {
              id: event.id, name: event.name, event_type: event.event_type,
              year: event.year ?? null,
              start_date: startDate, end_date: event.end_date ?? null,
              series_id: event.series_id ?? null, place_id: event.place_id ?? null,
              description: event.description ?? null,
              community_status: "unverified", added_by: get().activePersonId,
            }})
          }).then(r => r.json()).then(d => { if (!d.ok) console.error("event insert:", d.error) })
        }
      },
      addUserPerson: (person) => {
        const entity = { ...person, community_status: "unverified" as const }
        set((s) => ({ userEntities: { ...s.userEntities, people: [...s.userEntities.people, entity] } }))
        if (isAuthUser(get().activePersonId)) {
          supabase.from("people").insert({
            id: person.id, display_name: person.display_name,
            riding_since: person.riding_since ?? null,
            bio: person.bio ?? null,
            community_status: "unverified", added_by: get().activePersonId,
          }).then(({ error }) => { if (error) console.error("person insert:", error) })
        }
      },
      updateUserEvent: (id, updates) => {
        set((s) => ({
          userEntities: {
            ...s.userEntities,
            events: s.userEntities.events.map((e) => e.id === id ? { ...e, ...updates } : e),
          },
          catalog: {
            ...s.catalog,
            events: s.catalog.events.map((e) => e.id === id ? { ...e, ...updates } : e),
          },
        }))
        if (isAuthUser(get().activePersonId)) {
          // Strip brand_ids — it's a denormalized field from the event_brands junction table, not a column
          const { brand_ids: _, ...dbUpdates } = updates
          supabase.from("events").update(dbUpdates).eq("id", id)
            .then(({ error }) => { if (error) console.error("event update:", error) })
        }
      },
      verifyEntity: (entityType, id) =>
        set((s) => {
          const key = (entityType === "person" ? "people" : `${entityType}s`) as keyof UserEntities
          return {
            userEntities: {
              ...s.userEntities,
              [key]: (s.userEntities[key] as (Place | Board | Org | Event)[]).map(
                (e) => e.id === id ? { ...e, community_status: "verified" as const } : e
              ),
            },
          }
        }),
      loadDbEntities: () => {
        const { activePersonId } = get()
        if (!isAuthUser(activePersonId)) return
        // Load shared entity catalog (all user-contributed entities, visible to everyone)
        Promise.all([
          supabase.from("places").select("*"),
          supabase.from("boards").select("*"),
          supabase.from("orgs").select("*"),
          supabase.from("events").select("*"),
        ]).then(([placesRes, boardsRes, orgsRes, eventsRes]) => {
          set({
            userEntities: {
              places: (placesRes.data ?? []) as Place[],
              boards: (boardsRes.data ?? []) as Board[],
              orgs: (orgsRes.data ?? []) as Org[],
              events: (eventsRes.data ?? []) as Event[],
              eventSeries: [],
              people: [],
            },
          })
        })
        // Load this user's riding days
        supabase.from("riding_days").select("*").eq("created_by", activePersonId)
          .then(({ data, error }) => {
            if (!error && data) set({ ridingDays: data as RidingDay[] })
          })
      },

      ridingDays: [],
      addRidingDay: (day) => {
        set((s) => ({ ridingDays: [...s.ridingDays, day] }))
        if (isAuthUser(get().activePersonId)) {
          supabase.from("riding_days").insert({
            id: day.id, date: day.date, place_id: day.place_id,
            rider_ids: day.rider_ids, note: day.note ?? null,
            visibility: day.visibility, created_by: day.created_by,
          }).then(({ error }) => { if (error) console.error("riding_day insert:", error) })
        }
      },
      removeRidingDay: (id) => {
        set((s) => ({ ridingDays: s.ridingDays.filter((d) => d.id !== id) }))
        if (isAuthUser(get().activePersonId)) {
          supabase.from("riding_days").delete().eq("id", id)
        }
      },
      updateRidingDay: (id, updates) => {
        set((s) => ({ ridingDays: s.ridingDays.map((d) => d.id === id ? { ...d, ...updates } : d) }))
        if (isAuthUser(get().activePersonId)) {
          supabase.from("riding_days").update(updates).eq("id", id)
        }
      },

      profileOverride: {},
      setProfileOverride: (updates) =>
        set((s) => ({ profileOverride: { ...s.profileOverride, ...updates } })),

      updateCatalogEntity: (type, id, updates) => {
        set((s) => ({
          catalog: {
            ...s.catalog,
            [type]: (s.catalog[type] as { id: string }[]).map(
              (e) => e.id === id ? { ...e, ...updates } : e
            ),
          },
        }))
        if (isAuthUser(get().activePersonId)) {
          fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "update", table: type, data: updates, id })
          }).then(r => r.json()).then(d => { if (!d.ok) console.error(`${type} update:`, d.error) })
        }
      },
      removeCatalogEntity: (type, id) => {
        set((s) => ({
          catalog: {
            ...s.catalog,
            [type]: (s.catalog[type] as { id: string }[]).filter((e) => e.id !== id),
          },
        }))
        if (isAuthUser(get().activePersonId)) {
          fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "delete", table: type, id })
          }).then(r => r.json()).then(d => { if (!d.ok) console.error(`${type} delete:`, d.error) })
        }
      },

      activePersonId: "",
      setActivePersonId: (id) => set({ activePersonId: id }),

      authReady: false,
      setAuthReady: (ready) => set({ authReady: ready }),

      membership: {
        tier: "free",
        status: "active",
        founding_badge: false,
        token_balance: { founder: 0, member: 0, contribution: 0 },
        gift_codes: [],
        pending_credit: 0,
        is_editor: false,
      },
      setMembership: (updates) =>
        set((s) => ({ membership: { ...s.membership, ...updates } })),
      addContributionToken: (amount = 1) =>
        set((s) => ({
          membership: {
            ...s.membership,
            token_balance: {
              ...s.membership.token_balance,
              contribution: s.membership.token_balance.contribution + amount,
            },
          },
        })),

      showMemberCard: false,
      setShowMemberCard: (v) => set({ showMemberCard: v }),

      triggerPrefs: {},
      setTriggerPrefs: (updates) =>
        set((s) => ({ triggerPrefs: { ...s.triggerPrefs, ...updates } })),
    }),
    {
      name: "lineage-store-v2",
      // Don't persist catalog or dbClaims — catalog always starts from mock data
      // and gets overwritten by loadCatalog(); dbClaims are always reloaded from DB
      partialize: (s) => {
        const { dbClaims: _db, catalog: _cat, catalogLoaded: _cl, showMemberCard: _smc, authReady: _ar, ...rest } = s
        return rest
      },
    }
  )
)

export function getAllClaims(
  sessionClaims: Claim[],
  dbClaims: Claim[],
  deletedClaimIds: string[],
  claimOverrides: Record<string, Partial<Claim>>,
  activePersonId: string
) {
  if (isAuthUser(activePersonId)) {
    // Real user: use DB claims + optimistic session claims only
    const persisted = dbClaims
      .filter((c) => !deletedClaimIds.includes(c.id))
      .map((c) => claimOverrides[c.id] ? { ...c, ...claimOverrides[c.id] } : c)
    return [...persisted, ...sessionClaims]
  }

  // Mock user: use mock seed data
  const mockClaims = CLAIMS
    .filter((c) => !deletedClaimIds.includes(c.id))
    .map((c) => claimOverrides[c.id] ? { ...c, ...claimOverrides[c.id] } : c)
  return [...mockClaims, ...sessionClaims]
}
