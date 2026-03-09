import Link from "next/link"
import type { EntityType } from "@/types"
import { getEntityHref } from "@/lib/mock-data"

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
  return (
    <Link href={getEntityHref(id, type)}>
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-zinc-300 hover:border-zinc-500 hover:text-white transition-all">
        <span className="text-[10px]">{ENTITY_ICONS[type]}</span>
        {name}
      </span>
    </Link>
  )
}
