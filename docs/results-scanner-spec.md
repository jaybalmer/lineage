# Results Scanner — Feature Spec

**Status:** Prototype
**Author:** Claude
**Date:** 2026-03-30

---

## Overview

Results Scanner lets an admin paste or upload an event results document (text, CSV, or PDF/image in future phases), automatically extract competitor names and metadata, match them against existing Lineage people, and bulk-add unrecognised riders as new catalog entries — optionally wiring up `competed_at` claims for the whole field in one pass.

The primary use case is seeding a community around a real historical event: paste in the results sheet, confirm the matches, and in 30 seconds you have 50 people with `competed_at` claims attached to the event.

---

## User Flow

```
Admin lands on /admin/results-scanner
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Step 1 · Input                                     │
│  ─────────────────────────────────────────────────  │
│  • Paste raw text OR upload a .txt / .csv file      │
│  • (Optional) link to an existing Event in catalog  │
│  • (Optional) year override                         │
│  • Parse button                                     │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Step 2 · Review                                    │
│  ─────────────────────────────────────────────────  │
│  Table of extracted rows:                           │
│    Place | Name (raw) | Match status | Action       │
│                                                     │
│  Match statuses:                                    │
│    ✓ Exact match  → linked to existing Person       │
│    ~ Fuzzy match  → suggested Person, can override  │
│    + New          → will create new Person          │
│    – Skip         → exclude from import             │
│                                                     │
│  Admin can:                                         │
│    - Override any match / override suggested match  │
│    - Edit display_name before creation              │
│    - Toggle each row in/out                         │
│    - Set division per row (or global)               │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Step 3 · Confirm                                   │
│  ─────────────────────────────────────────────────  │
│  Summary: X matched, Y new people, Z claims         │
│  Confirm button → API call → done toast             │
└─────────────────────────────────────────────────────┘
```

---

## Supported Input Formats

### Text / paste

The parser handles the most common contest-results conventions:

| Format | Example |
|--------|---------|
| Numbered list | `1. Kelly Clark` |
| Ranked with ordinal | `1st  Shaun White` |
| Tab-separated | `1\tTorstein Horgmo\tNOR\t89.50` |
| CSV row | `3,Mark McMorris,CAN,Pro` |
| Last-First | `Klassen, Kjersti` |
| Bare name line | `Torah Bright` |
| With division header | `--- Women's Open ---` → sets division for following rows |

Rules:
- Lines that are all-caps headers or contain no letter sequences ≥ 2 chars are skipped
- Numbers at the start of a line are treated as placement, not part of the name
- Country codes (2–3 uppercase letters) are stripped from the name token

### File upload

- `.txt` — treated as paste
- `.csv` — header row detection; `name` / `rider` / `athlete` column used; `place` / `rank` / `result` columns captured; `division` column captured

### Future: PDF / Image (Phase 2)

- Client-side PDF text extraction via `pdfjs-dist`
- Image OCR via Claude Vision API (pass base64 to `/api/admin/scan-results` with `type: "image"`)
- Server returns same `ExtractedRow[]` shape regardless of input type

---

## Technical Approach

### Name Extraction (`parseResultsText`)

1. Split input into lines
2. Per line: strip leading rank token (`^\d+[\.\)st|nd|rd|th]*\s*`)
3. Strip trailing country/score tokens
4. Normalise whitespace; handle "Last, First" inversion
5. Skip lines shorter than 4 chars or matching known noise patterns

### Name Matching

Matching runs server-side against the live `people` table + `profiles` table.

```
normalise(name) = lowercase, collapse whitespace, remove punctuation
```

1. **Exact match** — `normalise(candidate) === normalise(dbName)`
2. **Fuzzy match** — Levenshtein distance ≤ 2 on normalised strings, OR all tokens of the candidate appear in the db name (handles "Kelly Clark" → "Kelly Clark-Fischer")
3. **No match** — flagged as new; will get `community_status: "unverified"`

Match confidence is returned so the UI can colour-code rows.

### Data Model Changes

No schema changes required for Phase 1.

New rows use the existing `people` table:

```sql
INSERT INTO people (id, display_name, community_status, added_by)
VALUES (gen_random_uuid(), 'Name Here', 'unverified', '<admin_id>');
```

Optional `competed_at` claims use the existing `claims` table:

```sql
INSERT INTO claims (
  id, subject_id, predicate, object_id,
  start_date, confidence, visibility, note
) VALUES (
  gen_random_uuid(), '<person_id>', 'competed_at', '<event_id>',
  '<event_year>-01-01', 'documented', 'public', 'Imported via Results Scanner'
);
```

If `result` (placement) is available it goes in the `result` column; `division` goes in `division`.

### API Routes

#### `POST /api/admin/scan-results`

Request:
```typescript
{
  text: string          // raw pasted / extracted text
  event_id?: string     // optional: link to event for context
}
```

Response:
```typescript
{
  rows: ExtractedRow[]
}

interface ExtractedRow {
  raw: string             // original line
  name: string            // cleaned name
  placement?: number
  division?: string
  country?: string
  score?: string
  match: MatchResult
}

interface MatchResult {
  type: "exact" | "fuzzy" | "none"
  person?: { id: string; display_name: string }
  candidates?: { id: string; display_name: string; score: number }[]
}
```

#### `POST /api/admin/scan-results/confirm`

Request:
```typescript
{
  entries: ConfirmEntry[]
  event_id?: string
  create_claims: boolean
  added_by: string
}

interface ConfirmEntry {
  name: string               // final display_name
  person_id?: string         // if matched — skip creation
  placement?: number
  division?: string
  skip?: boolean
}
```

Response:
```typescript
{
  created: number    // new people created
  matched: number    // existing people used
  claims: number     // claims inserted
}
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Duplicate names in input | Deduplicated; one row shown, count badge |
| Same person appears as both match and new | Exact match takes priority |
| Event not selected | Claims step is skipped; people still created |
| Very short name (e.g. "Bo") | Accepted but flagged with warning |
| Name with accents/diacritics | Normalised with Unicode fold before matching |
| CSV with no name column | Falls back to first text column |
| Empty input | Validation error before parse |
| 500+ rows | Paginate review table; confirm runs in batch of 50 |
| Admin cancels mid-flow | No partial writes — confirm is atomic |
| Person already has competed_at claim for this event | Deduplicated in confirm route |

---

## Phase 2 Ideas

- PDF upload → `pdfjs-dist` text extraction client-side
- Image/scan upload → Claude Vision API for OCR
- "Riding day" bulk import (date + place + list of names)
- Auto-detect event from document title/header
- Suggest `riding_since` year from event year
- Link extracted org/sponsor names to `sponsored_by` claims
