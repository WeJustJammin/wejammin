# Propagation scan — editorial workflow-policy authority

**Status:** scan only; awaiting owner choice for the protected policy source.
**Origin:** BE03b CMS-03B-10/01/02 frozen editorial workflow-policy evidence.
**Decision type:** private persisted authority source with BE/IA, SQL, runtime,
and Slice 10 test cascade. No policy row or grant is approved by this scan.

## Explicit implementation gap

- `platform_private.cms_editorial_workflow_policy_evidence(uuid)` in
  `20260927080000_cms_entry_authority_rpc.sql` deliberately returns NULL.
  `cms_create_entry`, `cms_create_revision`, and `cms_resolve_conflict` use
  that seam and refuse an absent policy. The 03a schema-activation policy is
  distinct and cannot be substituted for an editorial review policy.
- BE03b requires immutable key/version/hash, risk class, required decision
  count/capabilities, and server-computed approval-evidence hash to be
  re-fetched at save, review, restore, preview, schedule, and publication.
  No owner-controlled persisted source for those values exists in the current
  migrations; caller-supplied `workflowPolicy` is explicitly not authority.

## Affected targets

- BE03b private table inventory (currently twelve), editorial-policy evidence
  and lookup rules, each dependent operation's frozen-evidence recheck.
- IA03 schema/content-model ownership and the deep-dive review/publication
  algorithm; FE03 must continue to treat policy evidence as read-only.
- A forward-only private migration for an immutable content-type-version-bound
  policy source and its owner-controlled enrollment path; forced RLS, closed
  grants, uniqueness/versioning, provenance, and no default rows.
- Replace only the NULL-returning lookup seam with a server-side projection
  that selects one current approved policy, validates its hash/evidence and
  registry capabilities, and returns NULL on absence, ambiguity, revocation,
  or malformed data. Keep browser/client authority out of the lookup.
- pgTAP for missing/ambiguous/revoked/malformed policies, authorized approved
  evidence, replay, and before-write refusal; production adapter and browser
  tests; generated database types, OpenAPI/graph references, Slice 10 tracker.

## Proposed correction for confirmation

Add a private, append-only editorial workflow-policy registry bound to an
exact active content-type version. Require an explicit owner-controlled
approved record and computed evidence; create no policy rows or grants in the
migration. Wire `cms_editorial_workflow_policy_evidence()` to it only after
record integrity and activation compatibility are verified. This removes the
hardcoded NULL seam without inventing ordinary/protected classifications,
reviewer capabilities, approval counts, or approval receipts.

The apply shard must wait for owner confirmation, then use contract-first
RED→GREEN tests and a forward-only migration. This scan does not enable
authoring or close any Slice 10 criterion.
