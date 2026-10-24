# Lane brief — `claude_s12_placement_sql` (staged-runner lane `placement`)

Build, test-first, the SQL producer for CMS-03C-02 POST /api/v1/cms/compositions/pattern-instances →
`platform_private.cms_insert_pattern_instance` (+ `platform_api` wrapper; name normative at BE03c :1365),
over the PROMOTED pattern producer (`20261014020*`, `090200`) and governed activation (governed-b WIP —
stage `governed-b,placement`). The Worker transport and Web proxy already exist and are frozen: the RPC
boundary (args, JSON, tokens, the 1 MiB decoded response ceiling of DEC-188/189) is defined by
`apps/worker/src/cms-composition-production-pattern.ts`, `apps/worker/src/cms-composition/pattern-instance-*.ts`,
`apps/worker/src/cms-composition/pattern-placement*.test*.ts` — match them exactly.

## Spec
BE03c route row ~160 (DEC-175 one row per block root after DEC-181 expansion; 1–512 rows; all-or-nothing;
consecutive `position`s appended after the slot's greatest under the revision/slot lock, DEC-185; server
recomputes the pattern digest; If-Match = entry aggregate version; CAS revision; unique revision/path per
row; DEC-176 entry revisions only, current draft else 409 `revision_not_editable`), validation ~376
(`pattern_version_not_active`, `pattern_incompatible`), ~1365 (producer narrative), DEC-186 (row paths ≤248
octets, `block_registry_digest_mismatch`, override key chain inside an expanded root), lock order ~1336,
pinned definitions ~1355, schema/grants, error catalog, testing ~1612. FE03 :885 and :1050 for response shape.
Criteria AC010–015, AC218/219/247/258 and others naming placement (grep the tracker).

## Prior work to read
`docs/handoffs/2026-10-12-claude-s12/lane-codex-pattern-placement-red-report.md`,
`lane-codex-pattern-sql-red-report.md`, `lane-native-placement-ceiling-report.md`, `CODEX-PLACEMENT-FOCUSED-REVIEW.md`,
and the unrun skeleton `supabase/tests/phase_02_slice_12_pattern_placement.sql` + dir (comment outlines are
not executable proof; make it a real suite on real fixtures — reuse the pattern-definition suite's real
type/pattern/activation chains read-only by `\ir`).

## Files (exclusive)
`supabase/migrations-wip/placement/` (range 20261014110000–20261014119999),
`supabase/tests/phase_02_slice_12_pattern_placement.sql` + dir, report
`docs/handoffs/2026-10-14-claude-s12/lane-placement-report.md`. Maximum-size success (512 rows) and an
over-budget refusal must be proven against the actual producer (FE03 :1050).
