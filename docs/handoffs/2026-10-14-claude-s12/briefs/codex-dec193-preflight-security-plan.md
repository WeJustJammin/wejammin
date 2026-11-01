# DEC-193 canonical preflight security correction — source-only plan

## Approach

Amend only the installed canonical evaluator's security-count query with a
guarded, reversible-in-memory source replacement. The existing locale-provider
migration already establishes this bounded pattern; it avoids copying the
447-line evaluator, changing its identity, or reconstructing its report.

Root's corrected actual security run completed 371 assertions: 370 PASS,
1 meaningful FAIL, no abort. Both real preflight calls executed; safe content
passed security, while the unsafe-tree-only fixture incorrectly returned
`passed / null / 0` instead of `failed / unsafe_content / 1`. All 416 writer
controls now pass. TAP `094655-387697`, SHA-256:
`6381c1e55209a79f6bce87d073fdbc50cbd8db57f7399ad47f38d54f7fae5e7e`.
This supersedes the earlier prerequisite-blocked preflight diagnostic; it is
root-supplied runtime evidence, not an author rerun.

## Scope

**In:**

- Propose one NEW forward migration:
  `supabase/migrations-wip/dec193/20261016041700_cms_preflight_effective_security.sql`.
  This path is currently absent and needs a separate exact release before writes.
- Replace only the existing security offender-count query inside
  `platform_private.cms_evaluate_preflight(jsonb)`, preserving its canonical OID.
- Count stored field values and only the latest live composition row per
  `(revision_id, path)`, including canonical detached-node props and legacy
  props/bindings, with the existing executable-leaf detector.
- Require root-owned regression evidence and any separately released missing
  discriminating test controls before accepting the implementation.

**Out:**

- No production implementation under this plan-only claim.
- No old migration/test/README edits; no new helper or public/private API,
  grants, registry/provider change, schema column, backfill, or content write.
- No wrapper/base rename, fake report, detector/context substitution, new
  lexical policy, arbitrary-JSON coercion, or scans of discarded alternatives.
- No changes to manifest/settings effects, evidence freshness/binding,
  accessibility, category order, publication orchestration, or other providers.

## Steps

1. **Claim** the proposed NEW 41700 path and an implementation report only
   after root approves this plan. Keep normal SQL formatting below 300 lines;
   a roughly 30-line replacement query plus guarded amendment fits without
   copying or minifying the evaluator. Any new tests require a separate claim.

2. **Capture** the installed evaluator by exact
   `platform_private.cms_evaluate_preflight(jsonb)` identity inside one forward
   transaction. Require CMS-definer ownership, PL/pgSQL, function kind,
   VOLATILE, SECURITY DEFINER, empty search path, JSONB return, and non-set
   return. Save its complete `pg_proc` row and comment. Use the existing
   locale amendment's lock/statement timeout and fail-closed attribute checks
   as the local pattern, without its registry INSERT or context mutation.

3. **Bind** one exact old-source anchor: the complete security SELECT at
   promoted 17570 lines 511–522, not the 447-line function or a generic
   provider-dispatch anchor. Require exactly one occurrence and absence of
   the unique replacement marker. Replace it with one query and prove the
   inverse replacement restores the complete captured `prosrc` byte-for-byte.
   This retains installed locale/other-provider amendments outside the anchor.

4. **Select** heads before filtering state. Restrict to the requested revision;
   select maximum version for each exact path, using either DISTINCT ON with
   descending version or the existing writer's no-newer-version predicate.
   Do not put a live-state predicate inside that head selection. Only after
   choosing heads retain `draft`, `active`, and `pending_diff`. A latest retired
   or superseded row must not resurrect an older active row. The existing
   unique `(revision_id, path, version)` constraint removes version ties.

5. **Count** existing detector leaves without inventing another policy. Keep
   field-value scope unchanged. For each selected live head, count its legacy
   `props` and `bindings`, plus `node->'props'` for each node of a nonnull
   `detached_tree`. A SQL-NULL tree contributes no nodes; do not substitute
   pattern/provenance trees, scan snapshot metadata, or coerce JSON null,
   scalar, array, or object props. Existing storage CHECKs guarantee nonnull
   trees' grammar and empty top-level props, preventing duplicate effective
   props counts. Sum in a wide numeric type and clamp to 1000 before assigning
   the integer offender variable, preserving the existing externally capped
   count and positive-count decision. Leave `unsafe_content`, outcome
   normalization, result construction, and the `passed` accumulator untouched.

