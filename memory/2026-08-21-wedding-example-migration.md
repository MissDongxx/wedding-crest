# Wedding Crest runtime error — 2026-08-21

## Symptom

The local homepage returned a Next.js runtime error because the query for
`wedding-crest.wedding_example` could not find that relation.

## Root cause

The PostgreSQL schema `wedding-crest` was partially migrated. The existing
project columns were already present, but the Drizzle migration journal had a
timestamp/hash ordering mismatch, so the migration runner stopped before the
frame/example migration.

## Fix and scope

- Corrected the timestamp of the existing `name_display/show_date` migration
  row in `wedding-crest.__drizzle_migrations`.
- Ran the existing migration command with `.env.local`.
- Created only `wedding-crest.wedding_example` and
  `wedding-crest.wedding_frame` through the project migration.
- No other database schema was targeted.

## Verification

- Migration command completed with exit status 0.
- Read-only query confirmed both tables and the frame/example migration hash
  in `wedding-crest`.
- In-app browser rendered `/` and `/create`; neither showed a runtime error.
- Browser console error check returned an empty list.
- `git diff --check` passed for the existing workspace changes.

Status: DONE
