-- DEC-109 editorial workflow-policy evidence (BE03b "Editorial workflow-policy
-- evidence", CMS-03B-10).  Replaces the fail-closed seam stub: the projection
-- now resolves the policy a content-type version binds through
-- workflow_key/workflow_version from the seeded code-owned registry
-- (cms_workflow_policies) and returns NULL on absence, ambiguity or a malformed
-- binding, so cms_create_entry and every other consumer keep failing closed
-- instead of trusting a caller-supplied hash.  Forward-only.
--
-- Evidence shape (WorkflowPolicyEvidence): key, version (decimal string),
-- policyHash, riskClass, requiredDecisionCount, requiredCapabilities,
-- approvalEvidenceHash.  key/version/policyHash name the bound member; the
-- class, count and ordered slots are the strictest-of resolution the review
-- freeze uses (a successor can never carry a weaker editorial rule than its
-- source), which equals the member itself for a first version.
-- approvalEvidenceHash is the decision-independent digest of the frozen 03a
-- activation approval hash, the member policyHash and the schema version id
-- (BE03b), identical for every entry and revision of the version.
begin;

-- The registry member read and the strictest-of resolution only read committed
-- policy rows; declared stable so the stable consumers of the evidence stay stable.
alter function platform_private.cms_workflow_policy_member(text, bigint) stable;
alter function platform_private.cms_resolve_review_policy(uuid) stable;

create or replace function platform_private.cms_editorial_workflow_policy_evidence(p_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  version_row platform_private.cms_content_type_versions%rowtype;
  member jsonb;
  effective jsonb;
begin
  if p_version_id is null then
    return null;
  end if;
  select * into version_row
    from platform_private.cms_content_type_versions version
   where version.id = p_version_id;
  -- Only an activated version carries the frozen 03a approval the digest binds.
  if not found
     or version_row.activation_approval_evidence_hash is null
     or version_row.activation_workflow_policy_key is null then
    return null;
  end if;
  -- NULL on absence, ambiguity or a stored hash that differs from the
  -- recomputation of the member's own columns.
  member := platform_private.cms_workflow_policy_member(
    version_row.workflow_key, version_row.workflow_version);
  if member is null then
    return null;
  end if;
  -- The binding frozen at activation must still name exactly this member.
  if version_row.activation_workflow_policy_key is distinct from member->>'key'
     or version_row.activation_workflow_policy_version is distinct from (member->>'version')::bigint
     or version_row.activation_workflow_policy_hash is distinct from member->>'policyHash' then
    return null;
  end if;
  begin
    effective := platform_private.cms_resolve_review_policy(version_row.id);
  exception when others then
    return null;
  end;
  if effective is null
     or effective->>'policyKey' is distinct from member->>'key'
     or effective->>'policyHash' is distinct from member->>'policyHash' then
    return null;
  end if;
  return pg_catalog.jsonb_build_object(
    'key', member->>'key',
    'version', member->>'version',
    'policyHash', member->>'policyHash',
    'riskClass', effective->>'riskClass',
    'requiredDecisionCount', (effective->>'requiredDecisionCount')::integer,
    'requiredCapabilities', effective->'requiredCapabilities',
    'approvalEvidenceHash', platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
      'activationApprovalEvidenceHash', version_row.activation_approval_evidence_hash,
      'policyHash', member->>'policyHash',
      'schemaVersionId', version_row.id
    ))
  );
end;
$body$;

comment on function platform_private.cms_editorial_workflow_policy_evidence(uuid) is
  'DEC-109: editorial workflow-policy evidence of a content-type version, resolved from the seeded code-owned policy registry through the bound workflow_key/workflow_version. NULL on absence, ambiguity or malformed binding (callers fail closed); never reads caller input.';

revoke all on function platform_private.cms_editorial_workflow_policy_evidence(uuid)
  from public, anon, authenticated, service_role;

commit;
