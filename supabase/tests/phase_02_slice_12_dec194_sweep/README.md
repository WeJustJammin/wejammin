# Slice 12 dec194 sweep: the bounded merge-convergence recovery (DEC-194)

Entry point: `../phase_02_slice_12_dec194_sweep.sql` (`no_plan`). It reuses the taxonomy-terms world (S09 DEC-108 fragments, the governed
fragments and `taxonomy_terms/000-world` + `010-setup`: real vocabularies, real merge command, real BE00 claim/outcome and the real continuation
handler) and drives the real `platform_api.cms_reconcile_taxonomy_merge_converge()` under the real `service_role`.

| Fragment                        | Content                                                                                                                                                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`            | sweep call and receipts, job fixtures (`s12dc_job`, `s12dc_settle`, `s12dc_elapse`), the derived-key lookup, change marks, the guard facts                                                                                                                     |
| `001-support-helpers.sqlinc`    | catalog oid of the recovery table, the guarded marker forgery of the routing witness, and the `pg_locks` observer of the per-party mutex                                                                                                                       |
| `010-surface.sqlinc`            | function surface, grants, definer boundary; posture of the mutex helper and of the `taxonomy_merge_recoveries` table (RLS, ACL, policies, key, FK, no trigger; DEC-212)                                                                                        |
| `020-no-work.sqlinc`            | no job; a failed job whose continuation already exists (the false negative); no work left                                                                                                                                                                      |
| `030-gates.sqlinc`              | queued job, running job, the 15-minute bound, each isolated from the other guards                                                                                                                                                                              |
| `040-request.sqlinc`            | the request (binding, key, outbox, audit, answer), the replayed tick, exactly once per failed job                                                                                                                                                              |
| `050-generations.sqlinc`        | the 3-consecutive-failed-generations stop                                                                                                                                                                                                                      |
| `060-idempotency-expiry.sqlinc` | the durable recovery association across the audited TTL expiry: the real handler closes the 050 generation run, the replay materializes the association, the real audited sweep deletes the expired receipt, and the expired-receipt tick must request nothing |
| `070-atomicity.sqlinc`          | the marker insert commits or rolls back with the acceptance: a transaction-local always-violating CHECK constraint on the association table, the full acceptance-effect snapshot before it is removed, and the restored success                                |
| `080-routing-prefilter.sqlinc`  | the routing scan locks only parties with an unmarked failed head and no live job (R2-03): five synthetic parties, the held mutexes read from `pg_locks` after one sweep; the ascending-party lock order pinned on the function source (V1-01)                  |

Labelled fixture forgeries (nothing else): the taxonomy-terms assignment rows, jobs of the type accepted through the real
`platform_private.accept_job_with_outbox` (the history earlier merges would have written), and "time passes" (`s12dc_elapse` shifts the
`created_at`/`updated_at` of the type's job rows back together; the sweep reads `clock_timestamp()`).

The DEC-194 durable-association witnesses add more labelled forgeries, each declared where it is used:

- the completed receipt under a failed Job's derived key, inserted with an already-past `expires_at` (the way
  `../phase_02_slice_03_idempotency_expiry.sql:56-70` seeds its expired receipt), because `guard_idempotency` makes `expires_at`
  immutable — nothing is updated and no guard is disabled;
- one BE00 outcome carrying a result payload (`s12dc_settle_result`), because the real `apply_job_outcome` demands a non-null
  result for `succeeded`;
- (`001-support-helpers.sqlinc`, `080-routing-prefilter.sqlinc`) five fresh synthetic acting parties whose failed and queued jobs are
  accepted and settled through the real BE00 path (`jobs.acting_party_id` has no foreign key), and the support-table marker rows of their
  "already recovered" failed heads, inserted as the test administrator (`s12dc_assoc_forge`; the production writer is the definer sweep).

The witnesses read the private association table `platform_private.taxonomy_merge_recoveries` (DEC-212: a non-aggregate support
table outside the `cms_` namespace) through guarded dynamic accessors, so if that table were absent the suite would report meaningful
TAP failures instead of aborting the file.

Extension pattern: a new guard is a block in `030-gates.sqlinc` with fixture assertions that make the refusal attributable to that guard alone.
Related: `../phase_02_slice_12_taxonomy_terms/` (merge convergence), BE03c "Merge convergence recovery".
