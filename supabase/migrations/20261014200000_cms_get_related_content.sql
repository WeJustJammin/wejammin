-- Slice 12 lane dec195, cmsRelatedContentRead (DEC-195; BE03c route registry, validation row `cmsRelatedContentRead | entryId`,
-- error matrix, catalog and authority rows, RelatedContentRuleRead; tracker P2-S12-AC-060 .. AC-063, AC-261):
-- GET /api/v1/cms/entries/{entryId}/related-content, the protected read of the source entry's saved related-content rule.
--   platform_private.cms_get_related_content(p_request jsonb) returns jsonb   the strict RelatedContentRuleRead { rule }
--   (the platform_api wrapper is 20261014200010)
-- Private request: { entryId, context?, correlationId? }.  The answer is { "rule": <RelatedContentResource> } for the CURRENT ACTIVE
-- rule set of the source, else { "rule": null } (no rule yet, or every item revoked).
-- Order (BE00, as CMS-03C-14): a non-object body or an unknown/absent member is INVALID_REQUEST; actor and acting party
-- (UNAUTHENTICATED); entryId a UUID (a malformed path value: INVALID_REQUEST, 400, before any authority or existence answer);
-- a source that is absent, owned by another party or invisible to the caller is NOT_FOUND (one uniform answer); a visible source
-- on which the caller holds neither cms.author nor cms.editor by ASSIGNMENT is `capability_missing` (403), exactly as CMS-03C-05
-- proves it (cms_authority_origin); then the read.  The source lifecycle is not constrained: the write refuses a non-active source
-- with INVALID_TRANSITION, a read has no such answer.
-- The resource is the one CMS-03C-05 answers (cms_curate_related_content): id and sourceEntryId = the entry id, version = the
-- CURRENT entry aggregate version (the next If-Match operand), contentHash = the write's JCS SHA-256 recipe over
-- { pins, exclusions, derivedRule { key, version, maxCandidates } }, createdAt = updatedAt = the instant of the last rule write (the
-- newest rule row; the append-only rows keep no separate rule-set creation instant), state active, pins in stored `position`
-- order and exclusions in ascending target id order (the table keeps no exclusion order), the derived rule as key and version
-- only, and eligibleCount recomputed by the write's own helper (cms_related_eligible_count).  Pin and exclusion ids are returned
-- exactly as stored: never filtered, never projected, so a target the caller can no longer open is still named (the form labels it).
-- Reads lock and write nothing.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_get_related_content(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  v_party_id uuid;
  v_entry platform_private.cms_content_entries%rowtype;
  v_pins uuid[];
  v_exclusions uuid[];
  v_derived platform_private.cms_related_content_rules%rowtype;
  v_has_derived boolean := false;
  v_stamp timestamptz;
  v_derived_object jsonb;
  v_hash_rule jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array['entryId']::text[], array['entryId', 'context', 'correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  if pg_catalog.jsonb_typeof(p_request->'entryId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'entryId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  select * into v_entry from platform_private.cms_content_entries entry_row
   where entry_row.id = (p_request->>'entryId')::uuid;
  if not found or v_entry.owner_party_id is distinct from v_party_id
     or not platform_private.cms_entry_tenant_visible(v_actor_id, v_entry.owner_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if platform_private.cms_authority_origin(v_actor_id, v_party_id, 'cms.editor', v_entry.id) is null
     and platform_private.cms_authority_origin(v_actor_id, v_party_id, 'cms.author', v_entry.id) is null then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  -- The current item of each (target, mode) is its highest version; the rule set is the items that are active.
  select coalesce(pg_catalog.array_agg(live.target_entry_id order by live.position), array[]::uuid[]) into v_pins
    from (select distinct on (rule_row.target_entry_id) rule_row.*
            from platform_private.cms_related_content_rules rule_row
           where rule_row.source_entry_id = v_entry.id and rule_row.mode = 'pin'
           order by rule_row.target_entry_id, rule_row.version desc) live
   where live.state = 'active';
  select coalesce(pg_catalog.array_agg(live.target_entry_id order by live.target_entry_id), array[]::uuid[]) into v_exclusions
    from (select distinct on (rule_row.target_entry_id) rule_row.*
            from platform_private.cms_related_content_rules rule_row
           where rule_row.source_entry_id = v_entry.id and rule_row.mode = 'exclude'
           order by rule_row.target_entry_id, rule_row.version desc) live
   where live.state = 'active';
  select * into v_derived from platform_private.cms_related_content_rules rule_row
   where rule_row.source_entry_id = v_entry.id and rule_row.mode = 'derived'
   order by rule_row.version desc limit 1;
  v_has_derived := found and v_derived.state = 'active';

  if pg_catalog.cardinality(v_pins) = 0 and pg_catalog.cardinality(v_exclusions) = 0 and not v_has_derived then
    return pg_catalog.jsonb_build_object('rule', null);
  end if;

  select pg_catalog.max(rule_row.created_at) into v_stamp
    from platform_private.cms_related_content_rules rule_row where rule_row.source_entry_id = v_entry.id;
  if v_has_derived then
    v_derived_object := pg_catalog.jsonb_build_object('key', v_derived.rule_key, 'version', v_derived.rule_version::text);
    v_hash_rule := pg_catalog.jsonb_build_object(
      'key', v_derived.rule_key, 'version', v_derived.rule_version::text, 'maxCandidates', v_derived.max_candidates);
  end if;
  return pg_catalog.jsonb_build_object('rule', pg_catalog.jsonb_build_object(
    'id', v_entry.id,
    'version', v_entry.version::text,
    'contentHash', platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
      'pins', pg_catalog.to_jsonb(v_pins), 'exclusions', pg_catalog.to_jsonb(v_exclusions), 'derivedRule', v_hash_rule)),
    'createdAt', platform_private.auth_iso_time(v_stamp),
    'updatedAt', platform_private.auth_iso_time(v_stamp),
    'state', 'active',
    'sourceEntryId', v_entry.id,
    'pins', pg_catalog.to_jsonb(v_pins),
    'exclusions', pg_catalog.to_jsonb(v_exclusions),
    'derivedRule', v_derived_object,
    'eligibleCount', platform_private.cms_related_eligible_count(
      v_entry.id, v_pins, v_exclusions,
      case when v_has_derived then v_derived.rule_key end,
      case when v_has_derived then v_derived.max_candidates end)));
end;
$body$;

comment on function platform_private.cms_get_related_content(jsonb) is
  'cmsRelatedContentRead (DEC-195): an assigned author or editor who can edit the source reads its current active related-content rule as the CMS-03C-05 resource (pins in position order, exclusions by id, ids as stored), or { rule: null }; a visible source without edit is capability_missing, a hidden or absent one NOT_FOUND. A read: writes and locks nothing. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_get_related_content(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_get_related_content(jsonb) from public, anon, authenticated, service_role;

-- Privilege closure: every function and table the reader uses directly must be available to the definer; only what is missing is granted.
do $closure$
declare
  callee text;
  callee_oid regprocedure;
begin
  foreach callee in array array[
    'platform_private.cms_exact_keys(jsonb,text[],text[])', 'platform_private.cms_actor(jsonb)',
    'platform_private.cms_acting_party(jsonb,uuid)', 'platform_private.cms_valid_uuid(text)',
    'platform_private.cms_entry_tenant_visible(uuid,uuid)', 'platform_private.cms_authority_origin(uuid,uuid,text,uuid)',
    'platform_private.cms_jcs_sha256(jsonb)', 'platform_private.auth_iso_time(timestamptz)',
    'platform_private.cms_related_eligible_count(uuid,uuid[],uuid[],text,integer)'
  ] loop
    callee_oid := pg_catalog.to_regprocedure(callee);
    if callee_oid is null then
      raise exception 'related-content reader callee is missing: %', callee using errcode = '55000';
    end if;
    if not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      execute pg_catalog.format('grant execute on function %s to wejammin_cms_definer', callee_oid::text);
    end if;
  end loop;
end;
$closure$;

grant select on table platform_private.cms_content_entries, platform_private.cms_related_content_rules to wejammin_cms_definer;

commit;
