# Slice 09 DEC-108 pgTAP fragments

Shared includes for the DEC-108 activation-producer suites (BE03a CMS-03A-09 to
CMS-03A-14, the template-compatibility resolver) and for the Slice 09 legacy
fixtures that were rewritten to drive the real producers. They are psql
`\ir` includes, not Supabase-discovered test files; the discovered entrypoints
are `../phase_02_slice_09_dec108_*.sql`.

| Fragment | Purpose |
| -------- | ------- |
| `00-helpers.sqlinc` | `pg_temp.s09d_*` probes. Every RPC call runs in a sub-transaction so an absent producer is a failed assertion, never an aborted suite. Also catalog checks, session snapshot/restore and the `s09d_timewarp` window shifter. |
| `01-actors.sqlinc` | Standalone actors: owner via `initialize_cms_owner`, a second designer, three reviewers with no CMS capability, and an other-organization designer. |
| `02-chain.sqlinc` | One helper per named RPC (create, successor, dry-run, worker seal, submit, assign, decide, activate, read) and compound `s09d_to_review` / `to_approved` / `to_active`. |
| `03-support.sqlinc` | Side-effect fingerprints, activation request builders, exact-request replay, the worker backfill/switch steps (`s09d_complete_plan`, `s09d_worker_activate`) and `s09d_grant_specialist` (D3 provisioning of a confirmed owner-organization membership plus a capability granted through CMS-03A-15, never a direct `organization_actor_grant` row). |
| `04-worker.sqlinc` | Migration-worker simulation over the named RPCs only (claim, read rows, apply the registered transform per row, post evidence, finalize, backfill, verify, complete, rollback), `s09w_entry` real entries and `s09w_redefine`/`s09w_tighten` field edits under a ready plan. |

## Rules

- A suite may call named RPCs and read private tables. It must never insert or
  update a review, decision, assignment, dry-run report, approved version or
  completed plan to stand in for a producer. `s09d_timewarp` only shifts the
  stored instants of a real row so "N minutes later" is observable.
- A negative control that forges CFG evidence is allowed only to prove the
  forgery is refused.
- Test-human grants go through the owner command CMS-03A-15 (`s09d_grant_via_rpc`); acting-context bindings and memberships are provisioned in setup (D3). The other organization's designer is the one direct row, because only the single receipt-derived owner can issue grants.

## Adding a test

1. Include the four fragments in order after `select no_plan();`.
2. Build candidates with a tag: `s09d_create_type('a', 'key')`, then the chain
   step you need. Ids live in `s09d_ids` as `<tag>:type`, `:version`, `:dryRun`,
   `:plan`, `:review`, `:assignment:<actor>`, `:decision:<actor>`.
3. Assert on `s09d_outcome('<label>')` (ApiError code, `OK` or `MISSING`) and on
   `s09d_resp('<label>')`. Guard every "unchanged" assertion with a positive
   precondition so it cannot pass vacuously.
4. Keep files under 400 lines; split by behavior.

Related: `../phase_02_slice_09_schema/` (legacy fixtures), BE03a
`.memory/wiki/specs/be/03a-content-schema-registry.md`.
