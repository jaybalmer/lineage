> **SUPERSEDED August 24, 2026 by `bugs/2026-08-24-member-tier-label.md`. Do not build this file.**
> Its central verified fact (the `annual: { text: "MEMBER" }` literal at `rider-card.tsx:43`) no
> longer exists on `main`, and BUG-134 appears to have closed incidentally since. The redraft
> re-greps every file and line against tip `300e030`. Kept only for the decision history.

# Bug-fix session brief: unify the member tier label + fix the Annual card brand-mark dot (BUG-134 + BUG-137)

> Drafted by the July 4, 2026 daily triage. Self-contained. Diagnosis-first on BUG-134.
> **P2, client-only.** Membership/profile DISPLAY only (label maps + a brand-mark prop);
> no tier writes, no payments, no migration. Low risk, but it touches the membership
> surface, so treat it as HUMAN-REVIEWED rather than blind auto-merge until the label
> decision is set.
> Name the BUG ids (BUG-134, BUG-137) in the PR title or commit message.
> Append a `status: pending` SHIP-LOG entry before wrapping.

## Scope

- **BUG-134: The `annual` tier renders with two different words depending on surface (Riders list shows "Annual" for CY 2, the profile header shows a different word).** [P2] [reproducible] [diagnosis-first]
- **BUG-137: The membership card shows tier "Member" (Cory expects "Annual") and the Linestry brand mark is missing its centre dot on the Annual card (the Lifetime card has it).** [P2] [reproducible]

One-line goal: one canonical word for the `annual` tier everywhere, and a brand mark that shows its centre dot on the coloured Annual membership card.

## DECISIONS (LOCKED by Jay, July 5, 2026)

1. **Label model: LOCKED. Two levels.** "Member" is the generic word for anyone with an account; the paid TIER is then named explicitly: **"Annual"**, **"Lifetime"**, **"Founding"**. So a tier badge / membership card must show the TIER word (the Annual card reads "Annual", not "Member"), while "Member" is only the generic noun used where no tier distinction is intended. Concretely:
   - BUG-137: the membership card shows the tier word for that account (**"Annual"** for CY 2, "Lifetime", "Founding", etc.), not "Member".
   - BUG-134: the same account reads the SAME word on the `/people` Riders list and the `/people/[id]` profile header. Since those are tier badges, both should show the tier word (**"Annual"** for CY 2), not a mix of "Annual" and "MEMBER". Route every tier badge through one label map so the tier name is defined once (`free -> "Free Rider"` or generic, `annual -> "Annual"`, `lifetime -> "Lifetime"`, `founding -> "Founding"`). Do NOT collapse the paid tiers to the generic "Member" word.
2. **BUG-137 brand-mark dot: LOCKED.** Pass an explicit high-contrast `dotColor` (or use the knockout variant) to `<BrandMark>` on the membership card so the centre dot reads on the blue Annual fill as it does on the purple Lifetime fill. Contrast fix.

> NOTE: this reverses the earlier draft default of "Member everywhere". Update the `rider-card` map (currently `annual: { text: "MEMBER" }`) and the profile header to show the tier word, and confirm the membership card shows "Annual" not "Member". The `member-card-overlay` "Annual member" can shorten to "Annual".

## Reports (July 4, screenshots in Linestry Bug Attachments, not opened this run)

- BUG-134: 02:21 UTC, Cory (R1), iPhone 414x468, `https://linestry.com/people/cy_2`. "The Member tag under CY 2 profile pic is different text than on the Rider list for CY 2 where it says Annual for its tag." Screenshot `19f2aee47177ee4b__0__bug-screenshot.jpg`. Replay session `S-27`, offset 630s.
- BUG-137: 04:02 UTC, Cory as CY 2 (R2), iPad 820x1048, `https://linestry.com/account/membership`. "My member card should say Annual and the linestry logo is missing the dot in the middle. My Lifetime account the dot is there." Screenshot `19f2b4afa32f70ab__0__bug-screenshot.jpg`. Replay session `S-29`, offset 1696s.

## Verified facts (checked against the live repo July 4)

1. Label maps for the `annual` tier are DUPLICATED across at least four files, which is how they drift:
   - `src/app/account/membership/page.tsx:25` maps `annual: "Member"`.
   - `src/app/member/[username]/card/page.tsx:14` maps `annual: "Member"`.
   - `src/components/ui/rider-card.tsx:43` maps `annual: { text: "MEMBER", color: "#3b82f6", bg: "#3b82f622" }`.
   - `src/components/ui/member-card-overlay.tsx:24-25` maps `annual: { label: "Annual member", ... }`.
   - `src/app/admin/page.tsx:1389-1392` has its own tier colour/glyph map.
   So the codebase already renders "Member", "MEMBER", and "Annual member" for the same tier on different surfaces. The `member-card-overlay` "Annual member" is the likely source of the "Annual" word Cory saw; whichever surface backs the `/people/[id]` profile header vs the `/people` Riders list must be traced to confirm which two he compared. Unify onto one map (recommend a shared `TIER_LABELS` in a lib module both the membership page and rider-card import) so the word is defined once.
   - Prior art: BUG-099 already extracted a shared `MemberBadge` (`src/components/ui/member-badge.tsx`) for the colour/icon map; check whether the label belongs there too so this does not re-fork.
2. BUG-137 tier label: `/account/membership` shows `annual -> "Member"`. Cory's "should say Annual" is therefore a naming-consistency call, not a raw bug; decision 1 settles it.
3. BUG-137 brand mark: `src/app/account/membership/page.tsx:214` renders `<BrandMark size={20} color={color} />` where `color` is the tier colour (annual `#3b82f6`, lifetime `#8b5cf6` per lines 31-32). Per codebase `CLAUDE.md`, `BrandMark` takes a `dotColor`/`knockout` and its centre dot defaults to `var(--foreground)`; on the blue Annual card that contrast dot is washing out, while the purple Lifetime card keeps enough contrast. Set an explicit contrast `dotColor` (or `knockout`) on the membership-card `BrandMark` so the dot shows on both.
4. CY 2 is an `annual` member (consistent with BUG-134 + BUG-137 both being about the annual tier). Two Cory nodes exist (`cory_yip` lifetime, `cy_2` annual); confirm which node each surface reads when tracing BUG-134.

## Suggested order

1. Decide the canonical word (decision 1).
2. Introduce/reuse a single tier-label source and point the membership page, `member/[username]/card`, `rider-card`, the profile header, and `member-card-overlay` at it (remove the divergent literals). This closes BUG-134 and the BUG-137 label half.
3. Fix the `BrandMark` dot on the membership card (decision 2).

## Acceptance

- BUG-134: the same member's tier reads the identical word on the `/people` Riders list and the `/people/[id]` profile header (and the membership card); `grep -rn "Annual member\|\"MEMBER\"\|annual:.*\"Member\"" src` shows a single source of truth (or all point at one map).
- BUG-137: the Annual membership card shows the agreed tier word and the Linestry brand mark shows its centre dot on both the Annual (blue) and Lifetime (purple) cards.
- `npx tsc --noEmit` clean. Client-only, no migration, no tier/payment writes.

## Standing rules

One PR, both BUG ids in the title. No em dashes anywhere. Run the full Ship sequence before wrapping ("No migration this session" applies). Append the SHIP-LOG entry. The `bugs/` folder is gitignored; do not commit it.