6. **Replace** the live definition using `pg_get_functiondef` and the exact
   captured source, requiring a unique definition/source occurrence. Execute
   the resulting CREATE OR REPLACE; then require identical canonical OID,
   exact new source, identical `to_jsonb(pg_proc) - 'prosrc'`, and unchanged
   comment. Owner, ACL, SECURITY DEFINER/search path, argument/return identity,
   volatility, and all other routine attributes therefore remain unchanged.
   Do not grant anything or toggle CMS/RLS context. Any failed assertion rolls
   back the whole DDL transaction.

7. **Verify** source-only fidelity before root runtime: exact anchor count,
   exact inverse source equality, no other definition changes, no grant/write
   statements, and normal migration length. Record installed-provider
   preservation and all source hashes in the separately released report.

8. **Validate** under root's existing isolated staged runner: rerun the exact
   371 security assertions and the planned broader 1315/race regression gate,
   plus S11 helper/preflight and S12 locale-provider regressions. Add separately
   authorized controls for unsafe old/safe latest on one path, safe old/unsafe
   latest detached nodes, a latest retired head hiding unsafe old history,
   legacy NULL-tree props and bindings, field-value preservation, multiple
   paths/revisions, exact >1000 cap, and safe arbitrary JSON. Capture the entire
   report: only the applicable security object and derived top-level `passed`
   may differ semantically; `evaluatedAt` remains a fresh valid timestamp,
   while other category objects/order must remain exact. Include a
   warmed same-session canonical caller before/after DDL to verify cached
   callers execute the amended canonical evaluator, with no-effect images and
   existing CMS context restoration. No existing result may be faked or relaxed.

## Assumptions

- **Verified source facts:** promoted
  `supabase/migrations/20261005017570_cms_preflight_evaluation.sql:189–635`
  defines the 447-line evaluator. Its security query at 511–522 scans field
  values and all historically live-state instance props/bindings, omitting
  detached trees. Lines 523–525 assign `unsafe_content`; lines 610–632 already
  derive outcome, capped count, ordered results, and aggregate `passed`.
- **Verified local precedent:**
  `supabase/migrations-wip/locale-gate/20261014050700_cms_preflight_locale_provider.sql:23–79`
  already performs a guarded source-only evaluator amendment, inverse-byte
  proof, exact OID/attribute preservation, and comment preservation. It also
  demonstrates why replacing the original promoted body wholesale would lose
  later provider work. The plan uses its amendment mechanism, not registry DML.
- **Verified detector and access:** 17570 lines 133–187 define the existing
  detector over arbitrary JSON string leaves. Lines 640–658 grant the existing
  evaluator table-read closure, 669–674 assign detector/evaluator ownership to
  `wejammin_cms_definer`, and 680–685 deny API-role execution. No new dependency
  grant is needed for inline queries over these same tables and detector.
- **Verified head/storage constraints:** promoted
  `20260927290000_cms_composition_authority.sql:115–116` makes revision/path/
  version unique. Current 41500 writer lines 118–120 choose the greatest
  version before state checks. DEC193 40000 lines 181–187 require a valid
  nonnull detached tree, detached mode, and empty top-level props. This plan
  does not follow `carried_from_id` or provenance pins when selecting content.
- **Verified private callers:**
  `20261005017640_cms_submit_review.sql:209`,
  `20261005017700_cms_publication_command_support.sql:306`,
  `20261005017740_cms_execute_publication_schedule.sql:199` (subsequently
  amended by `20261010162200_cms_execute_publication_schedule_conflicts.sql:103`),
  and `20261005017900_cms_get_entry_workflow.sql:237/247` call the same canonical name.
  No app/infra caller of the private evaluator was found in the scoped search.
- **Design inference, not runtime proof:** preserving the existing function
  OID and using normal CREATE OR REPLACE avoids a rename/rebind dependency
  audit and follows the established invalidation path. Warmed-call validation
  remains required; static inspection does not prove a live session's cache.
- **Alternatives rejected:** extracting a private offender helper would fit
  the file limit but adds a new owner/ACL/dependency surface unnecessarily.
  Renaming an unchanged base plus adding a canonical wrapper changes object
  identity and requires extra dependency/cache analysis; it would also have to
  rewrite only a real available security provider result and recompute `passed`
  without disturbing timestamp, errors, effects, or unrelated categories.
  Neither complication is needed for the single existing-query seam.
- **Authority:** BE03b line 1807 specifies database-owned `preflight.security`
  over stored values/block props with `unsafe_content`; line 2056 is the
  write-time boundary. BE03c lines 1487/1563 define selected effective values
  and canonical detached snapshots. No new product decision is proposed.
- **Unproved boundaries:** the supplied actual RED proves the detached-tree
  omission, not every proposed historical-head, cap, cached-caller, or full
  category-preservation control. Those remain explicit root-owned proof gates.
  This plan performs no parser, import, formatter, test, DB, network, or Git run.
