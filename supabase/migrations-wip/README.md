# Unpromoted migrations (working area)

This directory is empty of SQL and lane directories since the joint promotion of 2026-10-23: root moved the 80 reviewed
migrations of fourteen lanes into `supabase/migrations/` (sources and SHA-256 values in
`docs/handoffs/2026-10-22-claude-s12/evidence/promotion-manifest-20261023.json`; the per-lane descriptions now live in
`supabase/migrations/README.md`). Nothing in `supabase/migrations-wip/` is applied by `supabase db reset`,
`pnpm db:verify` or CI.

How a new WIP lane uses it:

- Keep in-progress forward migrations in `supabase/migrations-wip/<lane>/`, using only the timestamp range the lane brief
  assigns. Give the lane directory a short `README.md` listing its files and the spec and decision citations.
- Run the lane's pgTAP through `docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh`, which applies every
  promoted migration in `supabase/migrations/` plus that lane's directory only.
- After independent review, root moves reviewed files into `supabase/migrations/` (promotion), records a manifest like the
  one above, adds one section per lane to `supabase/migrations/README.md`, and removes the lane directory. From then on
  the files are applied migrations and are never edited; later changes are new forward migrations.
- If a local database already applied a later migration than a newly promoted one, it needs
  `supabase migration up --include-all`.
- This directory must be empty of SQL before any slice closes.
