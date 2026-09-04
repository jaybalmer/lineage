# Bug-fix session brief: one tier word on the member card surfaces + the Annual card brand-mark dot (BUG-134 + BUG-137)

> **REDRAFT, August 24, 2026.** Supersedes `bugs/2026-07-04-member-tier-label.md`, which was
> drafted July 4 and never re-verified. Every file and line number below was re-grepped against
> `main` at tip `300e030` on August 24. **The scope shrank:** BUG-134 appears to have been closed
> incidentally by the BUG-099 `MemberBadge` extraction, so it is now a verify-then-close, not a
> build. What remains is BUG-137 plus three sibling surfaces that still carry the old literal.
>
> **P2, client-only. PIPELINE-SAFE.** Display-only label maps plus one `BrandMark` prop. No tier
> writes, no payments, no auth, no migration, no `_public` view. Nothing here touches the Stripe
> or membership write path; it only changes what four render surfaces print.
> Name both BUG ids (BUG-134, BUG-137) in the PR title or commit message.
> Append a `bugs/SHIP-LOG.md` entry with `migration: none` before wrapping.

## Scope

- **BUG-137: the membership card shows tier "Member" where Cory expects "Annual", and the Linestry brand mark is missing its centre dot on the Annual card.** [P2] [reproducible] Primary work.
- **BUG-134: the `annual` tier renders with two different words on the Riders list versus the profile header.** [P2] [verify-then-close] Evidence below says this is already fixed. Confirm on screen, then close it in the PR body rather than rebuilding it.

One-line goal: the paid tier prints its own name ("Annual", "Lifetime", "Founding") on every member-card surface, and the brand mark shows its centre dot on the dark membership card in both themes.

## DECISIONS (review before building)

1. **Label model. Recommended default: unchanged from Jay's July 5 lock.** "Member" is the generic noun for anyone with an account; a tier badge or membership card prints the TIER word. So `annual` reads **"Annual"**, `lifetime` reads **"Lifetime"**, `founding` reads **"Founding"**. _Alternative: keep the longer "Lifetime Member" / "Founding Member" strings on the big card and shorten only `annual`. Not recommended; it re-forks the map._
2. **Where the canonical map lives. Recommended default: `memberBadgeFor()` in `src/components/ui/member-badge.tsx`.** It already holds the correct labels and is already the source for the two surfaces that agree. Export a plain `TIER_LABEL` lookup from a non-client sibling (or read `memberBadgeFor(tier)?.label`) so the server-rendered OG route can use it too. _Alternative: a new `src/lib/tiers.ts`. Equivalent; pick whichever avoids a `"use client"` import in the OG route._
3. **`free` tier wording. Recommended default: leave `/account/membership` printing "Rider" for `free`.** `member-badge.tsx` deliberately has no `free` entry (renders no chip). Do not add one. _Alternative: unify `free` too. Out of scope, and it would start rendering a chip where the design says none._
4. **Brand-mark dot fix. Recommended default: pass an explicit `dotColor="#ffffff"` on the membership-card `BrandMark`.** The card ground is a fixed dark gradient regardless of theme, so a theme-reactive `var(--foreground)` dot is wrong there by construction. _Alternative: `knockout`. Punches a transparent hole, which on the gradient reads as a coloured dot rather than a clean one. Prefer the explicit white._

## Verified facts (re-grepped against main at `300e030`, August 24, 2026)

1. **The canonical map already exists and is already correct.** `src/components/ui/member-badge.tsx:18-20`:
   `annual: { label: "Annual", color: "#3b82f6", symbol: "◈" }`, plus `lifetime: "Lifetime"` and
   `founding: "Founding"`. `free` is deliberately absent (comment at lines 15-16).
2. **BUG-134 looks already closed.** Both surfaces Cory compared now route through that map:
   - Riders list: `src/app/people/page.tsx:14` imports `MemberBadge`, rendered at line 109.
   - Profile header: `src/components/ui/rider-card.tsx:259` calls `memberBadgeFor(membership.tier)`,
     with the comment at line 409 confirming it is the canonical tier badge.
   The `annual: { text: "MEMBER", ... }` literal the July 4 brief found at `rider-card.tsx:43` is
   **gone**; `grep -rn '"MEMBER"' src` returns only an unrelated admin `title` attribute at
   `src/app/admin/page.tsx:1758`. So both surfaces should now print "Annual".
   **Do not assume: load `/people` and `/people/cy_2` and confirm the same word before closing it.**
