import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Next founding member number = max(founding_member_number) + 1.
 *
 * NOT count(founding) + 1. Count-based numbering reused numbers: when a member
 * left the founding tier the count dropped, so the next grant reused a number
 * that was still on someone's row (e.g. a downgraded profile that kept its stale
 * number), producing a collision. max+1 is always strictly greater than every
 * number currently in the column, so it never collides with a live number even
 * when there are gaps from numbers released by a downgrade.
 *
 * The query scans the whole column (every profile, not just founding-tier rows)
 * so a lingering stale number on a non-founding profile still can't be reused.
 *
 * Note: this read-then-write is not atomic. Two concurrent founding grants could
 * each read the same max. Founding is a small, manual, launch-time cohort so this
 * is acceptable; a dedicated Postgres sequence would be the fully-atomic option.
 */
export async function nextFoundingMemberNumber(client: SupabaseClient): Promise<number> {
  const { data } = await client
    .from("profiles")
    .select("founding_member_number")
    .not("founding_member_number", "is", null)
    .order("founding_member_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  const top = data as { founding_member_number: number | null } | null
  return (top?.founding_member_number ?? 0) + 1
}
