# Slice 12 pattern placement (CMS-03C-02) pgTAP support

Support fragments for `supabase/tests/phase_02_slice_12_pattern_placement.sql` and the populated-table witness
`populated-position.sql` (lane `claude_s12_placement_sql`; BE03c route row 160 and "Pattern versions and linked
updates", DEC-175/181/185/186/188/189; tracker P2-S12-AC-010..015, AC-218, AC-219, AC-258).

The command under test is `platform_api.cms_insert_pattern_instance(jsonb)` ->
`platform_private.cms_insert_pattern_instance(jsonb)`. Every pattern a test places is a real active pattern: created by
CMS-03C-12 and activated through the governed chain (CMS-03C-06/08/07/09) of the DEC-108 world. No trigger is
disabled and no active row is inserted. Run with the governed activation WIP staged: lane `governed-b,placement`.

| File                     | Contents                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `000-fixtures.sqlinc`    | author grants, entry/revision minting, pre-existing rows, the exact adapter request, governed activation helper      |
| `010-oracles.sqlinc`     | the command runner (role, ETag header, full before/after images), `s12pl_refused`, `s12pl_check`                     |
| `020-schema.sqlinc`      | catalog and grant facts, the DEC-185 `position` column                                                               |
| `030-patterns.sqlinc`    | the real patterns (1, 2, 32 roots, nested, 16-root child, 512-expansion, incompatible, draft) and two real templates |
| `040-positive.sqlinc`    | forest expansion, positions, pins, props, ETag, replay, review invalidation, hash unchanged                          |
| `050-refusals.sqlinc`    | every typed refusal with no-effect proof, 248-octet bound, template slots, path uniqueness                           |
| `060-big.sqlinc`         | the maximum 512-row placement, response bytes (compact and raw padded) against the 1 MiB ceiling                     |
| `065-defensive.sqlinc`   | cycle, depth, node-count and zero-root refusals through the real expander/plan functions, no row forged              |
| `070-supersede.sqlinc`   | superseded pinned and nested versions (runs last)                                                                    |
| `populated-position.sql` | replays the position migration DDL against legacy rows (separate pgTAP file)                                         |

## How to add a case

1. Mint an entry (a fresh entry per scenario keeps refusals unexplained by earlier writes): `pg_temp.s12pl_entry('tag')` has NO
   template and accepts only the slotPath `/`; `pg_temp.s12pl_tentry('tag')` is bound to the real template (slots main, side,
   fresh) and accepts only a path under one of those slots, never `/` (BE03c 1365, P2-S12-AC-218).
2. Build the request with `pg_temp.s12pl_request(tag, patternLabel, slotPath, overrides, idempotencyKey, ...)`.
3. A success: `pg_temp.s12pl_run(label, request)` then `pg_temp.s12pl_check(label, tag, patternLabel, paths, firstPosition)`.
4. A refusal: `pg_temp.s12pl_refused(label, request, token, detail)` (asserts the exact token and that no store changed).

## Limits of this suite

The concurrent forms of the revision/slot lock (two simultaneous placements) and the deadlock-to-conflict conversion
need a race module; this suite is single-session and says so.
