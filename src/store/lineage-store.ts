"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Claim, OnboardingState, Place, Board, Org, Event, EventSeries, Person, RidingDay, MembershipState, TriggerPrefs, Community, CelebrationPayload } from "@/types"
import { PLACES, ORGS, BOARDS, EVENTS, EVENT_SERIES, PEOPLE, CLAIMS } from "@/lib/mock-data"
import { supabase } from "@/lib/supabase"
import { trackEvent } from "@/lib/analytics"

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

  // Communities
  communities: Community[]
  activeCommunitySlug: string
  setActiveCommunitySlug: (slug: string) => void

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

  // Error state
  catalogError: string | null

  // PB-009 Phase 2: Owner Inbox pending-tag count for the avatar dropdown badge
  // and profile pill. Refreshed by <PendingTagPoller /> on app mount + every 30s.
  pendingTagCount: number
  setPendingTagCount: (n: number) => void
  refreshPendingTagCount: () => void

  // PB-009 Phase 3: Editor queue pending-count for the /admin Queue tab badge.
  // Same poller fires both fetches; the editor variant only runs when the
  // current user has is_editor=true (gated in PendingTagPoller).
  editorQueuePendingCount: number
  setEditorQueuePendingCount: (n: number) => void
  refreshEditorQueuePendingCount: () => void

  // Toast notifications
  toasts: { id: string; message: string; type: "error" | "info" }[]
  addToast: (message: string, type?: "error" | "info") => void
  dismissToast: (id: string) => void

  // Celebration queue — ephemeral, not persisted
  celebrationQueue: CelebrationPayload[]
  queueCelebration: (c: CelebrationPayload) => void
  dismissCelebration: () => void

  // Welcome explosion overlay
  showWelcomeCelebration: boolean
  setShowWelcomeCelebration: (v: boolean) => void
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
          // PB-009 Phase 1: read through claims_public to filter to approved
          // (or grandfathered NULL tag_event_id) rows. Writes still go to
          // claims directly via addClaim/updateClaim/removeClaim below.
          supabase.from("claims_public").select("*"),
          // Registered users live in profiles, not people — fetch both and merge
          supabase.from("profiles").select(
            "id, display_name, birth_year, riding_since, privacy_level, bio, links, home_resort_id, membership_tier, node_status"
          ),
          // Junction tables fetched via service-role API route (RLS blocks anon reads)
          fetch("/api/catalog-junctions").then((r) => r.json()).catch(() => ({
            eventBrands: [], seriesBrands: [],
            communities: [],
            communityPeople: [], communityPlaces: [], communityOrgs: [],
            communityBoards: [], communityEvents: [],
          })),
        ]).then(([p, o, b, e, es, pe, c, pr, junctions]) => {
          const {
            eventBrands: ebData, seriesBrands: esbData,
            communities: commData,
            communityPeople: cpData, communityPlaces: cplData,
            communityOrgs: coData, communityBoards: cbData, communityEvents: ceData,
          } = junctions as {
            eventBrands: { event_id: string; org_id: string }[]
            seriesBrands: { series_id: string; org_id: string }[]
            communities: Community[]
            communityPeople: { community_id: string; person_id: string }[]
            communityPlaces: { community_id: string; place_id: string }[]
            communityOrgs: { community_id: string; org_id: string }[]
            communityBoards: { community_id: string; board_id: string }[]
            communityEvents: { community_id: string; event_id: string }[]
          }

          // Build community_id → slug lookup
          const commSlugById = new Map<string, string>()
          for (const comm of commData) commSlugById.set(comm.id, comm.slug)

          // Build entity_id → community_slugs[] maps
          function buildSlugMap(rows: { community_id: string }[], idKey: string) {
            const map = new Map<string, string[]>()
            for (const row of rows) {
              const entityId = (row as Record<string, string>)[idKey]
              const slug = commSlugById.get(row.community_id)
              if (!entityId || !slug) continue
              if (!map.has(entityId)) map.set(entityId, [])
              map.get(entityId)!.push(slug)
            }
            return map
          }
          const peopleSlugs = buildSlugMap(cpData, "person_id")
          const placesSlugs = buildSlugMap(cplData, "place_id")
          const orgsSlugs   = buildSlugMap(coData, "org_id")
          const boardsSlugs = buildSlugMap(cbData, "board_id")
          const eventsSlugs = buildSlugMap(ceData, "event_id")
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
              node_status:      (row.node_status ?? "claimed") as Person["node_status"],
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

          // Attach community_slugs to each entity type
          const placesWithComm = ((p.data?.length ? p.data : PLACES) as Place[]).map((pl) => ({
            ...pl, community_slugs: placesSlugs.get(pl.id),
          }))
          const orgsWithComm = ((o.data?.length ? o.data : ORGS) as Org[]).map((org) => ({
            ...org, community_slugs: orgsSlugs.get(org.id),
          }))
          const boardsWithComm = ((b.data?.length ? b.data : BOARDS) as Board[]).map((bd) => ({
            ...bd, community_slugs: boardsSlugs.get(bd.id),
          }))
          const eventsWithComm = events.map((ev) => ({
            ...ev, community_slugs: eventsSlugs.get(ev.id),
          }))
          const peopleWithComm = [...catalogPeople, ...profilePeople].map((pe2) => ({
            ...pe2, community_slugs: peopleSlugs.get(pe2.id),
          }))

          set({
            communities: commData,
            catalog: {
              places:      placesWithComm,
              orgs:        orgsWithComm,
              boards:      boardsWithComm,
              events:      eventsWithComm,
              eventSeries,
              people:      peopleWithComm,
              claims:      (c.data?.length  ? c.data  : CLAIMS)       as Claim[],
            },
            catalogLoaded: true,
            catalogError: null,
          })
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : "Failed to load catalog"
          set({ catalogError: msg })
          get().addToast("Could not load data. Some content may be outdated.", "error")
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

        const { activePersonId } = get()
        if (!isAuthUser(activePersonId)) return

        // PB-009 Phase 3: precheck whether this claim would create new tags
        // for OTHER people. Self-only claims (no person subject/object other
        // than the asserter) never create tag_events, so no precheck needed.
        const wouldTagOthers =
          (claim.subject_type === "person" && !!claim.subject_id && claim.subject_id !== activePersonId) ||
          (claim.object_type  === "person" && !!claim.object_id  && claim.object_id  !== activePersonId)

        // Silent-failures brief Finding #5: the FTUE wizard sets a UUID-format
        // activePersonId before the user has confirmed their email, so this
        // path used to fire a DB insert with no JWT — RLS denied, the rollback
        // toast appeared, but the confirmation email had already been sent
        // by supabase.auth.signUp upstream. Gate the DB write on an actual
        // session: when there isn’t one, the claim stays in sessionClaims and
        // /auth/complete migrates it after the magic link is followed.
        supabase.auth.getSession().then(async ({ data: { session } }) => {
          if (!session) return

          // Q2a precheck — only when the claim would tag others. A 403 here
          // refuses early with a generic message. The server-side rollback in
          // /api/tag-event is the defense-in-depth (Q2b).
          if (wouldTagOthers) {
            try {
              const r = await fetch("/api/me/can-tag")
              if (r.ok) {
                const j = await r.json() as { can_tag?: boolean; reason?: string }
                if (j.can_tag === false) {
                  set((s) => ({ sessionClaims: s.sessionClaims.filter((c) => c.id !== claim.id) }))
                  get().addToast("You don't have permission to create tags right now.")
                  return
                }
              }
            } catch {
              // Soft-fail-closed: precheck error doesn't refuse the write.
              // Server-side rollback in /api/tag-event will catch a real block.
            }
          }

          supabase
            .from("claims")
            .insert({ ...claim, asserted_by: activePersonId })
            .then(({ error }) => {
              if (error) {
                set((s) => ({ sessionClaims: s.sessionClaims.filter((c) => c.id !== claim.id) }))
                get().addToast("Failed to save claim. Please try again.")
                return
              }
              set((s) => ({
                sessionClaims: s.sessionClaims.filter((c) => c.id !== claim.id),
                dbClaims: [...s.dbClaims, claim],
              }))

              trackEvent("content", "claim_created", {
                predicate: claim.predicate,
                subject_type: claim.subject_type,
                object_type: claim.object_type,
                visibility: claim.visibility,
              }, { actorId: activePersonId })

              // Ambient-growth fan-out (Finding #1) + PB-009 tag_event
              // pairing. Every person id named in this claim (other than the
              // asserter themselves — distinct_tagger_summary excludes self-
              // tags anyway, so calling for the asserter is wasted work) gets
              // a paired tag_event server-side. The route now takes claim_id
              // + predicate so it can FK tag_event_id back onto the claim
              // row. Fire-and-forget; the response is for telemetry only.
              const personIds: string[] = []
              if (claim.subject_type === "person" && claim.subject_id && claim.subject_id !== activePersonId) {
                personIds.push(claim.subject_id)
              }
              if (claim.object_type === "person" && claim.object_id && claim.object_id !== activePersonId) {
                personIds.push(claim.object_id)
              }
              if (personIds.length > 0) {
                fetch("/api/tag-event", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    person_ids: personIds,
                    claim_id: claim.id,
                    predicate: claim.predicate,
                  }),
                }).catch((e) => {
                  console.error("[addClaim] tag-event call failed:", e)
                })
              }
            })
        })
      },
      removeClaim: (id) => {
        const { activePersonId } = get()
        // Capture claim for rollback
        const removedClaim = get().sessionClaims.find((c) => c.id === id)
          ?? get().dbClaims.find((c) => c.id === id)

        set((s) => {
          const isSession = s.sessionClaims.some((c) => c.id === id)
          const isDb = s.dbClaims.some((c) => c.id === id)
          if (isSession) return { sessionClaims: s.sessionClaims.filter((c) => c.id !== id) }
          if (isDb) return { dbClaims: s.dbClaims.filter((c) => c.id !== id) }
          return { deletedClaimIds: [...s.deletedClaimIds, id] }
        })
        if (isAuthUser(activePersonId)) {
          fetch("/api/admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "delete", table: "claims", id }),
          }).then((r) => {
            if (!r.ok && removedClaim) {
              set((s) => ({ dbClaims: [...s.dbClaims, removedClaim] }))
              get().addToast("Failed to delete claim. It has been restored.")
            }
          }).catch(() => {
            if (removedClaim) {
              set((s) => ({ dbClaims: [...s.dbClaims, removedClaim] }))
              get().addToast("Failed to delete claim. It has been restored.")
            }
          })
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
          }).then(r => r.json()).then(d => {
            if (!d.ok) {
              set((s) => ({
                userEntities: { ...s.userEntities, places: s.userEntities.places.filter((p) => p.id !== place.id) },
                catalog: { ...s.catalog, places: s.catalog.places.filter((p) => p.id !== place.id) },
              }))
              get().addToast("Failed to save place. Please try again.")
            }
          }).catch(() => get().addToast("Failed to save place. Please try again."))
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
          }).then(r => r.json()).then(d => {
            if (!d.ok) {
              set((s) => ({
                userEntities: { ...s.userEntities, boards: s.userEntities.boards.filter((b) => b.id !== board.id) },
                catalog: { ...s.catalog, boards: s.catalog.boards.filter((b) => b.id !== board.id) },
              }))
              get().addToast("Failed to save board. Please try again.")
            }
          }).catch(() => get().addToast("Failed to save board. Please try again."))
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
          }).then(r => r.json()).then(d => {
            if (!d.ok) {
              set((s) => ({
                userEntities: { ...s.userEntities, orgs: s.userEntities.orgs.filter((o) => o.id !== org.id) },
                catalog: { ...s.catalog, orgs: s.catalog.orgs.filter((o) => o.id !== org.id) },
              }))
              get().addToast("Failed to save brand. Please try again.")
            }
          }).catch(() => get().addToast("Failed to save brand. Please try again."))
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
          }).then(r => r.json()).then(d => {
            if (!d.ok) get().addToast("Failed to save event series. Please try again.")
          }).catch(() => get().addToast("Failed to save event series. Please try again."))
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
          }).then(r => r.json()).then(d => {
            if (!d.ok) {
              set((s) => ({
                userEntities: { ...s.userEntities, events: s.userEntities.events.filter((e) => e.id !== event.id) },
                catalog: { ...s.catalog, events: s.catalog.events.filter((e) => e.id !== event.id) },
              }))
              get().addToast("Failed to save event. Please try again.")
            }
          }).catch(() => get().addToast("Failed to save event. Please try again."))
        }
      },
      addUserPerson: (person) => {
        const entity = { ...person, community_status: "unverified" as const }
        set((s) => ({
          userEntities: { ...s.userEntities, people: [...s.userEntities.people, entity] },
          catalog: { ...s.catalog, people: [...s.catalog.people, entity] },
        }))
        if (isAuthUser(get().activePersonId)) {
          supabase.from("people").insert({
            id: person.id, display_name: person.display_name,
            riding_since: person.riding_since ?? null,
            bio: person.bio ?? null,
            community_status: "unverified", added_by: get().activePersonId,
          }).then(({ error }) => {
            if (error) get().addToast("Failed to save rider. Please try again.")
          })
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
          }).then(({ error }) => {
            if (error) {
              set((s) => ({ ridingDays: s.ridingDays.filter((d) => d.id !== day.id) }))
              get().addToast("Failed to save riding day. Please try again.")
              return
            }
            trackEvent("content", "riding_day_created", {
              place_id: day.place_id ?? null,
              rider_count: day.rider_ids?.length ?? 0,
              has_note: !!day.note,
              visibility: day.visibility,
            }, { actorId: get().activePersonId })
          })
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

      communities: [],
      activeCommunitySlug: "snowboarding",
      setActiveCommunitySlug: (slug) => set({ activeCommunitySlug: slug }),

      activePersonId: "",
      setActivePersonId: (id) => set({ activePersonId: id }),

      authReady: false,
      setAuthReady: (ready) => set({ authReady: ready }),

      pendingTagCount: 0,
      setPendingTagCount: (n) => set({ pendingTagCount: n }),
      refreshPendingTagCount: () => {
        // Mock + unauth users have no tag_events rows; skip the round-trip.
        if (!isAuthUser(get().activePersonId)) {
          set({ pendingTagCount: 0 })
          return
        }
        fetch("/api/me/tags?status=pending")
          .then((r) => r.ok ? r.json() : null)
          .then((r) => {
            if (r && typeof r.pendingCount === "number") {
              set({ pendingTagCount: r.pendingCount })
            }
          })
          .catch(() => { /* silent — header badge can stay stale */ })
      },

      // PB-009 Phase 3 — editor queue badge count. Gated by membership.is_editor
      // in PendingTagPoller so non-editor users never hit the 403.
      editorQueuePendingCount: 0,
      setEditorQueuePendingCount: (n) => set({ editorQueuePendingCount: n }),
      refreshEditorQueuePendingCount: () => {
        if (!isAuthUser(get().activePersonId)) {
          set({ editorQueuePendingCount: 0 })
          return
        }
        if (!get().membership?.is_editor) {
          set({ editorQueuePendingCount: 0 })
          return
        }
        fetch("/api/admin/tag-queue/count")
          .then((r) => r.ok ? r.json() : null)
          .then((r) => {
            if (r && typeof r.count === "number") {
              set({ editorQueuePendingCount: r.count })
            }
          })
          .catch(() => { /* silent — badge can stay stale */ })
      },

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

      catalogError: null,

      toasts: [],
      addToast: (message, type = "error") => {
        const id = crypto.randomUUID()
        set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
        setTimeout(() => get().dismissToast(id), 5000)
      },
      dismissToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      celebrationQueue: [],
      queueCelebration: (c) =>
        set((s) => ({ celebrationQueue: [...s.celebrationQueue, c] })),
      dismissCelebration: () =>
        set((s) => ({ celebrationQueue: s.celebrationQueue.slice(1) })),

      showWelcomeCelebration: false,
      setShowWelcomeCelebration: (v) => set({ showWelcomeCelebration: v }),
    }),
    {
      name: "lineage-store-v2",
      // Don't persist catalog or dbClaims — catalog always starts from mock data
      // and gets overwritten by loadCatalog(); dbClaims are always reloaded from DB
      partialize: (s) => {
        const { dbClaims: _db, catalog: _cat, catalogLoaded: _cl, showMemberCard: _smc, authReady: _ar, communities: _comm, catalogError: _ce, toasts: _t, celebrationQueue: _cq, showWelcomeCelebration: _swc, pendingTagCount: _ptc, ...rest } = s
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
