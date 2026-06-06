"use client"

import type { EntityType } from "@/types"
import { CommunityLink } from "@/components/ui/community-link"
import { entityHref } from "@/lib/entity-links"
import { useLineageStore } from "@/store/lineage-store"

const ENTITY_ICONS: Record<EntityType, string> = {
  person: "👤",
  place: "🏔",
  org: "🏢",
  board: "🏂",
  event: "🏆",
}

interface EntityChipProps {
  id: string
  type: EntityType
  name: string
}

export function EntityChip({ id, type, name }: EntityChipProps) {
  const catalog = useLineageStore((s) => s.catalog)
  return (
    <CommunityLink href={entityHref(id, type, catalog)}>
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-surface-hover border border-border-default rounded-lg text-muted hover:border-border-default hover:text-foreground transition-all">
        <span className="text-[10px]">{ENTITY_ICONS[type]}</span>
        {name}
      </span>
    </CommunityLink>
  )
}
