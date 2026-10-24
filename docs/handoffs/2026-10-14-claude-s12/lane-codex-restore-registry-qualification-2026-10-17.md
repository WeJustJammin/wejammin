# DEC-201 restore registry local-name qualification

Status: author source freeze, UNRUN. Root owns independent review, transactional execution, catalog comparison and combined tests. No SQL parser, formatter, tests, database, Docker, Git, network or application runtime was used by this author.

## Scope and receiving evidence

Only these two new paths are authored:

- `supabase/migrations-wip/dec193/20261017044720_cms_restore_composition_registry_qualification.sql`
- This handoff.

Root supplied the receiving evidence: combined 44710 refs qualification plus 448 integration gives serial 90 GREEN; expanded 808 has 712 PASS / 96 FAIL, complete with no abort and equal rollback catalog. The `template_id` failures are cleared, but actual SQLSTATE `42702` for `root_chain` remains. These are root observations, not author executions; this report does not attribute every remaining failure to this one defect.

Executed 446 declares `root_chain` at line 43, assigns it at 83 and 93, and reads it at 135 and 159. At 159, the SQL expression `reached.root_chain = root_chain` collides with the returned record field. This is an implementation-name correction within the selected DEC-201 contract, not a product or API change.

## Exact amendment

44720 sorts after the unpromoted 44710 candidate and before the unexecuted 448 integration. No executed migration is edited.

The migration targets only:

`platform_private.cms_restore_composition_registry(platform_private.cms_composition_instances,uuid,uuid[],uuid[])`

Five individually unique source anchors rename the local declaration, two assignments and two reads to `restore_root_chain`. The qualified field `reached.root_chain` is present exactly once both before and after. All other body bytes are unchanged after exact inverse substitution; no policy, values, predicates, query order, errors, locks or writes are added to the helper.

The forward guard pins the original body bytes, MD5 and SHA-256, the exact private signature, CMS owner, PL/pgSQL language, STABLE/scalar-text/invoker attributes, empty search path, argument names, no defaults/overloads and absence of PUBLIC/API-role EXECUTE. It rejects a preexisting replacement identifier or a non-unique anchor.

The inverse runs from the upper array bound down to 1, matching PL/pgSQL `REVERSE` semantics. Before replacement, it must reconstruct the exact old source and entire old `pg_get_functiondef` definition. After replacement, the migration requires the same OID, full `pg_proc` image except `prosrc`, ACL, comment and expected new definition. There is no `variable_conflict` setting, owner-transfer statement, schema CREATE grant or application/dependency grant change.

## Source-only receipts

Baseline executed 446 file SHA-256:

`4d61d677cba37615708a01e4e62df04afc7e70c997e376c8277db733f394f408`

The body extracted from its dollar-quoted source exactly matches root's supplied live baseline:

| Body | UTF-8 bytes | MD5 | SHA-256 |
|---|---:|---|---|
| Original | 10086 | `010fb7fbf828b658fe78ce7050bc3d54` | `345db6bd674ab6cbdf0da103647ebe09bad9ad4962cfcd973701590b9485fa06` |
| Amended | 10126 | `a1f71f4c05b494be65cb467713f36dbb` | `33406a4eb95e0d0862a8fa132e47d556bb37e0831e3804b05c9d36f43bf36728` |
| Exact inverse | 10086 | `010fb7fbf828b658fe78ce7050bc3d54` | `345db6bd674ab6cbdf0da103647ebe09bad9ad4962cfcd973701590b9485fa06` |

Source text analysis reread the five actual old/new anchor arrays from the newly authored migration, verified one occurrence per anchor, applied them in order and reversed them in descending order. The inverse is byte-identical to the original body. This is text/digest evidence only, not SQL compilation, invocation or catalog evidence.

Migration freeze: 141 physical lines / 6688 UTF-8 bytes / SHA-256:

`2f5b60666e04fbea1bd2fb3e0702289a3209cd01f06dc6cf952d1f83cdb7b992`

## Remaining gates and limits

Root must independently review the narrow rename and guards, then execute its combined three-candidate-migration transaction, verify the actual `42702` is cleared and compare complete function/catalog images after rollback. Expected results are predictions until those checks run. Source guards deliberately refuse any unexpected baseline, metadata or anchor drift rather than guessing a new body.

No acceptance, provider readiness, general restore correctness or resolution of the other expanded-suite failures is claimed. Any later rollback must be a separately guarded forward migration, not an edit to an executed file.
