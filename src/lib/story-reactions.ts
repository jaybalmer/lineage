import type { StoryReactionType } from "@/types"

/**
 * The five story reactions, locked June 9 2026. Names live in the DB check
 * constraint (story_reactions.reaction_type); glyphs render in the UI only.
 * Order here is the render order of the reaction bar.
 */
export const STORY_REACTION_TYPES: readonly StoryReactionType[] = [
  "stoke",
  "fire",
  "laugh",
  "respect",
  "classic",
] as const

export const STORY_REACTION_EMOJI: Record<StoryReactionType, string> = {
  stoke:   "🤙",
  fire:    "🔥",
  laugh:   "😂",
  respect: "🙌",
  classic: "🏆",
}

export function isStoryReactionType(v: unknown): v is StoryReactionType {
  return typeof v === "string" && (STORY_REACTION_TYPES as readonly string[]).includes(v)
}
