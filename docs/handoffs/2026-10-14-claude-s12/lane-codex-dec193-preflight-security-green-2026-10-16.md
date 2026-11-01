# DEC-193 effective preflight security — forward GREEN candidate

Date: 2026-10-16. Author: native gpt-6.1-sol / ultra.

Status: source frozen, author **UNRUN**. This is an implementation candidate
against root-observed semantic RED, not a passing SQL receipt or a Slice 12
completion claim. Root owns actual staging, regressions, warmed-call proof,
and independent review.

## Exact released scope

- NEW `supabase/migrations-wip/dec193/20261016041700_cms_preflight_effective_security.sql`
- NEW this report at its exact claimed handoff path.

No original migration, other WIP, test, README, plan, provider registry,
detector, or API was edited. The accepted plan remains at
`docs/handoffs/2026-10-14-claude-s12/briefs/codex-dec193-preflight-security-plan.md`,
SHA-256 `4434cbde5fabfce0c63f62785841011721c0bdf37898b9b5c4c27f3eb80f7139`.
The separately frozen 416 and 418 migrations are untouched.

## Actual pre-edit evidence supplied by root

The corrected security/head cluster completed 624 assertions: 616 PASS,
8 meaningful FAIL, no abort. Root TAP identifier: `100934-535238`.
SHA-256:

`0c5502495723fae66170648ba967d2cb58294a92ffe14af4a2be54e6826d54b1`

The earlier corrected security run completed 371 assertions: 370 PASS,
1 FAIL, no abort, SHA-256
`6381c1e55209a79f6bce87d073fdbc50cbd8db57f7399ad47f38d54f7fae5e7e`.
Both actual private preflight calls executed: safe content passed security;
unsafe content present only in the selected detached tree incorrectly passed
with zero offenders. The 416 public-writer controls passed in that run.

These successful evaluator invocations supersede the earlier
`DEPENDENCY_UNAVAILABLE` prerequisite diagnostic. They establish real
preflight-security RED, unlike that earlier blocked diagnostic. All results
above are root-observed pre-edit evidence, not an author rerun.

## Source defect and normative boundary

Promoted `20261005017570_cms_preflight_evaluation.sql:511–522` counted stored
field values and every historically live-state instance's props/bindings,
without first choosing each path's latest version. It omitted canonical
detached-node props entirely. This could both miss effective unsafe content
and count superseded content that no longer belongs to the effective result.

BE03b line 1807 defines database-owned `preflight.security` over stored values
and block props, with `unsafe_content`; line 2056 defines the write-time
boundary. BE03c lines 1487/1563 define selected effective values and canonical
detached snapshots. The existing executable-leaf detector at promoted 17570
lines 133–187 remains the sole policy: arbitrary JSON string leaves, not a
new reserved-key, object-coercion, or SQL-lexical rule.

## Implementation

417 contains one guarded amendment of the installed canonical
`platform_private.cms_evaluate_preflight(jsonb)` source. The complete old
12-line SELECT is the single literal anchor. The replacement is 28 lines.
This follows the existing locale-provider amendment at
`20261014050700_cms_preflight_locale_provider.sql:23–79`, without its registry
INSERT or CMS context mutation.

The replacement query first materializes maximum-version rows per exact
`(revision_id, path)` in the requested revision. Only afterward does it retain
`draft`, `active`, and `pending_diff` heads, so a retired/superseded latest row
cannot resurrect an older live row. It counts unchanged field-value scope,
selected head props/bindings, and each selected canonical detached node's
props. SQL-NULL trees add no nodes; arbitrary JSON values are not coerced.
Detached-tree grammar/empty top-level props are already storage CHECKs.

Detector counts widen to bigint before addition; their SUM is numeric and
the result is capped at 1000 before assignment to the existing integer
variable. Existing `unsafe_content`, provider/version availability dispatch,
outcome normalization, category/result ordering, timestamp construction, and
aggregate `passed` assembly remain outside the changed source span.

The amendment requires the exact canonical signature, CMS-definer ownership,
PL/pgSQL, VOLATILE, SECURITY DEFINER, empty search path, JSONB/non-set return,
one old anchor, and absence of its new marker. It proves inverse replacement
of the entire captured source before executing `pg_get_functiondef` with only
that source span replaced. The transaction then requires the same canonical
OID, exact new source, identical complete `pg_proc` row except `prosrc`, and
unchanged comment. Unexpected state fails closed and rolls back the DDL.

There is no function rename, wrapper, helper, grant, ownership transfer,
provider-registry change, context toggle, or persistent content write. The
installed evaluator's later locale/other branches are preserved rather than
overwritten with the original promoted function definition.

## Static evidence and source freeze

Pure text comparison of the canonical promoted evaluator and a textual
composition with the existing locale amendment confirms: old anchor once,
new anchor once, exact full-source inverse equality, and byte-identical
report-assembly tail. The locale branch remains present after replacement.
This is source analysis, not SQL parsing or execution; installed metadata
assertions and actual DDL/cache behavior still require root runtime.

| Source | SHA-256 |
| --- | --- |
| New 417 migration, 99 LF lines | `ed8bdba1128d612b4957eea69da7b7d8e89c8f2f767389ba8b70719f7fe8afd3` |
| Complete old 12-line SELECT anchor | `3e3f5772787cefdadd38e8e9b68e7bfae60f3e2fc6f513a48f4fa4368831db4b` |
| New 28-line SELECT anchor | `72871748c840a199d10519477e804aa0d5f9607510eed964c052f5028e9fc8ba` |
| Unchanged promoted 17570 source | `5aba1078bdb371c3e2e59c3a730046eb39987e66190608525effaaa85492e19f` |
| Unchanged locale-provider amendment | `2718715bdd09381f892631fc933d53ccc623460aabc00af24667f029b6a95254` |

## Validation boundary

Author used source reading and pure text/hash comparison only. No parser,
collection, import, formatter, test, database, service, network, or Git
operation was run. Root must execute the frozen integrated migration and
624-case security/head cluster, broader regression/race gates, S11 preflight
and S12 locale-provider regressions, and warmed canonical-caller checks.

The new frozen head tests distinguish history/state selection, detached-node
leaves, legacy props/bindings, fields, multiple paths/revisions, safe arbitrary
JSON, and valid 1024-leaf inputs capped to 1000. Complete nonsecurity-object
equality is intentionally asserted only for unchanged SH-P11: other fixtures'
history appends legitimately change the old reference-gate count. Captured
mutation-store images and actual full-report envelope/order/aggregate outcome
oracles must remain passing. Private harness calls do not establish a new
public/service-role invocation proof. No hosted/publication/full-slice
acceptance is claimed here.
