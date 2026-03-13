"use client"

import { useEffect } from "react"
import { useLineageStore } from "@/store/lineage-store"

export function CatalogLoader() {
  const loadCatalog = useLineageStore((s) => s.loadCatalog)
  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])
  return null
}
