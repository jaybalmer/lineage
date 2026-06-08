"use client"

import { useLineageStore } from "@/store/lineage-store"
import { BrandMark } from "@/components/ui/brand-mark"

/**
 * Defers rendering of a detail page until the client-only catalog has hydrated.
 *
 * Board/place/event/brand detail pages resolve their entity from the Zustand
 * catalog and call notFound() when it is missing. On a fresh server load (a
 * direct visit, a refresh, a crawler, or opening "View board" in a new tab) the
 * catalog is empty, so the page used to 404 before the catalog could load. This
 * wrapper renders a loading state (HTTP 200) until catalogLoaded flips true, at
 * which point the wrapped page mounts and resolves the entity on the client.
 *
 * The children element is only mounted once catalogLoaded is true, so the wrapped
 * page's hooks and notFound() never run during the loading window. SSR and the
 * first client render both show the loader, so there is no hydration mismatch.
 */
export function CatalogGate({ children }: { children: React.ReactNode }) {
  const catalogLoaded = useLineageStore((s) => s.catalogLoaded)

  if (!catalogLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-accent">
          <BrandMark size={30} />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
