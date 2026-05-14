// PB-009 Phase 3 — single source of truth for decline-category labels.
//
// Phase 1 inlined this list at the API route boundary; Phase 2 inlined a UI
// copy at /me/tags; Phase 3 surfaces report/decline flows from at least three
// new call sites. Centralised here so the UI labels and the API validation
// set never drift apart.
//
// `lifecycle_destroyed` is reachable only via system writes (story/claim
// DELETE handlers). It's excluded from USER_FACING_CATEGORIES so the owner
// and editor pickers never offer it as a selectable reason.

import type { TagEventDeclineCategory } from "@/types"

export interface DeclineCategoryOption {
  value: TagEventDeclineCategory
  label: string
}

export const USER_FACING_CATEGORIES: readonly DeclineCategoryOption[] = [
  { value: "this_wasnt_me", label: "This wasn't me"                },
  { value: "wrong_moment",  label: "Wrong event or moment"         },
  { value: "preference",    label: "I'd rather not be tagged here" },
  { value: "spam",          label: "Appears to be spam"            },
  { value: "other",         label: "Other"                         },
] as const

export const USER_FACING_CATEGORY_VALUES: ReadonlySet<TagEventDeclineCategory> = new Set(
  USER_FACING_CATEGORIES.map((c) => c.value),
)

export function isUserFacingDeclineCategory(value: unknown): value is TagEventDeclineCategory {
  return typeof value === "string" && USER_FACING_CATEGORY_VALUES.has(value as TagEventDeclineCategory)
}

export function labelForDeclineCategory(value: TagEventDeclineCategory | null | undefined): string {
  if (!value) return ""
  if (value === "lifecycle_destroyed") return "The story or claim was deleted"
  return USER_FACING_CATEGORIES.find((c) => c.value === value)?.label ?? value
}