3. **Four surfaces still print the old literal**, and they are all member-card surfaces:
   - `src/app/account/membership/page.tsx:24` `TIER_LABELS` maps `annual: "Member"`
     (and `lifetime: "Lifetime Member"`, `founding: "Founding Member"`, `free: "Rider"`).
   - `src/app/member/[username]/card/page.tsx:13` `TIER_LABEL` maps `annual: "Member"`.
   - `src/app/member/[username]/card/opengraph-image.tsx:30` `TIER` maps `annual: { label: "Member" }`.
     Header comment says it is kept local on purpose so this server route never imports the
     `"use client"` badge module. Respect that: give it a non-client label source, do not import
     `member-badge.tsx` here.
   - `src/components/ui/member-card-overlay.tsx:25` maps `label: "Annual member"`
     (sibling `lifetime` reads `"Lifetime member"` at line 39).
4. **One surface is already right and is the precedent to copy:**
   `src/app/people/[id]/opengraph-image.tsx:28` maps `annual: { color: "#3b82f6", label: "Annual" }`.
5. **The brand-mark dot.** `src/app/account/membership/page.tsx:214` renders
   `<BrandMark size={20} color={color} />` with no `dotColor`. `src/components/ui/brand-mark.tsx:63`
   defaults `dotColor = "var(--foreground)"`. The card ground at lines 205-210 is a hardcoded dark
   gradient (`#080e1a` to `#101e2e`), so in light theme the dot resolves to brand ink on near-black
   and disappears. The second `BrandMark` on that page (line 437) sits on the normal page surface
   and must be left alone.
6. **Recently adjacent, so re-read before editing:** PR #203 (`416e676`) shipped the Curated Member
   Profile Phase 3 `/membership` sell-copy pass and the member OG images. That is the most recent
   touch on these files. Nothing since.
7. **Not in scope but nearby:** `src/app/admin/page.tsx:1513` and the two token maps in
   `src/app/api/admin/memberships/route.ts:9` and `src/app/api/stripe/webhook/route.ts:15` are
   token-grant maps, not label maps. Do not touch them.

## Suggested order

1. Load `/people` and `/people/cy_2` (or any `annual` member) and confirm the Riders list and the
   profile header now print the same word. Record the result; that is the BUG-134 close.
2. Give the OG route a non-client label source (Decision 2), then repoint
   `account/membership/page.tsx`, `member/[username]/card/page.tsx`,
   `member/[username]/card/opengraph-image.tsx` and `member-card-overlay.tsx` at one map so
   `annual` prints "Annual" on all four. Keep `free: "Rider"` on the membership page.
3. Add `dotColor="#ffffff"` to the `BrandMark` at `account/membership/page.tsx:214` only.
4. `npx tsc --noEmit`.

## Acceptance

- **BUG-137 label:** `/account/membership` for an `annual` account shows "Annual", not "Member".
  The `/member/[username]/card` page and its OG image agree. `member-card-overlay` reads "Annual".
- **BUG-137 mark:** the centre dot of the brand mark is visible on the membership card in BOTH
  light and dark theme, and on the Lifetime card as well as the Annual one.
- **BUG-134:** verified on screen and closed in the PR body with what you saw, or, if the two
  surfaces still disagree, traced and fixed within this PR.
- `grep -rn 'annual:.*"Member"\|"Annual member"' src` returns nothing.
- `npx tsc --noEmit` clean. No migration, no `_public` view, no tier or payment write touched.

## Standing rules

One PR, both BUG ids in the title. No em dashes anywhere, including any UI copy you write. Run the
full Ship sequence before wrapping; "No migration this session" applies, so state that explicitly.
Append the `bugs/SHIP-LOG.md` entry. The `bugs/` folder is gitignored; do not commit it.
