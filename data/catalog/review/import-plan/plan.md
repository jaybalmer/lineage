# Boards import plan

Generated from `reconciliation-decisions.csv` by `scripts/build-import-plan.py`.
**No database was written by generating this.** Review, then run the steps in order.

## What will run

- **79 merges** -> `02-merge-backfill.sql` (UPDATE existing boards)
- **6 imports** -> `03-import-new-boards.sql` (INSERT new boards)
- **12 keeps** -> no SQL, listed below

## Order + risk gate

1. `01-add-columns.sql` - additive ADD COLUMN. **SAFE.**
2. `02-merge-backfill.sql` - UPDATEs existing rows. **GATED** (touches existing data). Backfills the new columns; the 5 FUZZY merges also correct a misspelled model name.
3. `03-import-new-boards.sql` - INSERTs new rows. Additive.

Run 1 before 2 and 3 (they need the new columns). 2 and 3 are each wrapped in a transaction. Take a boards backup first (Supabase does PITR, but a `create table boards_backup as select * from boards;` before step 2 is cheap insurance).

## Keeps (no change)

- Barfoot Barfoot Snoboards 1981 (EXISTING_ONLY)
- Barfoot Kloek (EXISTING_ONLY)
- Burton Terje Haakonsen (EXISTING_ONLY)
- Gentemstick Flock (EXISTING_ONLY)
- Gnu Space Case (EXISTING_ONLY)
- Korua Tugboat (EXISTING_ONLY)
- Lib Tech Douhboy Shredder (EXISTING_ONLY)
- Lib Tech Innercourse Asymmetrical (EXISTING_ONLY)
- Lib Tech Lost Rocket (EXISTING_ONLY)
- Lib Tech MC (EXISTING_ONLY)
- Lib Tech MC Bus (EXISTING_ONLY)
- Morrow Lunchtray (FUZZY)

## Imports (new boards)

- Barfoot Twin Tip (`barfoot--twin-tip`)
- Burton Backhill (BB1) (`burton--backhill-bb1`)
- CAPiTA Spring Break Powder Racers (`capita--spring-break-powder-racers`)
- CAPiTA Super DOA (`capita--super-doa`)
- Lib Tech Grocer Shalom (`lib-tech--grocer-shalom`)
- Never Summer Trooper (`never-summer--trooper`)

## Open items to decide before/after running

- **3 duplicate boards** (Barfoot Freestyle, Burton Performer Elite, Lib Tech Emma Peele) still exist; the merge UPDATEs both copies. De-dupe them separately (delete the extra row).
- **33 boards carry a placeholder `model_year` of 2010.** This plan does NOT overwrite `model_year`; it adds the catalog's `first_year` alongside. Decide whether to replace the 2010 values with `first_year` in a follow-up.
- Imported boards use the catalog `first_year` as their `model_year` and `shape = null`.
